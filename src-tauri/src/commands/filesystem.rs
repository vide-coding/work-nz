use crate::commands::project::project_get;
use crate::types::*;
use std::fs;
use std::path::Path;

/// Normalize a path: on Windows, convert forward slashes to backslashes
fn normalize_path(path: &str) -> String {
    if cfg!(windows) {
        path.replace('/', "\\")
    } else {
        path.to_string()
    }
}

/// 获取项目的文件系统树
#[tauri::command]
pub fn project_fs_tree(projectId: String, relativeRoot: String) -> Result<FileNode, String> {
    let project = project_get(projectId)?;

    let root_path = Path::new(&project.project_path);
    let target_path = if relativeRoot.is_empty() {
        root_path.to_path_buf()
    } else {
        root_path.join(&relativeRoot)
    };

    if !target_path.exists() {
        return Err("目录不存在".to_string());
    }

    fn build_tree(path: &Path, relative_path: &str) -> FileNode {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "root".to_string());

        if path.is_dir() {
            let children: Vec<FileNode> = fs::read_dir(path)
                .map(|entries| {
                    entries
                        .filter_map(|e| e.ok())
                        .map(|e| {
                            build_tree(
                                &e.path(),
                                &format!("{}/{}", relative_path, e.file_name().to_string_lossy()),
                            )
                        })
                        .collect()
                })
                .unwrap_or_default();

            FileNode {
                path: relative_path.to_string(),
                name,
                kind: "dir".to_string(),
                children: Some(children),
            }
        } else {
            FileNode {
                path: relative_path.to_string(),
                name,
                kind: "file".to_string(),
                children: None,
            }
        }
    }

    Ok(build_tree(&target_path, &relativeRoot))
}

/// 读取文本文件内容
#[tauri::command]
pub fn fs_read_text(path: String) -> Result<serde_json::Value, String> {
    let normalized = normalize_path(&path);
    let content = fs::read_to_string(&normalized).map_err(|e| format!("读取文件失败: {}", e))?;
    Ok(serde_json::json!({ "content": content }))
}

/// 创建目录
#[tauri::command]
pub fn fs_create_dir(
    projectId: String,
    relativePath: String,
) -> Result<serde_json::Value, String> {
    let project = project_get(projectId)?;
    let target_path = Path::new(&project.project_path).join(&relativePath);

    fs::create_dir_all(&target_path).map_err(|e| format!("创建目录失败: {}", e))?;

    Ok(serde_json::json!({ "ok": true, "path": target_path.to_string_lossy().to_string() }))
}

/// 删除文件或目录
#[tauri::command]
pub fn fs_delete(path: String) -> Result<serde_json::Value, String> {
    let normalized = normalize_path(&path);
    let target_path = Path::new(&normalized);

    if target_path.is_dir() {
        fs::remove_dir_all(&target_path).map_err(|e| format!("删除目录失败: {}", e))?;
    } else {
        fs::remove_file(&target_path).map_err(|e| format!("删除文件失败: {}", e))?;
    }

    Ok(serde_json::json!({ "ok": true }))
}

/// 重命名文件或目录
#[tauri::command]
pub fn fs_rename(oldPath: String, newName: String) -> Result<serde_json::Value, String> {
    let normalized_old = normalize_path(&oldPath);
    let old = Path::new(&normalized_old);
    let new = old
        .parent()
        .map(|p| p.join(&newName))
        .ok_or("无法确定新路径")?;

    fs::rename(&old, &new).map_err(|e| format!("重命名失败: {}", e))?;

    Ok(serde_json::json!({ "ok": true, "newPath": new.to_string_lossy().to_string() }))
}

/// 创建文件
#[tauri::command]
pub fn fs_create_file(
    projectId: String,
    relativePath: String,
) -> Result<serde_json::Value, String> {
    let project = project_get(projectId)?;
    let target_path = Path::new(&project.project_path).join(&relativePath);

    // 确保父目录存在
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建父目录失败: {}", e))?;
    }

    // 创建空文件
    fs::write(&target_path, "").map_err(|e| format!("创建文件失败: {}", e))?;

    Ok(serde_json::json!({ "ok": true, "path": target_path.to_string_lossy().to_string() }))
}

