use crate::commands::project::project_get;
use crate::types::*;
use std::fs;
use std::path::Path;

/// 获取项目的文件系统树
#[tauri::command]
pub fn project_fs_tree(project_id: String, relative_root: String) -> Result<FileNode, String> {
    let project = project_get(project_id)?;

    let root_path = Path::new(&project.project_path);
    let target_path = if relative_root.is_empty() {
        root_path.to_path_buf()
    } else {
        root_path.join(&relative_root)
    };

    if !target_path.exists() {
        return Err("目录不存在".to_string());
    }

    fn build_tree(path: &Path, relative_path: &str) -> FileNode {
        let name = path.file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "root".to_string());

        if path.is_dir() {
            let children: Vec<FileNode> = fs::read_dir(path)
                .map(|entries| {
                    entries
                        .filter_map(|e| e.ok())
                        .map(|e| build_tree(&e.path(), &format!("{}/{}", relative_path, e.file_name().to_string_lossy())))
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

    Ok(build_tree(&target_path, &relative_root))
}

/// 读取文本文件内容
#[tauri::command]
pub fn fs_read_text(path: String) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(&path).map_err(|e| format!("读取文件失败: {}", e))?;
    Ok(serde_json::json!({ "content": content }))
}

/// 创建目录
#[tauri::command]
pub fn fs_create_dir(project_id: String, relative_path: String) -> Result<serde_json::Value, String> {
    let project = project_get(project_id)?;
    let target_path = Path::new(&project.project_path).join(&relative_path);

    fs::create_dir_all(&target_path).map_err(|e| format!("创建目录失败: {}", e))?;

    Ok(serde_json::json!({ "ok": true, "path": target_path.to_string_lossy().to_string() }))
}

/// 删除文件或目录
#[tauri::command]
pub fn fs_delete(path: String) -> Result<serde_json::Value, String> {
    let target_path = Path::new(&path);

    if target_path.is_dir() {
        fs::remove_dir_all(&target_path).map_err(|e| format!("删除目录失败: {}", e))?;
    } else {
        fs::remove_file(&target_path).map_err(|e| format!("删除文件失败: {}", e))?;
    }

    Ok(serde_json::json!({ "ok": true }))
}

/// 重命名文件或目录
#[tauri::command]
pub fn fs_rename(old_path: String, new_name: String) -> Result<serde_json::Value, String> {
    let old = Path::new(&old_path);
    let new = old.parent()
        .map(|p| p.join(&new_name))
        .ok_or("无法确定新路径")?;

    fs::rename(&old, &new).map_err(|e| format!("重命名失败: {}", e))?;

    Ok(serde_json::json!({ "ok": true, "newPath": new.to_string_lossy().to_string() }))
}
