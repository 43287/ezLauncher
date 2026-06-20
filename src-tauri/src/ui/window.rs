use tauri::{App, Manager};
use std::sync::atomic::{AtomicIsize, Ordering};

#[cfg(target_os = "windows")]
static OLD_WNDPROC: AtomicIsize = AtomicIsize::new(0);

#[cfg(target_os = "windows")]
unsafe extern "system" fn hook_wndproc(
    hwnd: windows::Win32::Foundation::HWND,
    msg: u32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::UI::WindowsAndMessaging::{
        CallWindowProcW, WNDPROC, WM_SYSCOMMAND, SC_KEYMENU,
    };

    if msg == WM_SYSCOMMAND {
        let sys_cmd = (wparam.0 & 0xFFF0) as u32;
        if sys_cmd == SC_KEYMENU {
            // 仅仅在这里屏蔽了 Alt 的系统菜单激活，并没有阻止 rdev 对按键的监听。
            // 但如果这里屏蔽会导致按键无法传递回应用，我们返回 0 阻止系统默认行为。
            return windows::Win32::Foundation::LRESULT(0);
        }
    }

    let old_proc_ptr = OLD_WNDPROC.load(Ordering::Relaxed);
    if old_proc_ptr != 0 {
        let old_proc: WNDPROC = std::mem::transmute(old_proc_ptr);
        CallWindowProcW(old_proc, hwnd, msg, wparam, lparam)
    } else {
        windows::Win32::UI::WindowsAndMessaging::DefWindowProcW(hwnd, msg, wparam, lparam)
    }
}

pub fn setup_window(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        if let Some(window) = app.get_webview_window("main") {
            let hwnd = window.hwnd().unwrap().0 as isize;
            use windows::Win32::Foundation::HWND;
            use windows::Win32::UI::WindowsAndMessaging::{
                ChangeWindowMessageFilterEx, MSGFLT_ALLOW, SetWindowLongPtrW, GWLP_WNDPROC
            };
            let hwnd = HWND(hwnd as *mut _);
            const WM_DROPFILES: u32 = 0x0233;
            const WM_COPYDATA: u32 = 0x004A;
            const WM_COPYGLOBALDATA: u32 = 0x0049;

            unsafe {
                let _ = ChangeWindowMessageFilterEx(hwnd, WM_DROPFILES, MSGFLT_ALLOW, None);
                let _ = ChangeWindowMessageFilterEx(hwnd, WM_COPYDATA, MSGFLT_ALLOW, None);
                let _ = ChangeWindowMessageFilterEx(hwnd, WM_COPYGLOBALDATA, MSGFLT_ALLOW, None);
                
                // Set WndProc Hook to block ALT key menu
                let old_proc = SetWindowLongPtrW(hwnd, GWLP_WNDPROC, hook_wndproc as usize as isize);
                if old_proc != 0 {
                    OLD_WNDPROC.store(old_proc, Ordering::Relaxed);
                    tracing::info!("====> WndProc Hook installed successfully");
                } else {
                    tracing::error!("====> Failed to install WndProc Hook");
                }
            }
            tracing::info!("====> 已尝试为管理员窗口豁免拖放相关消息 (WM_DROPFILES, WM_COPYDATA, WM_COPYGLOBALDATA)");
        }
    }
    Ok(())
}