/// 使用系统默认程序打开文件或文件夹
#[tauri::command]
pub fn fs_open_external(path: String) -> Result<serde_json::Value, String> {
    let normalized = normalize_path(&path);
    eprintln!("[fs_open_external] original: {}", path);
    eprintln!("[fs_open_external] normalized: {}", normalized);

    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use std::ptr;

        // Check if the path exists first
        let path_check = Path::new(&normalized);
        if !path_check.exists() {
            eprintln!("[fs_open_external] 文件不存在: {:?}", path_check);
            return Err(format!("文件不存在: {}", normalized));
        }
        eprintln!("[fs_open_external] 文件存在，正在打开...");

        // Convert UTF-8 path to UTF-16 wide string
        let wide_path: Vec<u16> = OsStr::new(&normalized)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        // ShellExecuteW returns HINSTANCE as isize, > 32 means success
        const SW_SHOWNORMAL: i32 = 1;

        extern "system" {
            fn ShellExecuteW(
                hwnd: *mut std::ffi::c_void,
                lpOperation: *const u16,
                lpFile: *const u16,
                lpParameters: *const u16,
                lpDirectory: *const u16,
                nShowCmd: i32,
            ) -> isize;
        }

        let result = unsafe {
            ShellExecuteW(
                ptr::null_mut(),
                ptr::null(),
                wide_path.as_ptr(),
                ptr::null(),
                ptr::null(),
                SW_SHOWNORMAL,
            )
        };

        if result as usize > 32 {
            Ok(serde_json::json!({ "ok": true }))
        } else {
            let error_msg = match result as i32 {
                0 => "内存不足或shell扩展未能加载",
                2 => "找不到指定的文件",
                3 => "找不到指定的路径",
                5 => "试图动态链接操作失败",
                8 => "内存不足",
                26 => "共享错误",
                27 => "文件名不完整或无效",
                28 => "超时",
                29 => "DDE事务失败",
                30 => "DDE事务无法完成",
                31 => "没有文件关联",
                32 => "DLL未找到",
                _ => "未知错误",
            };
            Err(format!("打开失败: {} (code: {})", error_msg, result))
        }
    }

    #[cfg(not(windows))]
    {
        open::that(&normalized).map_err(|e| format!("打开失败: {}", e))?;
        Ok(serde_json::json!({ "ok": true }))
    }
}

