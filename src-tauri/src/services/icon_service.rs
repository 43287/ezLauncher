use dashmap::DashMap;
use std::sync::OnceLock;
use std::path::{Path, PathBuf};
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;

fn icon_cache() -> &'static DashMap<String, Vec<u8>> {
    static CACHE: OnceLock<DashMap<String, Vec<u8>>> = OnceLock::new();
    CACHE.get_or_init(DashMap::new)
}

fn get_cache_dir() -> PathBuf {
    let mut dir = std::env::current_dir().unwrap_or_default();
    dir.push("data");
    dir.push("icon");
    dir.push("cache");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

fn get_custom_dir() -> PathBuf {
    let mut dir = std::env::current_dir().unwrap_or_default();
    dir.push("data");
    dir.push("icon");
    dir.push("custom");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

#[tauri::command]
pub async fn copy_custom_icon(src_path: String) -> Result<String, String> {
    let path = Path::new(&src_path);
    if !path.exists() || !path.is_file() {
        return Err("Source file does not exist".into());
    }
    
    let custom_dir = get_custom_dir();
    
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let file_name = format!("{}.{}", timestamp, ext);
    let dest_path = custom_dir.join(&file_name);
    
    std::fs::copy(&path, &dest_path).map_err(|e| e.to_string())?;
    
    Ok(format!("ezicon://custom/{}", file_name))
}

#[cfg(target_os = "windows")]
pub async fn get_icon_data(decoded_path: &str) -> Result<Vec<u8>, crate::services::error::ServiceError> {
    if decoded_path.starts_with("custom/") {
        let file_name = decoded_path.strip_prefix("custom/").unwrap();
        let custom_dir = get_custom_dir();
        let file_path = custom_dir.join(file_name);
        if let Ok(data) = tokio::fs::read(&file_path).await {
            return Ok(data);
        }
        return Err(crate::services::error::ServiceError::Internal(format!("Custom icon not found: {}", decoded_path)));
    }

    if decoded_path.starts_with(r"\\") && !decoded_path.starts_with(r"\\?\") {
        let err_msg = format!("UNC paths are not allowed for icon extraction: {}", decoded_path);
        tracing::warn!("{}", err_msg);
        return Err(crate::services::error::ServiceError::Security(err_msg));
    }

    let cache = icon_cache();
    if let Some(cached) = cache.get(decoded_path) {
        return Ok(cached.clone());
    }
    
    // Check disk cache
    let mut hasher = DefaultHasher::new();
    decoded_path.hash(&mut hasher);
    let hash = hasher.finish();
    let cache_file_name = format!("{:x}.png", hash);
    let cache_dir = get_cache_dir();
    let cache_path = cache_dir.join(&cache_file_name);
    
    if let Ok(data) = tokio::fs::read(&cache_path).await {
        cache.insert(decoded_path.to_string(), data.clone());
        return Ok(data);
    }
    
    let path_clone = decoded_path.to_string();
    let data = tokio::task::spawn_blocking(move || {
        extract_icon_sync(&path_clone)
    }).await.map_err(|e| crate::services::error::ServiceError::Internal(e.to_string()))??;
    
    cache.insert(decoded_path.to_string(), data.clone());
    let _ = tokio::fs::write(&cache_path, &data).await;
    
    Ok(data)
}

#[cfg(target_os = "windows")]
fn extract_icon_sync(decoded_path: &str) -> Result<Vec<u8>, crate::services::error::ServiceError> {
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHGetImageList, SHGFI_SYSICONINDEX, SHGFI_USEFILEATTRIBUTES, SHFILEINFOW, SHIL_EXTRALARGE};
    use windows::Win32::UI::Controls::{IImageList, ILD_TRANSPARENT};
    use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;
    use std::os::windows::ffi::OsStrExt;
    use std::ffi::OsStr;
    use std::mem;

    let wide_path: Vec<u16> = OsStr::new(decoded_path).encode_wide().chain(std::iter::once(0)).collect();
    let mut shfi: SHFILEINFOW = unsafe { mem::zeroed() };
    
    let mut flags = SHGFI_SYSICONINDEX;
    if !std::path::Path::new(decoded_path).exists() {
        flags |= SHGFI_USEFILEATTRIBUTES;
    }

    let result = unsafe {
        SHGetFileInfoW(
            windows::core::PCWSTR(wide_path.as_ptr()),
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(128),
            Some(&mut shfi),
            mem::size_of::<SHFILEINFOW>() as u32,
            flags,
        )
    };

    if result != 0 {
        let index = shfi.iIcon;
        unsafe {
            if let Ok(image_list) = SHGetImageList::<IImageList>(SHIL_EXTRALARGE as i32) {
                if let Ok(hicon) = image_list.GetIcon(index, ILD_TRANSPARENT.0 as u32) {
                    if !hicon.is_invalid() {
                        let res = hicon_to_png(hicon);
                        let _ = DestroyIcon(hicon);
                        if let Ok(data) = res {
                            return Ok(data);
                        }
                    }
                }
            }
        }
    }
    
    if let Ok(data) = systemicons::get_icon(decoded_path, 256) {
        return Ok(data);
    }
    if let Ok(data) = systemicons::get_icon(decoded_path, 32) {
        return Ok(data);
    }

    let err_msg = format!("Failed to extract icon for {}", decoded_path);
    tracing::warn!("{}", err_msg);
    Err(crate::services::error::ServiceError::Internal(err_msg))
}

#[cfg(target_os = "windows")]
fn hicon_to_png(hicon: windows::Win32::UI::WindowsAndMessaging::HICON) -> Result<Vec<u8>, String> {
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HDC
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetIconInfo, ICONINFO};
    use image::codecs::png::PngEncoder;
    use image::ColorType;
    use std::mem;

    unsafe {
        let mut icon_info: ICONINFO = mem::zeroed();
        if GetIconInfo(hicon, &mut icon_info).is_err() {
            return Err("Failed to GetIconInfo".into());
        }

        let has_color = !icon_info.hbmColor.is_invalid();
        
        let cleanup = || {
            if !icon_info.hbmColor.is_invalid() {
                let _ = DeleteObject(icon_info.hbmColor);
            }
            if !icon_info.hbmMask.is_invalid() {
                let _ = DeleteObject(icon_info.hbmMask);
            }
        };

        if !has_color {
            cleanup();
            return Err("No color bitmap in icon".into());
        }

        let mut bmp: BITMAP = mem::zeroed();
        if GetObjectW(
            icon_info.hbmColor,
            mem::size_of::<BITMAP>() as i32,
            Some(&mut bmp as *mut BITMAP as *mut std::ffi::c_void)
        ) == 0 {
            cleanup();
            return Err("Failed to GetObjectW for color bitmap".into());
        }

        let width = bmp.bmWidth;
        let height = bmp.bmHeight;
        if width <= 0 || height <= 0 {
            cleanup();
            return Err("Invalid bitmap dimensions".into());
        }

        let dc = CreateCompatibleDC(HDC::default());
        if dc.is_invalid() {
            cleanup();
            return Err("Failed to create compatible DC".into());
        }

        let mut bmi: BITMAPINFO = mem::zeroed();
        bmi.bmiHeader.biSize = mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height; // negative to get top-down DIB
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = BI_RGB.0;

        let mut pixels: Vec<u8> = vec![0; (width * height * 4) as usize];

        let scan_lines = GetDIBits(
            dc,
            icon_info.hbmColor,
            0,
            height as u32,
            Some(pixels.as_mut_ptr() as *mut _),
            &mut bmi,
            DIB_RGB_COLORS
        );

        let _ = DeleteDC(dc);
        cleanup();

        if scan_lines == 0 || scan_lines != height {
            return Err("Failed to GetDIBits".into());
        }

        // Convert BGRA to RGBA and check for alpha
        let mut has_alpha = false;
        for i in (0..pixels.len()).step_by(4) {
            if pixels[i + 3] != 0 {
                has_alpha = true;
                break;
            }
        }

        for i in (0..pixels.len()).step_by(4) {
            let b = pixels[i];
            let g = pixels[i + 1];
            let r = pixels[i + 2];
            let a = if has_alpha { pixels[i + 3] } else { 255 };

            pixels[i] = r;
            pixels[i + 1] = g;
            pixels[i + 2] = b;
            pixels[i + 3] = a;
        }

        let mut png_data = Vec::new();
        let encoder = PngEncoder::new(&mut png_data);
        if let Err(e) = image::ImageEncoder::write_image(encoder, &pixels, width as u32, height as u32, ColorType::Rgba8.into()) {
            return Err(format!("Failed to encode PNG: {}", e));
        }

        Ok(png_data)
    }
}

#[cfg(not(target_os = "windows"))]
pub fn get_icon_data(_decoded_path: &str) -> Result<Vec<u8>, crate::services::error::ServiceError> {
    Err(crate::services::error::ServiceError::Internal("Not supported on this OS".to_string()))
}