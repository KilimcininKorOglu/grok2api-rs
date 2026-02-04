use axum::{routing::post, Json, Router};
use axum::response::{IntoResponse, Response};
use axum::http::{HeaderMap, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;
use async_stream::stream;
use futures::StreamExt;

use crate::core::auth::verify_api_key;
use crate::core::config::get_config;
use crate::core::exceptions::ApiError;
use crate::services::grok::chat::GrokChatService;
use crate::services::grok::model::{Cost, ModelService};
use crate::services::grok::processor::{ImageCollectProcessor, ImageStreamProcessor};
use crate::services::token::{EffortType, TokenService};

#[derive(Debug, Deserialize)]
pub struct ImageRequest {
    pub prompt: String,
    pub model: Option<String>,
    pub n: Option<u32>,
    pub size: Option<String>,
    pub quality: Option<String>,
    pub response_format: Option<String>,
    pub style: Option<String>,
    pub stream: Option<bool>,
}

pub fn router() -> Router {
    Router::new().route("/v1/images/generations", post(create_image))
}

async fn create_image(headers: HeaderMap, Json(req): Json<ImageRequest>) -> Result<Response, ApiError> {
    verify_api_key(&headers).await?;
    let enabled: bool = get_config("downstream.enable_images", true).await;
    if !enabled {
        return Err(ApiError::not_found("Endpoint disabled"));
    }
    let model_id = req.model.clone().unwrap_or_else(|| "grok-imagine-1.0".to_string());
    let n = req.n.unwrap_or(1).clamp(1, 10);
    let stream = req.stream.unwrap_or(false);

    let model_info = ModelService::get(&model_id).ok_or_else(|| ApiError::invalid_request("The model does not exist"))?;
    if !model_info.is_image {
        return Err(ApiError::invalid_request(format!("The model `{}` is not supported for image generation.", model_id)).with_code("model_not_supported"));
    }
    if req.prompt.trim().is_empty() {
        return Err(ApiError::invalid_request("Prompt cannot be empty").with_param("prompt"));
    }
    if stream && !(n == 1 || n == 2) {
        return Err(ApiError::invalid_request("Streaming is only supported when n=1 or n=2").with_param("stream"));
    }

    let token = TokenService::get_token_for_model(&model_id).await?;
    let chat_service = GrokChatService::new().await;
    let response = chat_service
        .chat(
            &token,
            &format!("Image Generation:{}", req.prompt),
            &model_info.grok_model,
            &model_info.model_mode,
            Some(false),
            true,
            &[],
            &[],
        )
        .await?;

    if stream {
        let processor = ImageStreamProcessor::new(&model_id, &token, n as usize).await;
        let effort = if model_info.cost == Cost::High { EffortType::High } else { EffortType::Low };
        let token_clone = token.clone();
        let body_stream = stream! {
            let mut inner = Box::pin(processor.process(response));
            while let Some(item) = inner.as_mut().next().await {
                yield item;
            }
            let _ = TokenService::consume(&token_clone, effort).await;
        };
        let mut headers = HeaderMap::new();
        headers.insert("Cache-Control", "no-cache".parse().unwrap());
        headers.insert("Connection", "keep-alive".parse().unwrap());
        headers.insert("Content-Type", "text/event-stream".parse().unwrap());
        return Ok((headers, axum::body::Body::from_stream(body_stream)).into_response());
    }

    let processor = ImageCollectProcessor::new(&model_id, &token).await;
    let images = processor.process(response).await;
    let data = images
        .into_iter()
        .take(n as usize)
        .map(|b64| json!({"b64_json": b64}))
        .collect::<Vec<_>>();
    let created = chrono::Utc::now().timestamp() as i64;
    let usage = json!({"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0});
    let resp = json!({"created": created, "data": data, "usage": usage});

    let effort = if model_info.cost == Cost::High { EffortType::High } else { EffortType::Low };
    let _ = TokenService::consume(&token, effort).await;

    Ok((StatusCode::OK, Json(resp)).into_response())
}
