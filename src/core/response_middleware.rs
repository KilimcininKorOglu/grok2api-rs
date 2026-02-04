use std::time::Instant;

use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;
use uuid::Uuid;

pub async fn log_middleware(req: Request<axum::body::Body>, next: Next) -> Response {
    let trace_id = Uuid::new_v4().to_string();
    let method = req.method().clone();
    let path = req.uri().path().to_string();

    tracing::info!(trace_id = %trace_id, %method, %path, "Request");

    let start = Instant::now();
    let mut req = req;
    req.extensions_mut().insert(trace_id.clone());
    let response = next.run(req).await;
    let elapsed = start.elapsed().as_secs_f64() * 1000.0;

    tracing::info!(
        trace_id = %trace_id,
        %method,
        %path,
        status = response.status().as_u16(),
        duration_ms = elapsed,
        "Response"
    );

    response
}
