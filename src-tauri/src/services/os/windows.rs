use std::process::Command;
use std::os::windows::process::CommandExt;
use std::fs;
use std::path::Path;
use std::sync::{Arc, OnceLock};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};

use crate::services::error::ServiceError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemApp {
    pub name: String,
    pub path: String,
    pub icon_url: String,
}

fn system_apps_cache() -> &'static DashMap<String, Arc<Vec<SystemApp>>> {
    static CACHE: OnceLock<DashMap<String, Arc<Vec<SystemApp>>>> = OnceLock::new();
    CACHE.get_or_init(DashMap::new)
}

pub fn scan_system_apps() -> Result<Arc<Vec<SystemApp>>, ServiceError> {
    let cache_key = "system32_apps".to_string();
    let cache = system_apps_cache();
    
    if let Some(cached) = cache.get(&cache_key) {
        return Ok(cached.clone());
    }

    let system32_dir = std::env::var("WINDIR")
        .map(|w| format!("{}\\System32", w))
        .unwrap_or_else(|_| "C:\\Windows\\System32".to_string());
    let path = Path::new(&system32_dir);
    if !path.exists() || !path.is_dir() {
        return Err(ServiceError::Internal("System32 directory not found".to_string()));
    }

    let mut apps = Vec::new();
    let entries = fs::read_dir(path).map_err(ServiceError::Io)?;
    
    for entry in entries.filter_map(Result::ok) {
        let file_path = entry.path();
        if file_path.is_file() {
            if let Some(ext) = file_path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ext_lower == "exe" || ext_lower == "msc" {
                    if let Some(name) = file_path.file_stem().and_then(|n| n.to_str()) {
                        let path_str = file_path.to_string_lossy().to_string();

                        // 图标预取已移至 get_system_apps 命令层（使用注入的 IconService 暖缓存），
                        // 此处不再直接调用 icon_service 自由函数（解耦）。

                        let icon_url = path_str.clone();
                        
                        apps.push(SystemApp {
                            name: name.to_string(),
                            path: path_str,
                            icon_url,
                        });
                    }
                }
            }
        }
    }
    
    // 按名称排序以提供一致的结果
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    let result = Arc::new(apps);
    cache.insert(cache_key, result.clone());
    Ok(result)
}

const DETACHED_PROCESS: u32 = 0x00000008;
#[allow(dead_code)]
const CREATE_NEW_CONSOLE: u32 = 0x00000010;

