use crate::db::get_db;
use crate::types::*;
use chrono::Utc;
use rusqlite::params;
use std::path::Path;
use std::process::Command;

/// 列出所有目录类型
#[tauri::command]
pub fn dir_types_list() -> Result<Vec<DirectoryType>, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let mut stmt = conn
        .prepare("SELECT id, kind, name, category, sort_order, created_at, updated_at FROM directory_types ORDER BY sort_order")
        .map_err(|e| format!("查询失败: {}", e))?;

    let types = stmt
        .query_map([], |row| {
            let kind_str: String = row.get(1)?;
            let kind = match kind_str.as_str() {
                "code" => DirectoryTypeKind::Code,
                "docs" => DirectoryTypeKind::Docs,
                "ui_design" => DirectoryTypeKind::UiDesign,
                "project_planning" => DirectoryTypeKind::ProjectPlanning,
                _ => DirectoryTypeKind::Custom,
            };

            Ok(DirectoryType {
                id: row.get(0)?,
                kind,
                name: row.get(2)?,
                category: row.get(3)?,
                sort_order: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("查询失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取数据失败: {}", e))?;

    Ok(types)
}

/// 创建自定义目录类型
#[tauri::command]
pub fn dir_type_create_custom(input: serde_json::Value) -> Result<DirectoryType, String> {
    let name = input.get("name")
        .and_then(|v| v.as_str())
        .ok_or("缺少名称")?
        .to_string();

    let category = input.get("category")
        .and_then(|v| v.as_str())
        .map(String::from);

    let sort_order = input.get("sortOrder")
        .and_then(|v| v.as_i64())
        .unwrap_or(100) as i32;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    conn.execute(
        "INSERT INTO directory_types (id, kind, name, category, sort_order, created_at, updated_at)
         VALUES (?1, 'custom', ?2, ?3, ?4, ?5, ?6)",
        params![id, name, category, sort_order, now, now],
    )
    .map_err(|e| format!("创建目录类型失败: {}", e))?;

    Ok(DirectoryType {
        id,
        kind: DirectoryTypeKind::Custom,
        name,
        category,
        sort_order,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// 更新目录类型
#[tauri::command]
pub fn dir_type_update(id: String, patch: serde_json::Value) -> Result<DirectoryType, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 获取当前类型
    let (old_name, old_category, old_sort_order): (String, Option<String>, i32) = conn
        .query_row(
            "SELECT name, category, sort_order FROM directory_types WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("目录类型不存在: {}", e))?;

    let name = patch.get("name")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or(old_name);

    let category = patch.get("category")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or(old_category);

    let sort_order = patch.get("sortOrder")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(old_sort_order);

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE directory_types SET name = ?1, category = ?2, sort_order = ?3, updated_at = ?4 WHERE id = ?5",
        params![name, category, sort_order, now, id],
    )
    .map_err(|e| format!("更新目录类型失败: {}", e))?;

    // 获取 kind
    let kind_str: String = conn
        .query_row(
            "SELECT kind FROM directory_types WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("获取 kind 失败: {}", e))?;

    let kind = match kind_str.as_str() {
        "code" => DirectoryTypeKind::Code,
        "docs" => DirectoryTypeKind::Docs,
        "ui_design" => DirectoryTypeKind::UiDesign,
        "project_planning" => DirectoryTypeKind::ProjectPlanning,
        _ => DirectoryTypeKind::Custom,
    };

    Ok(DirectoryType {
        id,
        kind,
        name,
        category,
        sort_order,
        created_at: now.clone(), // 不返回创建时间
        updated_at: now,
    })
}

/// 列出项目的所有目录
#[tauri::command]
pub fn project_dirs_list(project_id: String) -> Result<Vec<ProjectDirectory>, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, dir_type_id, relative_path, created_at, updated_at
             FROM project_directories WHERE project_id = ?1",
        )
        .map_err(|e| format!("查询失败: {}", e))?;

    let dirs = stmt
        .query_map(params![project_id], |row| {
            Ok(ProjectDirectory {
                id: row.get(0)?,
                project_id: row.get(1)?,
                dir_type_id: row.get(2)?,
                relative_path: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("查询失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取数据失败: {}", e))?;

    Ok(dirs)
}

/// 创建或更新项目目录
#[tauri::command]
pub fn project_dir_create_or_update(
    project_id: String,
    input: serde_json::Value,
) -> Result<ProjectDirectory, String> {
    let dir_type_id = input
        .get("dirTypeId")
        .or(input.get("dir_type_id"))
        .and_then(|v| v.as_str())
        .ok_or("缺少目录类型 ID")?
        .to_string();

    let relative_path = input
        .get("relativePath")
        .or(input.get("relative_path"))
        .and_then(|v| v.as_str())
        .ok_or("缺少目录路径")?
        .to_string();

    let now = Utc::now().to_rfc3339();

    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 检查是否已存在
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM project_directories WHERE project_id = ?1 AND dir_type_id = ?2",
            params![project_id, dir_type_id],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing_id {
        conn.execute(
            "UPDATE project_directories SET relative_path = ?1, updated_at = ?2 WHERE id = ?3",
            params![relative_path, now, id],
        )
        .map_err(|e| format!("更新目录失败: {}", e))?;

        Ok(ProjectDirectory {
            id,
            project_id,
            dir_type_id,
            relative_path,
            created_at: now.clone(),
            updated_at: now,
        })
    } else {
        let id = uuid::Uuid::new_v4().to_string();

        conn.execute(
            "INSERT INTO project_directories (id, project_id, dir_type_id, relative_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, project_id, dir_type_id, relative_path, now, now],
        )
        .map_err(|e| format!("创建目录失败: {}", e))?;

        Ok(ProjectDirectory {
            id,
            project_id,
            dir_type_id,
            relative_path,
            created_at: now.clone(),
            updated_at: now,
        })
    }
}

/// 检测文件预览类型
#[tauri::command]
pub fn preview_detect(path: String) -> Result<PreviewDetectResult, String> {
    let path = Path::new(&path);
    let extension = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let kind = match extension.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" => PreviewKind::Image,
        "md" | "markdown" => PreviewKind::Markdown,
        _ => PreviewKind::Text,
    };

    Ok(PreviewDetectResult { kind })
}

/// 列出支持的 IDE
#[tauri::command]
pub fn ide_list_supported() -> Result<Vec<IdeConfig>, String> {
    let mut ides = Vec::new();

    // 检测 VS Code
    #[cfg(windows)]
    {
        // 常见 VS Code 安装路径
        let vscode_paths = vec![
            r"C:\Users\Default\AppData\Local\Programs\Microsoft VS Code\Code.exe",
            r"C:\Program Files\Microsoft VS Code\Code.exe",
            r"C:\Program Files (x86)\Microsoft VS Code\Code.exe",
        ];

        for path in vscode_paths {
            if Path::new(path).exists() {
                ides.push(IdeConfig {
                    kind: SupportedIdeKind::Vscode,
                    name: "VS Code".to_string(),
                    exe_path: path.to_string(),
                    args: Some(vec!["--reuse-window".to_string()]),
                });
                break;
            }
        }

        // 检测 JetBrains IDEs
        let jetbrains_base = r"C:\Program Files\JetBrains";
        if Path::new(jetbrains_base).exists() {
            if let Ok(entries) = std::fs::read_dir(jetbrains_base) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if let Ok(meta) = entry.metadata() {
                        if meta.is_dir() {
                            // 查找可执行文件
                            let bin_path = entry.path().join("bin");
                            if bin_path.exists() {
                                if let Ok(bin_entries) = std::fs::read_dir(&bin_path) {
                                    for bin_entry in bin_entries.flatten() {
                                        let bin_name = bin_entry.file_name().to_string_lossy().to_string();
                                        if bin_name.ends_with(".exe") && !bin_name.contains("64") {
                                            ides.push(IdeConfig {
                                                kind: SupportedIdeKind::Jetbrains,
                                                name: name.clone(),
                                                exe_path: bin_entry.path().to_string_lossy().to_string(),
                                                args: None,
                                            });
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(ides)
}

/// 用 IDE 打开仓库
#[tauri::command]
pub fn ide_open_repo(repo_id: String, ide: Option<IdeConfig>) -> Result<serde_json::Value, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let path: String = conn
        .query_row(
            "SELECT path FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("仓库不存在: {}", e))?;

    let ide_config = match ide {
        Some(i) => i,
        None => {
            // 获取工作区默认 IDE
            let settings_json: Option<String> = conn
                .query_row(
                    "SELECT value FROM workspace_meta WHERE key = 'settings'",
                    [],
                    |row| row.get(0),
                )
                .ok();

            match settings_json.and_then(|j| serde_json::from_str::<crate::types::WorkspaceSettings>(&j).ok()) {
                Some(s) => s.default_ide.ok_or("未配置默认 IDE")?,
                None => return Err("未配置默认 IDE".to_string()),
            }
        }
    };

    // 启动 IDE
    #[cfg(windows)]
    {
        let mut cmd = Command::new(&ide_config.exe_path);
        if let Some(args) = ide_config.args {
            cmd.args(&args);
        }
        cmd.arg(&path);

        match cmd.spawn() {
            Ok(_) => Ok(serde_json::json!({ "ok": true })),
            Err(e) => Ok(serde_json::json!({ "ok": false, "message": format!("启动 IDE 失败: {}", e) })),
        }
    }

    #[cfg(not(windows))]
    {
        Ok(serde_json::json!({ "ok": false, "message": "不支持的平台" }))
    }
}
