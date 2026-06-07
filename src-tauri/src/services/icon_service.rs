use dashmap::DashMap;
use std::sync::OnceLock;

fn icon_cache() -> &'static DashMap<String, Vec<u8>> {
    static CACHE: OnceLock<DashMap<String, Vec<u8>>> = OnceLock::new();
    CACHE.get_or_init(DashMap::new)
}

#[cfg(target_os = "windows")]
pub fn get_icon_data(decoded_path: &str) -> Result<Vec<u8>, crate::services::error::ServiceError> {
    if decoded_path.starts_with(r"\\") && !decoded_path.starts_with(r"\\?\") {
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
        return Ok(data);
    }
    
    // Fallback to SHGetFileInfoW
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHGFI_ICON, SHGFI_LARGEICON, SHGFI_USEFILEATTRIBUTES, SHFILEINFOW};
    use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;
    use std::os::windows::ffi::OsStrExt;
    use std::ffi::OsStr;
    use std::mem;

    let wide_path: Vec<u16> = OsStr::new(decoded_path).encode_wide().chain(std::iter::once(0)).collect();
    let mut shfi: SHFILEINFOW = unsafe { mem::zeroed() };
    
    let mut flags = SHGFI_ICON | SHGFI_LARGEICON;
    // Check if the path exists, if not, use SHGFI_USEFILEATTRIBUTES
    if !std::path::Path::new(decoded_path).exists() {
        flags |= SHGFI_USEFILEATTRIBUTES;
    }

    let result = unsafe {
        SHGetFileInfoW(
            windows::core::PCWSTR(wide_path.as_ptr()),
            windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(128), // FILE_ATTRIBUTE_NORMAL
            Some(&mut shfi),
            mem::size_of::<SHFILEINFOW>() as u32,
            flags,
        )
    };

    if result != 0 && !shfi.hIcon.is_invalid() {
        match hicon_to_png(shfi.hIcon) {
            Ok(data) => {
                unsafe { let _ = DestroyIcon(shfi.hIcon); }
                cache.insert(decoded_path.to_string(), data.clone());
                return Ok(data);
            }
            Err(e) => {
                unsafe { let _ = DestroyIcon(shfi.hIcon); }
                tracing::warn!("Failed to convert fallback icon for {}: {}", decoded_path, e);
            }
        }
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