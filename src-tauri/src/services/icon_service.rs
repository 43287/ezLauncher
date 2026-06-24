use dashmap::DashMap;
use std::path::{Path, PathBuf};
use std::hash::{Hash, Hasher};
use std::collections::hash_map::DefaultHasher;
use crate::services::error::ServiceError;

// 图标服务：内存缓存（DashMap）作为实例字段持有，经 trait 注入与管理（FR-010）。
#[async_trait::async_trait]
pub trait IconServiceTrait: Send + Sync {
    async fn get_icon_data(&self, decoded_path: &str) -> Result<Vec<u8>, ServiceError>;
}

pub struct IconService {
    cache: DashMap<String, Vec<u8>>,
}

impl Default for IconService {
    fn default() -> Self {
        Self::new()
    }
}

impl IconService {
    pub fn new() -> Self {
        Self {
            cache: DashMap::new(),
        }
    }
}

// 图标数据基址：用 exe 所在目录而非当前工作目录（CWD），避免读写目录漂移、
// 也不污染任意 CWD（FR-024）。回退到 current_dir 仅为极端情况兜底。
fn get_data_base_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_default()
}

fn get_cache_dir() -> PathBuf {
    let mut dir = get_data_base_dir();
    dir.push("data");
    dir.push("icon");
    dir.push("cache");
    if !dir.exists() {
        let _ = std::fs::create_dir_all(&dir);
    }
    dir
}

fn get_custom_dir() -> PathBuf {
    let mut dir = get_data_base_dir();
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

    // FR-004: 拒绝超过 10 MB 的源文件
    const MAX_SIZE: u64 = 10 * 1024 * 1024;
    let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    if file_size > MAX_SIZE {
        return Err(format!("File too large: {} bytes (max {})", file_size, MAX_SIZE));
    }
    
    let custom_dir = get_custom_dir();
    
    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("png");
    // 守卫时间戳：时钟早于 UNIX_EPOCH 时不再 panic（FR-017）
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("System clock error: {}", e))?
        .as_millis();
    let file_name = format!("{}.{}", timestamp, ext);
    let dest_path = custom_dir.join(&file_name);
    
    std::fs::copy(path, &dest_path).map_err(|e| e.to_string())?;
    
    Ok(format!("ezicon://custom/{}", file_name))
}

#[cfg(target_os = "windows")]
#[async_trait::async_trait]
impl IconServiceTrait for IconService {
    async fn get_icon_data(&self, decoded_path: &str) -> Result<Vec<u8>, ServiceError> {
        if decoded_path.starts_with("custom/") {
            let file_name = decoded_path.strip_prefix("custom/")
                .ok_or_else(|| ServiceError::Internal("Invalid custom icon path prefix".into()))?;
            let custom_dir = get_custom_dir();
            let file_path = custom_dir.join(file_name);

            // 路径穿越防御：规范化后验证仍在 custom 目录内（FR-001）
            let canonical_file = file_path.canonicalize().map_err(|e| {
                ServiceError::Security(format!("Cannot resolve custom icon path: {}", e))
            })?;
            let canonical_base = custom_dir.canonicalize().unwrap_or_else(|_| custom_dir.clone());
            if !canonical_file.starts_with(&canonical_base) {
                return Err(ServiceError::Security("Path traversal detected in custom icon path".into()));
            }

            let data = tokio::fs::read(&canonical_file).await.map_err(|e| {
                ServiceError::Internal(format!("Failed to read custom icon: {}", e))
            })?;
            return Ok(data);
        }

        if decoded_path.starts_with(r"\\") && !decoded_path.starts_with(r"\\?\") {
            let err_msg = format!("UNC paths are not allowed for icon extraction: {}", decoded_path);
            tracing::warn!("{}", err_msg);
            return Err(ServiceError::Security(err_msg));
        }

        // 通用分支收敛（FR-012）：仅对【已存在】的本地路径取图标，拒绝任意不存在路径，
        // 缩小“前端任意路径 → SHGetFileInfoW”的信息披露面。
        if !Path::new(decoded_path).exists() {
            return Err(ServiceError::Security(format!(
                "Icon path does not exist or is not accessible: {}",
                decoded_path
            )));
        }

        if let Some(cached) = self.cache.get(decoded_path) {
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
            self.cache.insert(decoded_path.to_string(), data.clone());
            return Ok(data);
        }

        let path_clone = decoded_path.to_string();
        let data = tokio::task::spawn_blocking(move || {
            extract_icon_sync(&path_clone)
        }).await.map_err(|e| ServiceError::Internal(e.to_string()))??;

        self.cache.insert(decoded_path.to_string(), data.clone());
        let _ = tokio::fs::write(&cache_path, &data).await;

        Ok(data)
    }
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
                if let Ok(hicon) = image_list.GetIcon(index, ILD_TRANSPARENT.0) {
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
        if let Err(e) = image::ImageEncoder::write_image(encoder, &pixels, width as u32, height as u32, ColorType::Rgba8) {
            return Err(format!("Failed to encode PNG: {}", e));
        }

        Ok(png_data)
    }
}

#[cfg(not(target_os = "windows"))]
#[async_trait::async_trait]
impl IconServiceTrait for IconService {
    async fn get_icon_data(&self, _decoded_path: &str) -> Result<Vec<u8>, ServiceError> {
        Err(ServiceError::Internal("Not supported on this OS".to_string()))
    }
}