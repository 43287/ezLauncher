use dashmap::DashMap;
use std::sync::OnceLock;

fn icon_cache() -> &'static DashMap<String, Vec<u8>> {
    static CACHE: OnceLock<DashMap<String, Vec<u8>>> = OnceLock::new();
    CACHE.get_or_init(DashMap::new)
}

#[cfg(target_os = "windows")]
pub fn get_icon_data(decoded_path: &str) -> Vec<u8> {
    let cache = icon_cache();
    
    if let Some(cached) = cache.get(decoded_path) {
        return cached.clone();
    }
    
    if let Ok(data) = systemicons::get_icon(decoded_path, 32) {
        cache.insert(decoded_path.to_string(), data.clone());
        data
    } else {
        tracing::warn!("Failed to extract icon for {}", decoded_path);
        vec![]
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_icon_data(_decoded_path: &str) -> Vec<u8> {
    vec![]
}