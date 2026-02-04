use std::path::PathBuf;

#[cfg(embedded_curl)]
static EMBEDDED_CURL: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/curl-impersonate"));

pub fn embedded_path() -> Option<PathBuf> {
    #[cfg(not(embedded_curl))]
    {
        None
    }

    #[cfg(embedded_curl)]
    {
        let path = std::env::temp_dir().join("grok2api-curl-impersonate");
        if path.exists() {
            return Some(path);
        }
        if std::fs::write(&path, EMBEDDED_CURL).is_err() {
            return None;
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            if let Ok(mut perms) = std::fs::metadata(&path).map(|m| m.permissions()) {
                perms.set_mode(0o755);
                let _ = std::fs::set_permissions(&path, perms);
            }
        }
        Some(path)
    }
}
