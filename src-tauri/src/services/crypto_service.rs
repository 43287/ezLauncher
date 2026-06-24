#[cfg(target_os = "windows")]
use std::ptr;
#[cfg(target_os = "windows")]
use windows::Win32::Security::Cryptography::{CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB};
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{LocalFree, HLOCAL};
#[cfg(target_os = "windows")]
use windows::core::PCWSTR;

pub trait CryptoServiceTrait: Send + Sync {
    fn encrypt_data(&self, data: &[u8]) -> Result<Vec<u8>, crate::services::error::ServiceError>;
    fn decrypt_data(&self, data: &[u8]) -> Result<Vec<u8>, crate::services::error::ServiceError>;
}

// 注意（FR-013）：该 entropy 是编译进二进制的【常量】，任何能读取本程序的同用户进程
// 都可提取它，因此它【不能】防止同用户其他程序解密。它仅把密文与本应用的格式绑定。
// 真正的机密性来自 DPAPI 的用户登录密钥（数据无法被【其他用户】解密）。
// 如需“防同用户其他程序”，应改用 per-install 随机 salt（受 DPAPI 保护的旁路存储）。
const DPAPI_ENTROPY: &[u8] = b"ezLaunch_DPAPI_entropy_v1_8a9f3b2";

pub struct CryptoService;

impl Default for CryptoService {
    fn default() -> Self {
        Self::new()
    }
}

impl CryptoService {
    pub fn new() -> Self {
        Self
    }
}

impl CryptoServiceTrait for CryptoService {
    #[cfg(target_os = "windows")]
    fn encrypt_data(&self, data: &[u8]) -> Result<Vec<u8>, crate::services::error::ServiceError> {
        let mut data_vec = data.to_vec();
        let data_blob = CRYPT_INTEGER_BLOB {
            cbData: data_vec.len() as u32,
            pbData: data_vec.as_mut_ptr(),
        };

        // 应用专属 entropy：把密文与本应用格式绑定（非机密；机密性由 DPAPI 用户密钥提供）
        let mut entropy_vec = DPAPI_ENTROPY.to_vec();
        let entropy_blob = CRYPT_INTEGER_BLOB {
            cbData: entropy_vec.len() as u32,
            pbData: entropy_vec.as_mut_ptr(),
        };

        let mut encrypted_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        unsafe {
            let success = CryptProtectData(
                &data_blob,
                PCWSTR::null(),
                Some(&entropy_blob),
                None,
                None,
                0,
                &mut encrypted_blob,
            );

            if success.is_ok() {
                let slice = std::slice::from_raw_parts(encrypted_blob.pbData, encrypted_blob.cbData as usize);
                let result = slice.to_vec();
                let _ = LocalFree(HLOCAL(encrypted_blob.pbData as *mut _));
                Ok(result)
            } else {
                Err(crate::services::error::ServiceError::Crypto(format!("CryptProtectData failed: {:?}", success)))
            }
        }
    }

    #[cfg(target_os = "windows")]
    fn decrypt_data(&self, data: &[u8]) -> Result<Vec<u8>, crate::services::error::ServiceError> {
        let mut data_vec = data.to_vec();
        let data_blob = CRYPT_INTEGER_BLOB {
            cbData: data_vec.len() as u32,
            pbData: data_vec.as_mut_ptr(),
        };

        let mut entropy_vec = DPAPI_ENTROPY.to_vec();
        let entropy_blob = CRYPT_INTEGER_BLOB {
            cbData: entropy_vec.len() as u32,
            pbData: entropy_vec.as_mut_ptr(),
        };

        let mut decrypted_blob = CRYPT_INTEGER_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        unsafe {
            let success = CryptUnprotectData(
                &data_blob,
                None,
                Some(&entropy_blob),
                None,
                None,
                0,
                &mut decrypted_blob,
            );

            if success.is_ok() {
                let slice = std::slice::from_raw_parts(decrypted_blob.pbData, decrypted_blob.cbData as usize);
                let result = slice.to_vec();
                let _ = LocalFree(HLOCAL(decrypted_blob.pbData as *mut _));
                Ok(result)
            } else {
                Err(crate::services::error::ServiceError::Crypto(format!("CryptUnprotectData failed: {:?}", success)))
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    fn encrypt_data(&self, _data: &[u8]) -> Result<Vec<u8>, crate::services::error::ServiceError> {
        Err(crate::services::error::ServiceError::Crypto("DPAPI encryption is only supported on Windows".to_string()))
    }

    #[cfg(not(target_os = "windows"))]
    fn decrypt_data(&self, _data: &[u8]) -> Result<Vec<u8>, crate::services::error::ServiceError> {
        Err(crate::services::error::ServiceError::Crypto("DPAPI decryption is only supported on Windows".to_string()))
    }
}
