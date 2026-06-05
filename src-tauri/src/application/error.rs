use serde::Serialize;
use thiserror::Error;

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

    #[error("Other Error: {0}")]
    Other(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        // 简单地序列化为错误字符串，前端可以直接捕获并显示
        serializer.serialize_str(&self.to_string())
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
