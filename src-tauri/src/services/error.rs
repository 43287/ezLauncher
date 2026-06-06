use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Proxy error: {0}")]
    Proxy(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Launch failed: {0}")]
    Launch(String),

    #[error("Security violation: {0}")]
    Security(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Concurrency error: {0}")]
    Concurrency(String),
}
