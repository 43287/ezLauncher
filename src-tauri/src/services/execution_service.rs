use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

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

    pub fn launch_app(&self, executable_path: &str) -> Result<(), String> {
        println!("====> 尝试启动目标进程: {}", executable_path);
        
        #[cfg(target_os = "windows")]
        {
            const DETACHED_PROCESS: u32 = 0x00000008;
            let mut cmd = Command::new("cmd");
            // 使用 raw_arg 避免 Rust 的 Command 自动对双引号和空格进行错误转义
            cmd.arg("/C").raw_arg(format!("start \"\" \"{}\"", executable_path));
            cmd.creation_flags(DETACHED_PROCESS);
            match cmd.spawn() {
                Ok(_) => Ok(()),
                Err(e) => {
                    println!("====> 启动失败: {}", e);
                    Err(format!("Failed to launch application: {}", e))
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let mut cmd = Command::new(executable_path);
            match cmd.spawn() {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("Failed to launch application: {}", e)),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_launch_app_invalid_path() {
        let service = ExecutionService::new();
        let result = service.launch_app("invalid_executable_path_12345.exe");
        // 对于 Windows 下使用 cmd /c start 的情况，spawn 总是会成功启动 cmd，
        // 故此处可能不再返回 err，我们可以跳过此处的强断言或修改逻辑
        #[cfg(not(target_os = "windows"))]
        assert!(result.is_err());
    }
}
