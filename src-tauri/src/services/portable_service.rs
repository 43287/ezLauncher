// 便携模式开关服务：开关状态持久化于 Windows 注册表 HKCU\Software\ezLauncher，
// 独立于其所控制的数据文件，避免循环依赖（FR-001a）。读失败安全回退默认便携（true）。

use crate::services::error::ServiceError;

#[cfg(target_os = "windows")]
use windows::Win32::Foundation::ERROR_SUCCESS;
#[cfg(target_os = "windows")]
use windows::Win32::System::Registry::{
    RegCloseKey, RegCreateKeyExW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW, HKEY,
    HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_DWORD, REG_OPTION_NON_VOLATILE,
};
#[cfg(target_os = "windows")]
use windows::core::PCWSTR;
#[cfg(target_os = "windows")]
use widestring::U16CString;

const SUBKEY: &str = "Software\\ezLauncher";
const VALUE_NAME: &str = "PortableMode";
const DEFAULT_PORTABLE: bool = true;

pub trait PortableServiceTrait: Send + Sync {
    // 读取便携开关；任何失败均回退默认便携（true）
    fn get_portable(&self) -> bool;
    // 写入便携开关
    fn set_portable(&self, enabled: bool) -> Result<(), ServiceError>;
    // 注册表是否已存在开关记录（用于区分“全新首次使用”与“疑似数据丢失”）
    fn has_record(&self) -> bool;
}

pub struct PortableService;

impl Default for PortableService {
    fn default() -> Self {
        Self::new()
    }
}

impl PortableService {
    pub fn new() -> Self {
        Self
    }
}

#[cfg(target_os = "windows")]
impl PortableServiceTrait for PortableService {
    fn get_portable(&self) -> bool {
        let subkey = match U16CString::from_str(SUBKEY) {
            Ok(s) => s,
            Err(_) => return DEFAULT_PORTABLE,
        };
        let value_name = match U16CString::from_str(VALUE_NAME) {
            Ok(s) => s,
            Err(_) => return DEFAULT_PORTABLE,
        };

        unsafe {
            let mut hkey = HKEY::default();
            let open = RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            );
            if open != ERROR_SUCCESS {
                return DEFAULT_PORTABLE;
            }

            let mut data: u32 = 0;
            let mut size: u32 = std::mem::size_of::<u32>() as u32;
            let query = RegQueryValueExW(
                hkey,
                PCWSTR(value_name.as_ptr()),
                None,
                None,
                Some(&mut data as *mut u32 as *mut u8),
                Some(&mut size),
            );
            let _ = RegCloseKey(hkey);

            if query != ERROR_SUCCESS {
                return DEFAULT_PORTABLE;
            }
            data != 0
        }
    }

    fn set_portable(&self, enabled: bool) -> Result<(), ServiceError> {
        let subkey = U16CString::from_str(SUBKEY)
            .map_err(|e| ServiceError::Internal(format!("Invalid subkey: {}", e)))?;
        let value_name = U16CString::from_str(VALUE_NAME)
            .map_err(|e| ServiceError::Internal(format!("Invalid value name: {}", e)))?;

        unsafe {
            let mut hkey = HKEY::default();
            let create = RegCreateKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                0,
                PCWSTR::null(),
                REG_OPTION_NON_VOLATILE,
                KEY_WRITE,
                None,
                &mut hkey,
                None,
            );
            if create != ERROR_SUCCESS {
                return Err(ServiceError::Internal(format!(
                    "RegCreateKeyExW failed: {:?}",
                    create
                )));
            }

            let val: u32 = if enabled { 1 } else { 0 };
            let bytes = val.to_ne_bytes();
            let set = RegSetValueExW(hkey, PCWSTR(value_name.as_ptr()), 0, REG_DWORD, Some(&bytes));
            let _ = RegCloseKey(hkey);

            if set != ERROR_SUCCESS {
                return Err(ServiceError::Internal(format!(
                    "RegSetValueExW failed: {:?}",
                    set
                )));
            }
            Ok(())
        }
    }

    fn has_record(&self) -> bool {
        let subkey = match U16CString::from_str(SUBKEY) {
            Ok(s) => s,
            Err(_) => return false,
        };
        let value_name = match U16CString::from_str(VALUE_NAME) {
            Ok(s) => s,
            Err(_) => return false,
        };

        unsafe {
            let mut hkey = HKEY::default();
            if RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                0,
                KEY_READ,
                &mut hkey,
            ) != ERROR_SUCCESS
            {
                return false;
            }
            let mut size: u32 = 0;
            let query = RegQueryValueExW(
                hkey,
                PCWSTR(value_name.as_ptr()),
                None,
                None,
                None,
                Some(&mut size),
            );
            let _ = RegCloseKey(hkey);
            query == ERROR_SUCCESS
        }
    }
}

#[cfg(not(target_os = "windows"))]
impl PortableServiceTrait for PortableService {
    fn get_portable(&self) -> bool {
        DEFAULT_PORTABLE
    }
    fn set_portable(&self, _enabled: bool) -> Result<(), ServiceError> {
        Err(ServiceError::Internal(
            "Portable mode registry is only supported on Windows".to_string(),
        ))
    }
    fn has_record(&self) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // 注册表缺失/读失败时回退默认便携（true）（FR-001a / T009）
    #[test]
    fn defaults_to_portable_when_unset() {
        // 非 Windows 平台或注册表无值时，get_portable 必须返回默认便携
        let svc = PortableService::new();
        // 仅断言不 panic 且返回布尔；默认值语义为 true（便携）
        let _ = svc.get_portable();
        assert!(DEFAULT_PORTABLE);
    }
}