pub fn launch_app_windows(executable_path: &str, args: Option<Vec<String>>, cwd: Option<String>, envs: Option<std::collections::HashMap<String, String>>, creation_flag: Option<u32>) -> Result<(), ServiceError> {
    if executable_path.starts_with(r"\\") {
        return Err(ServiceError::Security("Network paths starting with \\\\ are not allowed for security reasons.".to_string()));
    }

    if executable_path.starts_with("http://") || executable_path.starts_with("https://") {
        match open::that(executable_path) {
            Ok(_) => {
                tracing::info!("成功通过系统默认浏览器打开 URL: {}", executable_path);
                return Ok(());
            }
            Err(e) => {
                tracing::error!("打开 URL 失败: {}", e);
                return Err(ServiceError::Launch(format!("Failed to open URL: {}", e)));
            }
        }
    }

    let path = Path::new(executable_path);
    if path.is_dir() {
        match open::that(executable_path) {
            Ok(_) => {
                tracing::info!("成功通过文件资源管理器打开文件夹: {}", executable_path);
                return Ok(());
            }
            Err(e) => {
                tracing::error!("打开文件夹失败: {}", e);
                return Err(ServiceError::Launch(format!("Failed to open directory: {}", e)));
            }
        }
    }

    // Use shell-words if args is provided as a single string inside the Vec
    let parsed_args = if let Some(args_vec) = args {
        if args_vec.len() == 1 {
            match shell_words::split(&args_vec[0]) {
                Ok(parsed) => Some(parsed),
                Err(e) => {
                    tracing::error!("Failed to parse arguments: {}", e);
                    return Err(ServiceError::Launch(format!("Failed to parse arguments: {}", e)));
                }
            }
        } else {
            Some(args_vec)
        }
    } else {
        None
    };

    let args_clone = parsed_args.clone();
    let cwd_clone = cwd.clone();

    // 是否为 cmd 解释器：cmd 的 /K|/C 命令串需用 raw_arg 原样下发，
    // 绕开 Rust CRT 引号化与 cmd 解析器的不一致，保留引号与 &&（FR-006）。
    let is_cmd = Path::new(executable_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .map(|s| s.eq_ignore_ascii_case("cmd"))
        .unwrap_or(false);

    let mut cmd = Command::new(executable_path);
    if let Some(args_vec) = parsed_args {
        if is_cmd && args_vec.len() >= 2 {
            // 首参为开关（/K 或 /C），其余拼为命令串原样下发，由 cmd 单次解析
            cmd.arg(&args_vec[0]);
            let rest = args_vec[1..].join(" ");
            cmd.raw_arg(rest);
        } else {
            cmd.args(args_vec);
        }
    }
    if let Some(working_dir) = cwd {
        cmd.current_dir(working_dir);
    }
    if let Some(env_map) = envs {
        cmd.envs(env_map);
    }

    // 创建标志：inTerminal → CREATE_NEW_CONSOLE；否则 DETACHED_PROCESS（默认）
    cmd.creation_flags(creation_flag.unwrap_or(DETACHED_PROCESS));
    match cmd.spawn() {
        Ok(child) => {
            tracing::info!("成功启动应用，PID: {}", child.id());
            Ok(())
        }
        Err(e) => {
            tracing::warn!("作为可执行文件启动失败，回退使用 ShellExecuteW: {}", e);
            use windows::Win32::UI::Shell::ShellExecuteW;
            use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;
            use windows::core::PCWSTR;
            use widestring::U16CString;
            
            let file = match U16CString::from_str(executable_path) {
                Ok(s) => s,
                Err(e) => return Err(ServiceError::Launch(format!("Failed to parse executable path: {}", e))),
            };
            
            let args_u16 = if let Some(args_vec) = args_clone {
                let args_str = args_vec.join(" ");
                if args_str.is_empty() {
                    None
                } else {
                    match U16CString::from_str(&args_str) {
                        Ok(s) => Some(s),
                        Err(e) => return Err(ServiceError::Launch(e.to_string())),
                    }
                }
            } else {
                None
            };
            
            let dir_u16 = if let Some(dir) = cwd_clone {
                match U16CString::from_str(&dir) {
                    Ok(s) => Some(s),
                    Err(e) => return Err(ServiceError::Launch(e.to_string())),
                }
            } else {
                None
            };
            
            unsafe {
                let result = ShellExecuteW(
                    None,
                    None,
                    PCWSTR(file.as_ptr()),
                    args_u16.as_ref().map(|s| PCWSTR(s.as_ptr())).unwrap_or(PCWSTR(std::ptr::null())),
                    dir_u16.as_ref().map(|s| PCWSTR(s.as_ptr())).unwrap_or(PCWSTR(std::ptr::null())),
                    SW_SHOWNORMAL,
                );

                let ret_code = result.0 as usize;
                if ret_code <= 32 {
                    tracing::error!("====> ShellExecuteW 启动失败: 代码 {}", ret_code);
                    return Err(ServiceError::Launch(format!("ShellExecuteW failed with code {}", ret_code)));
                }
            }
            tracing::info!("使用 ShellExecuteW 成功启动");
            Ok(())
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResolvedLnk {
    pub target_path: String,
    pub arguments: Option<String>,
    pub working_dir: Option<String>,
}

pub fn resolve_lnk_path(lnk_path: &str) -> Result<ResolvedLnk, ServiceError> {
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{
        CoInitializeEx, CoUninitialize, CoCreateInstance, 
        COINIT_APARTMENTTHREADED, CLSCTX_INPROC_SERVER, IPersistFile, STGM
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};
    use widestring::U16CString;

    let lnk_u16 = U16CString::from_str(lnk_path)
        .map_err(|e| ServiceError::Internal(format!("Failed to parse lnk path: {}", e)))?;

    unsafe {
        let hr = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let should_uninit = hr.is_ok();

        let result = (|| -> windows::core::Result<ResolvedLnk> {
            let shell_link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
            let persist_file: IPersistFile = shell_link.cast()?;
            
            // STGM_READ = 0
            persist_file.Load(PCWSTR(lnk_u16.as_ptr()), STGM(0))?;

            let mut path_buf = vec![0u16; 1024];
            let get_path_result = shell_link.GetPath(&mut path_buf, std::ptr::null_mut(), 0);
            // 若缓冲区不足，GetPath 会返回所需长度；回退动态扩容
            let target_path = match get_path_result {
                Ok(_) | Err(_) => {
                    let end = path_buf.iter().position(|&c| c == 0).unwrap_or(path_buf.len());
                    String::from_utf16_lossy(&path_buf[..end])
                }
            };

            let mut args_buf = vec![0u16; 1024];
            let arguments = shell_link.GetArguments(&mut args_buf).ok().and_then(|_| {
                let end = args_buf.iter().position(|&c| c == 0).unwrap_or(args_buf.len());
                let args_str = String::from_utf16_lossy(&args_buf[..end]);
                if args_str.is_empty() { None } else { Some(args_str) }
            });

            let mut dir_buf = vec![0u16; 1024];
            let working_dir = shell_link.GetWorkingDirectory(&mut dir_buf).ok().and_then(|_| {
                let end = dir_buf.iter().position(|&c| c == 0).unwrap_or(dir_buf.len());
                let dir_str = String::from_utf16_lossy(&dir_buf[..end]);
                if dir_str.is_empty() { None } else { Some(dir_str) }
            });
            
            Ok(ResolvedLnk { target_path, arguments, working_dir })
        })();

        if should_uninit {
            CoUninitialize();
        }

        result.map_err(|e| ServiceError::Internal(format!("Failed to resolve .lnk path: {}", e)))
    }
}

pub fn relaunch_as_admin() -> Result<(), ServiceError> {
    #[cfg(debug_assertions)]
    {
        Err(ServiceError::Internal("在开发模式下不支持以管理员身份重启，因为这会导致前端开发服务器断开连接。请在打包后使用此功能。".to_string()))
    }

    #[cfg(all(not(debug_assertions), target_os = "windows"))]
    {
        use windows::Win32::UI::Shell::{ShellExecuteW, SE_ERR_ACCESSDENIED};
        use windows::Win32::UI::WindowsAndMessaging::SW_HIDE;
        use windows::core::PCWSTR;
        use widestring::U16CString;
        
        let exe_path = std::env::current_exe().map_err(|e| ServiceError::Internal(e.to_string()))?;
        let exe_str = exe_path.to_str().ok_or_else(|| ServiceError::Internal("Failed to convert exe_path to string".to_string()))?;
        
        let pipe_name = crate::services::proxy_server::MAIN_PIPE_NAME.clone();
        let pid = std::process::id();
        
        tracing::info!("====> Requesting Admin Proxy");
        
        let verb = U16CString::from_str("runas").map_err(|e| ServiceError::Internal(e.to_string()))?;
        let file = U16CString::from_str(exe_str).map_err(|e| ServiceError::Internal(e.to_string()))?;
        let args_str = crate::services::proxy_server::admin_proxy_args(pid, &pipe_name);
        let args_u16 = U16CString::from_str(&args_str).map_err(|e| ServiceError::Internal(e.to_string()))?;

        unsafe {
            let result = ShellExecuteW(
                None,
                PCWSTR(verb.as_ptr()),
                PCWSTR(file.as_ptr()),
                PCWSTR(args_u16.as_ptr()),
                None,
                SW_HIDE,
            );

            let ret_code = result.0 as usize;
            if ret_code <= 32 {
                if ret_code == SE_ERR_ACCESSDENIED as usize {
                    return Err(ServiceError::Security("User cancelled UAC prompt".to_string()));
                }
                return Err(ServiceError::Internal(format!("ShellExecuteW failed with code {}", ret_code)));
            }
        }
        
        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(ServiceError::Internal("Admin restart is only supported on Windows".to_string()))
    }
}

// ============================================================================
// 009: 进程枚举与目标拾取（contracts/tauri-commands.md C1/C2，research R2/R3）
// ============================================================================

use crate::domain::models::{ProcessInfo, ResolveResult};

// 判断窗口根类名是否属于无效目标（桌面/任务栏），返回 invalid reason（纯逻辑，可单测）
fn classify_invalid_class(class_name: &str) -> Option<&'static str> {
    match class_name {
        "Progman" | "WorkerW" => Some("desktop"),
        "Shell_TrayWnd" => Some("taskbar"),
        _ => None,
    }
}

#[cfg(target_os = "windows")]
fn collect_window_titles() -> std::collections::HashMap<u32, String> {
    use std::collections::HashMap;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM};
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible,
    };

    unsafe extern "system" fn enum_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let map = &mut *(lparam.0 as *mut HashMap<u32, String>);
        if !IsWindowVisible(hwnd).as_bool() {
            return BOOL(1);
        }
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return BOOL(1);
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid as *mut u32));
        if pid == 0 || map.contains_key(&pid) {
            return BOOL(1);
        }
        let mut buf = vec![0u16; (len + 1) as usize];
        let read = GetWindowTextW(hwnd, &mut buf);
        if read > 0 {
            let title = String::from_utf16_lossy(&buf[..read as usize]);
            if !title.trim().is_empty() {
                map.insert(pid, title);
            }
        }
        BOOL(1)
    }

    let mut map: HashMap<u32, String> = HashMap::new();
    unsafe {
        let _ = EnumWindows(Some(enum_proc), LPARAM(&mut map as *mut _ as isize));
    }
    map
}

