use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;

use futures::future::BoxFuture;
use tokio::sync::Semaphore;

pub type OnItem = Arc<dyn Fn(String, bool) -> BoxFuture<'static, ()> + Send + Sync>;
pub type ShouldCancel = Arc<dyn Fn() -> bool + Send + Sync>;

pub async fn run_in_batches<T, F, Fut>(
    items: Vec<String>,
    worker: F,
    max_concurrent: usize,
    batch_size: usize,
    on_item: Option<OnItem>,
    should_cancel: Option<ShouldCancel>,
) -> HashMap<String, Result<T, String>>
where
    F: Fn(String) -> Fut + Send + Sync + 'static,
    Fut: Future<Output = Result<T, String>> + Send + 'static,
    T: Send + 'static,
{
    let max_concurrent = max_concurrent.max(1);
    let batch_size = batch_size.max(1);
    let sem = Arc::new(Semaphore::new(max_concurrent));
    let worker = Arc::new(worker);
    let mut results = HashMap::new();

    for chunk in items.chunks(batch_size) {
        if let Some(cancel) = &should_cancel {
            if cancel() {
                break;
            }
        }

        let mut handles = Vec::new();
        for item in chunk.iter().cloned() {
            let permit = sem.clone().acquire_owned().await.unwrap();
            let worker_fn = worker.clone();
            let handle = tokio::spawn(async move {
                let _permit = permit;
                let res = worker_fn(item.clone()).await;
                (item, res)
            });
            handles.push(handle);
        }

        for handle in handles {
            if let Ok((item, res)) = handle.await {
                if let Some(cb) = &on_item {
                    let ok = res.is_ok();
                    cb(item.clone(), ok).await;
                }
                results.insert(item, res);
            }
        }
    }

    results
}
