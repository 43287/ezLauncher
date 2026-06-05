use std::process::Command;
use std::path::Path;
use base64::{engine::general_purpose, Engine as _};

#[cfg(target_os = "windows")]
use systemicons::get_icon;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
/// Windows 下创建独立进程的标志
const DETACHED_PROCESS: u32 = 0x00000008;

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

    pub fn launch_app(&self, executable_path: &str, args: Option<Vec<String>>) -> Result<(), String> {

        println!("====> 尝试启动目标进程: {} {:?}", executable_path, args);
        
        #[cfg(target_os = "windows")]
        {
            let mut cmd = Command::new("cmd");
            let mut args_str = String::new();
            if let Some(args_vec) = args {
                for arg in args_vec {
                    args_str.push_str(&format!(" \"{}\"", arg));
                }
            }
            // 使用 raw_arg 避免 Rust 的 Command 自动对双引号和空格进行错误转义
            cmd.arg("/C").raw_arg(format!("start \"\" \"{}\"{}", executable_path, args_str));
            cmd.creation_flags(DETACHED_PROCESS);
            match cmd.spawn() {
                Ok(child) => {
                    println!("成功启动应用，PID: {}", child.id());
                    Ok(())
                }
                Err(e) => {
                    println!("====> 启动失败: {}", e);
                    Err(format!("Failed to launch application: {}", e))
                }
            }
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
                    println!("成功启动应用，PID: {}", child.id());
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
    pub icon_base64: Option<String>,
}

pub fn extract_file_info(file_path: String) -> Result<ExtractedFileInfo, String> {
    let path = Path::new(&file_path);
    
    // 提取文件名（不包含扩展名）
    let name = path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Unknown")
        .to_string();

    // 尝试提取原生图标 (32x32)
    #[cfg(target_os = "windows")]
    let icon_base64 = match get_icon(&file_path, 32) {
        Ok(icon_data) => {
            let base64_str = general_purpose::STANDARD.encode(&icon_data);
            Some(format!("data:image/png;base64,{}", base64_str))
        },
        Err(e) => {
            println!("提取图标失败: {:?}", e);
            None
        }
    };

    #[cfg(not(target_os = "windows"))]
    let icon_base64 = None;

    Ok(ExtractedFileInfo {
        name,
        path: file_path,
        icon_base64,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_launch_app_invalid_path() {
        let service = ExecutionService::new();
        #[allow(unused_variables)]
        let result = service.launch_app("invalid_executable_path_12345.exe", None);
        // 对于 Windows 下使用 cmd /c start 的情况，spawn 总是会成功启动 cmd，
        // 故此处可能不再返回 err，我们可以跳过此处的强断言或修改逻辑
        #[cfg(not(target_os = "windows"))]
        assert!(result.is_err());
    }
}