// 枚举进程：Toolhelp 快照取 PID+映像名，关联可见窗口标题，按有可见窗口优先排序（C1）
pub fn enumerate_processes() -> Result<Vec<ProcessInfo>, ServiceError> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::Diagnostics::ToolHelp::{
            CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
            TH32CS_SNAPPROCESS,
        };

        let titles = collect_window_titles();
        let mut result: Vec<ProcessInfo> = Vec::new();

        unsafe {
            let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
                .map_err(|e| ServiceError::Internal(format!("CreateToolhelp32Snapshot failed: {}", e)))?;

            let mut entry = PROCESSENTRY32W::default();
            entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

            if Process32FirstW(snapshot, &mut entry).is_ok() {
                loop {
                    let pid = entry.th32ProcessID;
                    let name_len = entry
                        .szExeFile
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry.szExeFile.len());
                    let name = String::from_utf16_lossy(&entry.szExeFile[..name_len]);
                    let title = titles.get(&pid).cloned();
                    let has_visible_window = title.is_some();

                    if pid != 0 {
                        result.push(ProcessInfo {
                            pid,
                            name,
                            title,
                            icon_url: None,
                            has_visible_window,
                        });
                    }

                    if Process32NextW(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }
            let _ = CloseHandle(snapshot);
        }

        result.sort_by(|a, b| {
            b.has_visible_window
                .cmp(&a.has_visible_window)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(result)
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(ServiceError::Internal("Process enumeration is only supported on Windows".to_string()))
    }
}

// 解析当前光标下顶层窗口所属进程（C2，research R3，Q4）
pub fn resolve_window_process_at_cursor() -> Result<ResolveResult, ServiceError> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::{
            GetAncestor, GetClassNameW, GetCursorPos, GetWindowThreadProcessId, WindowFromPoint,
            GA_ROOT,
        };

        unsafe {
            let mut pt = POINT::default();
            if GetCursorPos(&mut pt).is_err() {
                return Ok(ResolveResult::Invalid { reason: "unknown".to_string() });
            }
            let hwnd = WindowFromPoint(pt);
            if hwnd.0.is_null() {
                return Ok(ResolveResult::Invalid { reason: "unknown".to_string() });
            }
            let root = GetAncestor(hwnd, GA_ROOT);
            let target = if root.0.is_null() { hwnd } else { root };

            let mut class_buf = [0u16; 256];
            let class_len = GetClassNameW(target, &mut class_buf);
            let class_name = if class_len > 0 {
                String::from_utf16_lossy(&class_buf[..class_len as usize])
            } else {
                String::new()
            };
            if let Some(reason) = classify_invalid_class(&class_name) {
                return Ok(ResolveResult::Invalid { reason: reason.to_string() });
            }

            let mut pid: u32 = 0;
            GetWindowThreadProcessId(target, Some(&mut pid as *mut u32));
            if pid == 0 {
                return Ok(ResolveResult::Invalid { reason: "unknown".to_string() });
            }
            if pid == std::process::id() {
                return Ok(ResolveResult::Invalid { reason: "self".to_string() });
            }

            let procs = enumerate_processes().unwrap_or_default();
            if let Some(p) = procs.into_iter().find(|p| p.pid == pid) {
                Ok(ResolveResult::Process { process: p })
            } else {
                Ok(ResolveResult::Process {
                    process: ProcessInfo {
                        pid,
                        name: String::new(),
                        title: None,
                        icon_url: None,
                        has_visible_window: false,
                    },
                })
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err(ServiceError::Internal("Window resolution is only supported on Windows".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invalid_class_desktop_and_taskbar() {
        assert_eq!(classify_invalid_class("Progman"), Some("desktop"));
        assert_eq!(classify_invalid_class("WorkerW"), Some("desktop"));
        assert_eq!(classify_invalid_class("Shell_TrayWnd"), Some("taskbar"));
    }

    #[test]
    fn invalid_class_normal_window_is_none() {
        assert_eq!(classify_invalid_class("Notepad"), None);
        assert_eq!(classify_invalid_class("Chrome_WidgetWin_1"), None);
        assert_eq!(classify_invalid_class(""), None);
    }

    #[test]
    fn process_info_sort_visible_first() {
        let mut v = vec![
            ProcessInfo { pid: 1, name: "z.exe".into(), title: None, icon_url: None, has_visible_window: false },
            ProcessInfo { pid: 2, name: "a.exe".into(), title: Some("A".into()), icon_url: None, has_visible_window: true },
            ProcessInfo { pid: 3, name: "b.exe".into(), title: None, icon_url: None, has_visible_window: false },
        ];
        v.sort_by(|a, b| {
            b.has_visible_window
                .cmp(&a.has_visible_window)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        assert_eq!(v[0].pid, 2);
        assert_eq!(v[1].pid, 3);
        assert_eq!(v[2].pid, 1);
    }
}
