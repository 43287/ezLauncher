use serde::{Serialize, Serializer};
use thiserror::Error;
use crate::services::error::ServiceError;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("I/O Error: {0}")]
    Io(#[from] std::io::Error),
    
    #[error("Crypto Error: {0}")]
    Crypto(String),

    #[error("Tauri Error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("Execution Error: {0}")]
    Execution(String),

    #[error("Service Error: {0}")]
    Service(#[from] ServiceError),

    #[error("Other Error: {0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;
        
        let code = match self {
            AppError::Io(_) => "IO_ERROR",
            AppError::Crypto(_) => "CRYPTO_ERROR",
            AppError::Tauri(_) => "TAURI_ERROR",
            AppError::Execution(_) => "EXECUTION_ERROR",
            AppError::Service(ref se) => match se {
                ServiceError::Io(_) => "IO_ERROR",
                ServiceError::Serialization(_) => "SERIALIZATION_ERROR",
                ServiceError::Security(_) => "SECURITY_VIOLATION",
                ServiceError::Proxy(_) => "PROXY_ERROR",
                ServiceError::Concurrency(_) => "CONCURRENCY_ERROR",
                ServiceError::Crypto(_) => "CRYPTO_ERROR",
                ServiceError::Launch(_) => "LAUNCH_ERROR",
                ServiceError::Internal(_) => "INTERNAL_ERROR",
                ServiceError::Parse(_) => "PARSE_ERROR",
            },
            AppError::Other(_) => "UNKNOWN_ERROR",
        };

        state.serialize_field("code", code)?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

// 方便直接从 String 转换
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Other(s)
    }
}

// 方便直接从 &str 转换
impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Other(s.to_string())
    }
}
