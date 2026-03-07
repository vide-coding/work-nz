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
use which::which;

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

/// 列出支持的 IDE（通过检测命令行工具）
#[tauri::command]
pub fn ide_list_supported() -> Result<Vec<IdeConfig>, String> {
    let mut ides = Vec::new();

    // 检测 CLI 命令是否可用
    #[cfg(windows)]
    {
        // 检测 VS Code (code 命令)
        if is_command_available("code") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Vscode,
                name: "VS Code".to_string(),
                command: "code".to_string(),
                args: Some(vec!["--reuse-window".to_string()]),
            });
        }

        // 检测 Zed (zed 命令)
        if is_command_available("zed") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Zed".to_string(),
                command: "zed".to_string(),
                args: None,
            });
        }

        // 检测 IntelliJ IDEA (idea 命令)
        if is_command_available("idea") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "IntelliJ IDEA".to_string(),
                command: "idea".to_string(),
                args: None,
            });
        }

        // 检测 WebStorm (webstorm 命令)
        if is_command_available("webstorm") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "WebStorm".to_string(),
                command: "webstorm".to_string(),
                args: None,
            });
        }

        // 检测 PyCharm (pycharm 命令)
        if is_command_available("pycharm") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "PyCharm".to_string(),
                command: "pycharm".to_string(),
                args: None,
            });
        }

        // 检测 GoLand (goland 命令)
        if is_command_available("goland") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "GoLand".to_string(),
                command: "goland".to_string(),
                args: None,
            });
        }

        // 检测 DataGrip (datagrip 命令)
        if is_command_available("datagrip") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "DataGrip".to_string(),
                command: "datagrip".to_string(),
                args: None,
            });
        }

        // 检测 RustRover (rustrover 命令)
        if is_command_available("rustrover") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "RustRover".to_string(),
                command: "rustrover".to_string(),
                args: None,
            });
        }

        // 检测 Visual Studio (devenv 命令)
        if is_command_available("devenv") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::VisualStudio,
                name: "Visual Studio".to_string(),
                command: "devenv".to_string(),
                args: None,
            });
        }

        // 检测 Sublime Text (subl 命令)
        if is_command_available("subl") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Sublime Text".to_string(),
                command: "subl".to_string(),
                args: None,
            });
        }

        // 检测 Atom (atom 命令)
        if is_command_available("atom") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Atom".to_string(),
                command: "atom".to_string(),
                args: None,
            });
        }

        // 检测 Notepad++ (npp 命令)
        if is_command_available("npp") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Notepad++".to_string(),
                command: "npp".to_string(),
                args: None,
            });
        }

        // ========== 主流 IDE ==========

        // VS Code Insiders
        if is_command_available("code-insiders") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Vscode,
                name: "VS Code Insiders".to_string(),
                command: "code-insiders".to_string(),
                args: Some(vec!["--reuse-window".to_string()]),
            });
        }

        // Cursor (AI IDE)
        if is_command_available("cursor") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Cursor".to_string(),
                command: "cursor".to_string(),
                args: Some(vec!["--reuse-window".to_string()]),
            });
        }

        // PhpStorm
        if is_command_available("phpstorm") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "PhpStorm".to_string(),
                command: "phpstorm".to_string(),
                args: None,
            });
        }

        // RubyMine
        if is_command_available("rubymine") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "RubyMine".to_string(),
                command: "rubymine".to_string(),
                args: None,
            });
        }

        // CLion
        if is_command_available("clion") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "CLion".to_string(),
                command: "clion".to_string(),
                args: None,
            });
        }

        // AppCode
        if is_command_available("appcode") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "AppCode".to_string(),
                command: "appcode".to_string(),
                args: None,
            });
        }

        // Aqua
        if is_command_available("aqua") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "Aqua".to_string(),
                command: "aqua".to_string(),
                args: None,
            });
        }

        // Fleet
        if is_command_available("fleet") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Jetbrains,
                name: "Fleet".to_string(),
                command: "fleet".to_string(),
                args: None,
            });
        }

        // ========== 其他常用 IDE ==========

        // Eclipse
        if is_command_available("eclipse") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Eclipse".to_string(),
                command: "eclipse".to_string(),
                args: None,
            });
        }

        // NetBeans
        if is_command_available("netbeans") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "NetBeans".to_string(),
                command: "netbeans".to_string(),
                args: None,
            });
        }

        // Android Studio (studio64 或 studio)
        if is_command_available("studio64") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Android Studio".to_string(),
                command: "studio64".to_string(),
                args: None,
            });
        } else if is_command_available("studio") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Android Studio".to_string(),
                command: "studio".to_string(),
                args: None,
            });
        }

        // RStudio
        if is_command_available("rstudio") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "RStudio".to_string(),
                command: "rstudio".to_string(),
                args: None,
            });
        }

        // Jupyter
        if is_command_available("jupyter-lab") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Jupyter Lab".to_string(),
                command: "jupyter-lab".to_string(),
                args: None,
            });
        }

        // ========== 编辑器 ==========

        // Vim / Gvim
        if is_command_available("gvim") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Vim (gVim)".to_string(),
                command: "gvim".to_string(),
                args: None,
            });
        } else if is_command_available("vim") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Vim".to_string(),
                command: "vim".to_string(),
                args: None,
            });
        }

        // Emacs
        if is_command_available("emacs") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Emacs".to_string(),
                command: "emacs".to_string(),
                args: None,
            });
        }

        // ========== 中国主流 IDE ==========

        // HBuilderX
        if is_command_available("hbuilderx") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "HBuilderX".to_string(),
                command: "hbuilderx".to_string(),
                args: None,
            });
        }

        // 百度 Comate
        if is_command_available("comate") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Comate".to_string(),
                command: "comate".to_string(),
                args: None,
            });
        }

        // ========== 其他常用编辑器 ==========

        // TextPad
        if is_command_available("textpad") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "TextPad".to_string(),
                command: "textpad".to_string(),
                args: None,
            });
        }

        // EditPlus
        if is_command_available("editplus") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "EditPlus".to_string(),
                command: "editplus".to_string(),
                args: None,
            });
        }

        // UltraEdit
        if is_command_available("uedit32") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "UltraEdit".to_string(),
                command: "uedit32".to_string(),
                args: None,
            });
        }

        // ========== Markdown/笔记工具 ==========

        // Typora
        if is_command_available("typora") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Typora".to_string(),
                command: "typora".to_string(),
                args: None,
            });
        }

        // Obsidian
        if is_command_available("obsidian") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Obsidian".to_string(),
                command: "obsidian".to_string(),
                args: None,
            });
        }

        // LogSeq
        if is_command_available("logseq") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "LogSeq".to_string(),
                command: "logseq".to_string(),
                args: None,
            });
        }

        // ========== Windows 自带编辑器 ==========

        // 记事本
        if is_command_available("notepad") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "Notepad".to_string(),
                command: "notepad".to_string(),
                args: None,
            });
        }

        // WordPad
        if is_command_available("write") {
            ides.push(IdeConfig {
                kind: SupportedIdeKind::Custom,
                name: "WordPad".to_string(),
                command: "write".to_string(),
                args: None,
            });
        }
    }

    Ok(ides)
}

