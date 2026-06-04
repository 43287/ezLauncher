use base64::Engine;
use base64::prelude::BASE64_STANDARD;
use std::path::Path;

/// 利用 Win32 API 提取 exe 的 HICON，转换为 base64 PNG
/// 此处使用 systemicons crate，它在 Windows 下封装了 Win32 API (SHGetFileInfoW / ExtractIcon) 
/// 来获取 HICON 并将其转换为 PNG 格式。
#[cfg(target_os = "windows")]
pub fn extract_icon_base64(path: &str) -> Result<String, String> {
    if !Path::new(path).exists() {
        return Err("File does not exist".to_string());
    }

    // 获取 256x256 图标
    match systemicons::get_icon(path, 256) {
        Ok(png_bytes) => {
            let b64 = BASE64_STANDARD.encode(&png_bytes);
            Ok(format!("data:image/png;base64,{}", b64))
        }
        Err(e) => Err(format!("Failed to extract icon using Win32 API: {:?}", e)),
    }
}

#[cfg(not(target_os = "windows"))]
pub fn extract_icon_base64(_path: &str) -> Result<String, String> {
    Err("Icon extraction is only supported on Windows".to_string())
}
