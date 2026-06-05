use tauri::{App, Manager};

pub fn setup_window(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("main") {
            let hwnd = window.hwnd().unwrap().0 as isize;
            use windows::Win32::Foundation::HWND;
            use windows::Win32::UI::WindowsAndMessaging::{
                ChangeWindowMessageFilterEx, MSGFLT_ALLOW,
            };
            let hwnd = HWND(hwnd as *mut _);
            const WM_DROPFILES: u32 = 0x0233;
            const WM_COPYDATA: u32 = 0x004A;
            const WM_COPYGLOBALDATA: u32 = 0x0049;

            unsafe {
                let _ = ChangeWindowMessageFilterEx(hwnd, WM_DROPFILES, MSGFLT_ALLOW, None);
                let _ = ChangeWindowMessageFilterEx(hwnd, WM_COPYDATA, MSGFLT_ALLOW, None);
                let _ = ChangeWindowMessageFilterEx(hwnd, WM_COPYGLOBALDATA, MSGFLT_ALLOW, None);
            }
            tracing::info!("====> 已尝试为管理员窗口豁免拖放相关消息 (WM_DROPFILES, WM_COPYDATA, WM_COPYGLOBALDATA)");
        }
    }
    Ok(())
}
