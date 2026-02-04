use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    println!("cargo:rustc-check-cfg=cfg(embedded_curl)");
    println!("cargo:rerun-if-env-changed=CURL_IMPERSONATE_BIN");
    if let Ok(path) = env::var("CURL_IMPERSONATE_BIN") {
        let src = PathBuf::from(path);
        if src.is_file() {
            println!("cargo:rerun-if-changed={}", src.display());
            let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
            let dst = out_dir.join("curl-impersonate");
            if fs::copy(&src, &dst).is_ok() {
                println!("cargo:rustc-cfg=embedded_curl");
            }
        }
    }
}