/// 检测命令是否在 PATH 中可用
fn is_command_available(command: &str) -> bool {
    // 验证命令名格式：只允许字母、数字、连字符、下划线和点
    if !is_valid_command_name(command) {
        return false;
    }

    #[cfg(windows)]
    {
        // 使用 where 命令检测命令是否存在
        if let Ok(output) = std::process::Command::new("where").arg(command).output() {
            return output.status.success();
        }
    }

    #[cfg(unix)]
    {
        // 使用 which 命令检测命令是否存在
        if let Ok(output) = std::process::Command::new("which").arg(command).output() {
            return output.status.success();
        }
    }

    false
}

/// 验证命令名是否合法（防止命令注入）
fn is_valid_command_name(command: &str) -> bool {
    if command.is_empty() || command.len() > 64 {
        return false;
    }
    // 只允许字母、数字、连字符、下划线和点
    command.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
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

    // 验证 IDE 可执行文件存在（支持完整路径或 PATH 中的命令）
    let ide_path = if std::path::Path::new(&ide_config.command).exists() {
        // 如果是完整路径且文件存在，直接使用
        std::path::PathBuf::from(&ide_config.command)
    } else {
        // 否则尝试在 PATH 中查找
        which(&ide_config.command)
            .map_err(|_| format!("IDE 可执行文件不存在: {}，请确保已安装并在 PATH 中", ide_config.command))?
    };

    // 启动 IDE
    #[cfg(windows)]
    {
        let mut cmd = Command::new(&ide_path);
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