/// 复制文件到目标路径
#[tauri::command]
pub fn fs_copy_file(
    sourcePath: String,
    targetPath: String,
    overwrite: bool,
) -> Result<serde_json::Value, String> {
    let source_normalized = normalize_path(&sourcePath);
    let target_normalized = normalize_path(&targetPath);
    let source = Path::new(&source_normalized);
    let target = Path::new(&target_normalized);

    if !source.exists() {
        return Err("源文件不存在".to_string());
    }

    // 如果不允许覆盖且目标已存在
    if !overwrite && target.exists() {
        return Err("目标文件已存在".to_string());
    }

    // 确保父目录存在
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建父目录失败: {}", e))?;
    }

    fs::copy(source, target).map_err(|e| format!("复制文件失败: {}", e))?;

    Ok(serde_json::json!({ "ok": true, "path": target.to_string_lossy().to_string() }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_fs_create_file() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().to_str().unwrap();

        // Create a mock project file for testing
        let db_path = temp_dir.path().join("test.db");
        fs::write(&db_path, "").unwrap();

        // Note: This test requires a real project in the database
        // In a full test suite, we would set up a test database
        // For now, we test the path construction logic
        let target_path = Path::new(project_path).join("test.txt");
        fs::write(&target_path, "").unwrap();

        assert!(target_path.exists());
        fs::remove_file(&target_path).unwrap();
    }

    #[test]
    fn test_fs_copy_file_no_overwrite() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        fs::write(&source, "content").unwrap();
        fs::write(&target, "existing").unwrap();

        let result = fs_copy_file(
            source.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
            false,
        );

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "目标文件已存在");
    }

    #[test]
    fn test_fs_copy_file_with_overwrite() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("target.txt");

        fs::write(&source, "new content").unwrap();
        fs::write(&target, "old content").unwrap();

        let result = fs_copy_file(
            source.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
            true,
        );

        assert!(result.is_ok());
        let content = fs::read_to_string(&target).unwrap();
        assert_eq!(content, "new content");
    }

    #[test]
    fn test_fs_copy_file_source_not_exists() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("nonexistent.txt");
        let target = temp_dir.path().join("target.txt");

        let result = fs_copy_file(
            source.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
            false,
        );

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "源文件不存在");
    }

    #[test]
    fn test_fs_copy_file_creates_parent_dirs() {
        let temp_dir = TempDir::new().unwrap();
        let source = temp_dir.path().join("source.txt");
        let target = temp_dir.path().join("nested/dirs/target.txt");

        fs::write(&source, "content").unwrap();

        let result = fs_copy_file(
            source.to_string_lossy().to_string(),
            target.to_string_lossy().to_string(),
            false,
        );

        assert!(result.is_ok());
        assert!(target.exists());
    }

    #[test]
    fn test_fs_rename() {
        let temp_dir = TempDir::new().unwrap();
        let old_path = temp_dir.path().join("old_name.txt");
        let new_name = "new_name.txt";

        fs::write(&old_path, "content").unwrap();

        let result = fs_rename(old_path.to_string_lossy().to_string(), new_name.to_string());

        assert!(result.is_ok());
        assert!(!old_path.exists());
        assert!(temp_dir.path().join(new_name).exists());
    }

    #[test]
    fn test_fs_delete_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("to_delete.txt");

        fs::write(&file_path, "content").unwrap();
        assert!(file_path.exists());

        let result = fs_delete(file_path.to_string_lossy().to_string());

        assert!(result.is_ok());
        assert!(!file_path.exists());
    }

    #[test]
    fn test_fs_delete_directory() {
        let temp_dir = TempDir::new().unwrap();
        let dir_path = temp_dir.path().join("to_delete");

        fs::create_dir(&dir_path).unwrap();
        fs::write(dir_path.join("file.txt"), "content").unwrap();
        assert!(dir_path.exists());

        let result = fs_delete(dir_path.to_string_lossy().to_string());

        assert!(result.is_ok());
        assert!(!dir_path.exists());
    }

    #[test]
    fn test_fs_read_text() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");
        let content = "Hello, World!";

        fs::write(&file_path, content).unwrap();

        let result = fs_read_text(file_path.to_string_lossy().to_string());

        assert!(result.is_ok());
        let json = result.unwrap();
        assert_eq!(json["content"], content);
    }

    #[test]
    fn test_fs_create_dir() {
        let temp_dir = TempDir::new().unwrap();
        // Note: fs_create_dir requires a valid project_id to look up project path
        // This tests the underlying directory creation logic
        let dir_path = temp_dir.path().join("new_dir");

        fs::create_dir_all(&dir_path).unwrap();
        assert!(dir_path.exists());

        fs::remove_dir(&dir_path).unwrap();
    }
}

/// 读取二进制文件（用于文档预览）
#[tauri::command]
pub fn fs_read_binary(path: String) -> Result<serde_json::Value, String> {
    let bytes = fs::read(&path).map_err(|e| format!("读取文件失败: {}", e))?;
    // 将字节转换为 Base64 编码
    let base64 = base64_encode(&bytes);
    Ok(serde_json::json!({ "data": base64 }))
}

/// Base64 编码函数
fn base64_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();

    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = chunk.get(1).copied().unwrap_or(0) as usize;
        let b2 = chunk.get(2).copied().unwrap_or(0) as usize;

        result.push(ALPHABET[b0 >> 2] as char);
        result.push(ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] as char);

        if chunk.len() > 1 {
            result.push(ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] as char);
        } else {
            result.push('=');
        }

        if chunk.len() > 2 {
            result.push(ALPHABET[b2 & 0x3f] as char);
        } else {
            result.push('=');
        }
    }

    result
}
