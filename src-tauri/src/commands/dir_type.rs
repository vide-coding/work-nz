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

/// 列出所有支持的 IDE（包括未安装的），并标记可用状态
#[tauri::command]
pub fn ide_list_supported() -> Result<Vec<IdeConfig>, String> {
    let mut ides = Vec::new();

    // 定义所有支持的 IDE 列表
    let all_supported_ides: Vec<(&str, SupportedIdeKind, &str, Option<Vec<&str>>)> = vec![
        // 主流 IDE
        ("code", SupportedIdeKind::Vscode, "VS Code", Some(vec!["--reuse-window"])),
        ("code-insiders", SupportedIdeKind::Vscode, "VS Code Insiders", Some(vec!["--reuse-window"])),
        ("cursor", SupportedIdeKind::Custom, "Cursor", Some(vec!["--reuse-window"])),
        ("zed", SupportedIdeKind::Custom, "Zed", None),
        ("idea", SupportedIdeKind::Jetbrains, "IntelliJ IDEA", None),
        ("webstorm", SupportedIdeKind::Jetbrains, "WebStorm", None),
        ("pycharm", SupportedIdeKind::Jetbrains, "PyCharm", None),
        ("goland", SupportedIdeKind::Jetbrains, "GoLand", None),
        ("datagrip", SupportedIdeKind::Jetbrains, "DataGrip", None),
        ("rustrover", SupportedIdeKind::Jetbrains, "RustRover", None),
        ("phpstorm", SupportedIdeKind::Jetbrains, "PhpStorm", None),
        ("rubymine", SupportedIdeKind::Jetbrains, "RubyMine", None),
        ("clion", SupportedIdeKind::Jetbrains, "CLion", None),
        ("appcode", SupportedIdeKind::Jetbrains, "AppCode", None),
        ("aqua", SupportedIdeKind::Jetbrains, "Aqua", None),
        ("fleet", SupportedIdeKind::Jetbrains, "Fleet", None),
        ("devenv", SupportedIdeKind::VisualStudio, "Visual Studio", None),
        // 其他编辑器
        ("subl", SupportedIdeKind::Custom, "Sublime Text", None),
        ("atom", SupportedIdeKind::Custom, "Atom", None),
        ("npp", SupportedIdeKind::Custom, "Notepad++", None),
        ("eclipse", SupportedIdeKind::Custom, "Eclipse", None),
        ("netbeans", SupportedIdeKind::Custom, "NetBeans", None),
        ("studio64", SupportedIdeKind::Custom, "Android Studio", None),
        ("studio", SupportedIdeKind::Custom, "Android Studio", None),
        ("rstudio", SupportedIdeKind::Custom, "RStudio", None),
        ("jupyter-lab", SupportedIdeKind::Custom, "Jupyter Lab", None),
        ("gvim", SupportedIdeKind::Custom, "Vim (gVim)", None),
        ("vim", SupportedIdeKind::Custom, "Vim", None),
        ("emacs", SupportedIdeKind::Custom, "Emacs", None),
        ("hbuilderx", SupportedIdeKind::Custom, "HBuilderX", None),
        ("comate", SupportedIdeKind::Custom, "Comate", None),
        ("textpad", SupportedIdeKind::Custom, "TextPad", None),
        ("editplus", SupportedIdeKind::Custom, "EditPlus", None),
        ("uedit32", SupportedIdeKind::Custom, "UltraEdit", None),
        // Markdown/笔记工具
        ("typora", SupportedIdeKind::Custom, "Typora", None),
        ("obsidian", SupportedIdeKind::Custom, "Obsidian", None),
        ("logseq", SupportedIdeKind::Custom, "LogSeq", None),
        // Windows 自带编辑器
        ("notepad", SupportedIdeKind::Custom, "Notepad", None),
        ("write", SupportedIdeKind::Custom, "WordPad", None),
    ];

    // 检测每个 IDE 的可用性
    for (command, kind, name, args) in all_supported_ides {
        let available = is_command_available(command);
        ides.push(IdeConfig {
            kind,
            name: name.to_string(),
            command: command.to_string(),
            args: args.map(|v| v.into_iter().map(String::from).collect()),
            available: Some(available),
        });
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
    command
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_' || c == '.')
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
        which(&ide_config.command).map_err(|_| {
            format!(
                "IDE 可执行文件不存在: {}，请确保已安装并在 PATH 中",
                ide_config.command
            )
        })?
    };

    // 启动 IDE（在新窗口中打开，不复用已有窗口）
    #[cfg(windows)]
    {
        let mut cmd = Command::new(&ide_path);
        // 移除 --reuse-window 参数，让 IDE 在新窗口中打开
        if let Some(args) = ide_config.args {
            // 过滤掉 --reuse-window 参数
            let filtered_args: Vec<String> = args
                .into_iter()
                .filter(|arg| arg != "--reuse-window")
                .collect();
            cmd.args(&filtered_args);
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

/// 用终端打开仓库目录
#[tauri::command]
pub fn open_in_terminal(repo_id: String) -> Result<serde_json::Value, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let path: String = conn
        .query_row(
            "SELECT path FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("仓库不存在: {}", e))?;

    // 检测并打开终端
    #[cfg(windows)]
    {
        // 尝试多种终端命令
        let terminal_commands = [
            ("cmd", vec!["/c", "start", "cmd"]),
            ("powershell", vec!["-NoExit", "-Command"]),
            (
                "WindowsTerminal",
                vec!["nt", "--vertical-split", "--horizontal-split"],
            ),
            ("wt", vec!["nt", "--vertical-split", "--horizontal-split"]),
        ];

        let mut last_error = String::new();

        for (cmd_name, args) in terminal_commands.iter() {
            // 检查命令是否可用
            if !is_command_available(cmd_name) {
                continue;
            }

            let mut cmd = Command::new(cmd_name);
            cmd.args(args);
            cmd.current_dir(&path);

            // 对于 powershell，需要添加 cd 命令
            if *cmd_name == "powershell" {
                cmd.arg(&format!("cd '{}'", path));
            }

            match cmd.spawn() {
                Ok(_) => {
                    return Ok(serde_json::json!({
                        "ok": true,
                        "message": format!("已在终端中打开 {}", path)
                    }));
                }
                Err(e) => {
                    last_error = format!("启动 {} 失败: {}", cmd_name, e);
                    continue;
                }
            }
        }

        // 如果所有命令都失败，尝试使用 Windows 的 start 命令
        let mut cmd = Command::new("cmd");
        cmd.args(&["/c", "start", "cmd"]);
        cmd.current_dir(&path);

        match cmd.spawn() {
            Ok(_) => Ok(serde_json::json!({
                "ok": true,
                "message": format!("已在终端中打开 {}", path)
            })),
            Err(e) => Ok(serde_json::json!({
                "ok": false,
                "message": format!("打开终端失败: {}，原始错误: {}", e, last_error)
            })),
        }
    }

    #[cfg(not(windows))]
    {
        // Unix 系统使用 x-terminal-emulator 或 gnome-terminal 等
        let terminal_commands = [
            "x-terminal-emulator",
            "gnome-terminal",
            "konsole",
            "xfce4-terminal",
            "xterm",
        ];

        for cmd_name in terminal_commands.iter() {
            if !is_command_available(cmd_name) {
                continue;
            }

            let mut cmd = Command::new(cmd_name);
            cmd.current_dir(&path);

            match cmd.spawn() {
                Ok(_) => {
                    return Ok(serde_json::json!({
                        "ok": true,
                        "message": format!("已在终端中打开 {}", path)
                    }));
                }
                Err(e) => {
                    continue;
                }
            }
        }

        Ok(serde_json::json!({
            "ok": false,
            "message": "未找到可用的终端模拟器"
        }))
    }
}

/// 自动扫描并同步项目目录到数据库
/// 当进入代码仓库页时，如果文件目录中有数据库中不存在的目录，自动导入到数据库中
#[tauri::command]
pub fn project_dirs_sync_auto(project_id: String) -> Result<serde_json::Value, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败：{}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 先获取项目信息，避免多次获取锁
    let project: crate::types::Project = conn
        .query_row(
            "SELECT id, name, description, project_path, display_json, ide_override_json, visible, updated_at FROM projects WHERE id = ?1",
            params![project_id],
            |row| {
                let display_json: Option<String> = row.get(4)?;
                let ide_override_json: Option<String> = row.get(5)?;

                Ok(crate::types::Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    project_path: row.get(3)?,
                    display: display_json.and_then(|j| serde_json::from_str(&j).ok()),
                    ide_override: ide_override_json.and_then(|j| serde_json::from_str(&j).ok()),
                    visible: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| format!("项目不存在：{}", e))?;

    let project_path = Path::new(&project.project_path);

    // 扫描 Git 仓库（复用已获取的项目信息和数据库连接）
    let git_scanned: Vec<String> = match crate::commands::git::git_repo_scan_internal(
        conn,
        project_id.clone(),
        project_path,
    ) {
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
