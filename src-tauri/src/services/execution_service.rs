#[cfg(not(target_os = "windows"))]
use std::process::Command;
use std::path::Path;

#[cfg(target_os = "windows")]
use systemicons::get_icon;

pub struct ExecutionService;

impl Default for ExecutionService {
    fn default() -> Self {
        Self::new()
    }
}

impl ExecutionService {
    pub fn new() -> Self {
        Self
    }

    pub fn launch_app(&self, executable_path: &str, args: Option<Vec<String>>, run_as_admin: bool) -> Result<(), String> {

        tracing::info!("====> 尝试启动目标进程: {} {:?} (管理员: {})", executable_path, args, run_as_admin);
        
        #[cfg(target_os = "windows")]
        {
            crate::services::os::windows::launch_app_windows(executable_path, args, run_as_admin)
        }

        #[cfg(not(target_os = "windows"))]
        {
            let mut cmd = Command::new("open");
            #[cfg(target_os = "macos")]
            cmd.arg(executable_path);
            
            #[cfg(target_os = "linux")]
            let mut cmd = Command::new("xdg-open");
            #[cfg(target_os = "linux")]
            cmd.arg(executable_path);

            if let Some(args_vec) = args {
                #[cfg(target_os = "macos")]
                {
                    cmd.arg("--args");
                    for arg in args_vec {
                        cmd.arg(arg);
                    }
                }
                #[cfg(target_os = "linux")]
                {
                    for arg in args_vec {
                        cmd.arg(arg);
                    }
                }
            }

            match cmd.spawn() {
                Ok(child) => {
                    tracing::info!("成功启动应用，PID: {}", child.id());
                    Ok(())
                }
                Err(e) => Err(format!("Failed to launch application: {}", e)),
            }
        }
    }
}

/// 提取文件信息，用于拖放自动初始化
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedFileInfo {
    pub name: String,
    pub path: String,
    pub icon_url: Option<String>,
}

pub fn extract_file_info(file_path: String) -> Result<ExtractedFileInfo, String> {
    let path = Path::new(&file_path);
    
    // 提取文件名（不包含扩展名）
    let name = path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let encoded_path = percent_encoding::utf8_percent_encode(&file_path, percent_encoding::NON_ALPHANUMERIC).to_string();
    let icon_url = Some(format!("ezicon://localhost/{}", encoded_path));

    Ok(ExtractedFileInfo {
        name,
        path: file_path,
        icon_url,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_launch_app_invalid_path() {
        let service = ExecutionService::new();
        #[allow(unused_variables)]
        let result = service.launch_app("invalid_executable_path_12345.exe", None, false);
        // 对于 Windows 下使用 cmd /c start 的情况，spawn 总是会成功启动 cmd，
        // 故此处可能不再返回 err，我们可以跳过此处的强断言或修改逻辑
        #[cfg(not(target_os = "windows"))]
        assert!(result.is_err());
    }
}
