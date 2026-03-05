use crate::commands::git::git_repo_scan;
use crate::commands::project::project_get;
use crate::commands::workspace::load_global_settings;
use crate::db::get_db;
use crate::types::*;
use chrono::Utc;
use rusqlite::params;
use std::fs;
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
    let name = input
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("缺少名称")?
        .to_string();

    let category = input
        .get("category")
        .and_then(|v| v.as_str())
        .map(String::from);

    let sort_order = input
        .get("sortOrder")
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

    let name = patch
        .get("name")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or(old_name);

    let category = patch
        .get("category")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or(old_category);

    let sort_order = patch
        .get("sortOrder")
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

    // 获取项目信息，创建物理目录
    let project = project_get(project_id.clone())?;
    let full_path = Path::new(&project.project_path).join(&relative_path);

    // 创建物理目录（如果不存在）
    fs::create_dir_all(&full_path)
        .map_err(|e| format!("创建物理目录失败: {} - {}", full_path.display(), e))?;

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
                                        let bin_name =
                                            bin_entry.file_name().to_string_lossy().to_string();
                                        if bin_name.ends_with(".exe") && !bin_name.contains("64") {
                                            ides.push(IdeConfig {
                                                kind: SupportedIdeKind::Jetbrains,
                                                name: name.clone(),
                                                exe_path: bin_entry
                                                    .path()
                                                    .to_string_lossy()
                                                    .to_string(),
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

/// 获取有效的 IDE 配置（按优先级：仓库 > 工作区 > 全局）
fn get_effective_ide(
    conn: &rusqlite::Connection,
    repo_id: &str,
    provided_ide: Option<IdeConfig>,
) -> Option<IdeConfig> {
    // 1. 如果调用时提供了 IDE，直接使用
    if let Some(ide) = provided_ide {
        return Some(ide);
    }

    // 2. 尝试获取仓库级别的 IDE 设置
    let repo_ide: Option<String> = conn
        .query_row(
            "SELECT ide_override_json FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .ok();
    if let Some(json) = repo_ide {
        if let Ok(ide) = serde_json::from_str::<IdeConfig>(&json) {
            return Some(ide);
        }
    }

    // 3. 尝试获取工作区设置
    let workspace_ide: Option<String> = conn
        .query_row(
            "SELECT value FROM workspace_meta WHERE key = 'settings'",
            [],
            |row| row.get(0),
        )
        .ok();
    if let Some(json) = workspace_ide {
        if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&json) {
            if let Some(ide) = settings
                .get("defaultIde")
                .and_then(|i| serde_json::from_value::<IdeConfig>(i.clone()).ok())
            {
                return Some(ide);
            }
        }
    }

    // 4. 使用全局设置
    let global_settings = load_global_settings();
    global_settings.default_ide
}

/// 预览 IDE 配置（不实际打开，仅返回会使用什么 IDE）
#[tauri::command]
pub fn ide_preview(
    repo_id: String,
    provided_ide: Option<IdeConfig>,
) -> Result<Option<IdeConfig>, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    Ok(get_effective_ide(conn, &repo_id, provided_ide))
}

/// 用 IDE 打开仓库
#[tauri::command]
pub fn ide_open_repo(
    repo_id: String,
    provided_ide: Option<IdeConfig>,
) -> Result<serde_json::Value, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let path: String = conn
        .query_row(
            "SELECT path FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("仓库不存在: {}", e))?;

    // 获取有效的 IDE 配置（优先级：仓库 > 工作区 > 全局）
    let ide_config = get_effective_ide(conn, &repo_id, provided_ide)
        .ok_or_else(|| "未配置 IDE，请先在设置中配置默认 IDE".to_string())?;

    // 验证 IDE 可执行文件存在
    if !std::path::Path::new(&ide_config.exe_path).exists() {
        return Err(format!("IDE 可执行文件不存在: {}", ide_config.exe_path));
    }

    // 启动 IDE
    #[cfg(windows)]
    {
        let mut cmd = Command::new(&ide_config.exe_path);
        if let Some(args) = ide_config.args {
            cmd.args(&args);
        }
        cmd.arg(&path);

        match cmd.spawn() {
            Ok(_) => Ok(
                serde_json::json!({ "ok": true, "message": format!("已使用 {} 打开", ide_config.name) }),
            ),
            Err(e) => {
                Ok(serde_json::json!({ "ok": false, "message": format!("启动 IDE 失败: {}", e) }))
            }
        }
    }

    #[cfg(not(windows))]
    {
        Ok(serde_json::json!({ "ok": false, "message": "不支持的平台" }))
    }
}

/// 自动扫描并同步项目目录到数据库
/// 当进入代码仓库页时，如果文件目录中有数据库中不存在的目录，自动导入到数据库中
#[tauri::command]
pub fn project_dirs_sync_auto(project_id: String) -> Result<serde_json::Value, String> {
    // 扫描 Git 仓库
    let git_scanned: Vec<String> = match git_repo_scan(project_id.clone()) {
        Ok(json) => json
            .get("scanned")
            .and_then(|s| s.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };

    let project = project_get(project_id.clone())?;
    let project_path = Path::new(&project.project_path);

    let db_guard = get_db().map_err(|e| format!("获取数据库失败：{}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 获取所有已有的目录类型
    let mut stmt = conn
        .prepare("SELECT id, kind FROM directory_types ORDER BY sort_order")
        .map_err(|e| format!("查询目录类型失败：{}", e))?;

    let dir_types: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("读取目录类型失败：{}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // 获取项目中已绑定的目录
    let mut stmt = conn
        .prepare("SELECT dir_type_id, relative_path FROM project_directories WHERE project_id = ?1")
        .map_err(|e| format!("查询项目目录失败：{}", e))?;

    let existing_dirs: std::collections::HashMap<String, String> = stmt
        .query_map(params![project_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| format!("读取项目目录失败：{}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let mut synced = Vec::new();
    let now = Utc::now().to_rfc3339();

    // 遍历每个目录类型，检查是否需要自动创建绑定
    for (dir_type_id, kind) in dir_types {
        // 只处理内置类型（code, docs, ui_design, project_planning）
        if !["code", "docs", "ui_design", "project_planning"].contains(&kind.as_str()) {
            continue;
        }

        // 如果已经绑定，跳过
        if existing_dirs.contains_key(&dir_type_id) {
            continue;
        }

        // 构建默认的目录路径（如 code, docs, ui_designs, project_plannings）
        let default_dir_name = match kind.as_str() {
            "code" => "code",
            "docs" => "docs",
            "ui_design" => "ui_designs",
            "project_planning" => "project_plannings",
            _ => continue,
        };

        let full_path = project_path.join(default_dir_name);

        // 检查物理目录是否存在
        if full_path.exists() && full_path.is_dir() {
            // 目录存在但数据库中不存在，自动创建绑定
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO project_directories (id, project_id, dir_type_id, relative_path, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![id, project_id, dir_type_id, default_dir_name, now, now],
            )
            .map_err(|e| format!("创建目录绑定失败：{}", e))?;

            synced.push(default_dir_name.to_string());
        }
    }

    Ok(serde_json::json!({
        "ok": true,
        "scanned": git_scanned,
        "synced": synced
    }))
}
