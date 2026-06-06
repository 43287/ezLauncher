use dashmap::DashMap;
use std::sync::OnceLock;

fn icon_cache() -> &'static DashMap<String, Vec<u8>> {
    static CACHE: OnceLock<DashMap<String, Vec<u8>>> = OnceLock::new();
    CACHE.get_or_init(DashMap::new)
}

#[cfg(target_os = "windows")]
pub fn get_icon_data(decoded_path: &str) -> Result<Vec<u8>, crate::services::error::ServiceError> {
    if decoded_path.starts_with(r"\\") {
        let err_msg = format!("UNC paths are not allowed for icon extraction: {}", decoded_path);
        tracing::warn!("{}", err_msg);
        return Err(crate::services::error::ServiceError::Security(err_msg));
    }

    let cache = icon_cache();
    
    if let Some(cached) = cache.get(decoded_path) {
        return Ok(cached.clone());
    }
    
    if let Ok(data) = systemicons::get_icon(decoded_path, 32) {
        cache.insert(decoded_path.to_string(), data.clone());
        Ok(data)
    } else {
        let err_msg = format!("Failed to extract icon for {}", decoded_path);
        tracing::warn!("{}", err_msg);
        Err(crate::services::error::ServiceError::Internal(err_msg))
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_icon_data(_decoded_path: &str) -> Result<Vec<u8>, crate::services::error::ServiceError> {
    Err(crate::services::error::ServiceError::Internal("Not supported on this OS".to_string()))
}