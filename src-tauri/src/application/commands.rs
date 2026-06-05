use tauri::command;
use crate::services::execution_service::{self, ExecutionService, ExtractedFileInfo};

#[command]
pub fn launch_app(executable_path: String, args: Option<Vec<String>>, run_as_admin: Option<bool>) -> Result<(), String> {
    let service = ExecutionService::default();
    service.launch_app(&executable_path, args, run_as_admin.unwrap_or(false))
}

#[command]
pub fn extract_file_info(file_path: String) -> Result<ExtractedFileInfo, String> {
    execution_service::extract_file_info(file_path)
}

#[command]
pub fn restart_as_admin() -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        return Err("在开发模式下不支持以管理员身份重启，因为这会导致前端开发服务器断开连接。请在打包后使用此功能。".to_string());
    }

    #[cfg(all(not(debug_assertions), target_os = "windows"))]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        
        let mut cmd = Command::new("powershell");
        cmd.arg("-NoProfile")
           .arg("-WindowStyle")
           .arg("Hidden")
           .arg("-Command")
           .arg("Start-Process")
           .arg("-FilePath")
           .arg(format!("\"{}\"", exe_path.display()))
           .arg("-WindowStyle")
           .arg("Hidden")
           .arg("-Verb")
           .arg("RunAs");
           
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);

        cmd.spawn().map_err(|e| e.to_string())?;
        std::process::exit(0);
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Admin restart is only supported on Windows".to_string())
    }
}
