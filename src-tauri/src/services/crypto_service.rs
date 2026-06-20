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
        let data_blob = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut _,
        };

        // Application-specific entropy to prevent other programs running as the same user from decrypting
        let entropy_bytes = DPAPI_ENTROPY;
        let entropy_blob = CRYPT_INTEGER_BLOB {
            cbData: entropy_bytes.len() as u32,
            pbData: entropy_bytes.as_ptr() as *mut _,
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
        let data_blob = CRYPT_INTEGER_BLOB {
            cbData: data.len() as u32,
            pbData: data.as_ptr() as *mut _,
        };

        let entropy_bytes = DPAPI_ENTROPY;
        let entropy_blob = CRYPT_INTEGER_BLOB {
            cbData: entropy_bytes.len() as u32,
            pbData: entropy_bytes.as_ptr() as *mut _,
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
