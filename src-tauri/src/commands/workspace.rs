use crate::db::get_db;
use crate::types::*;
use chrono::Utc;
use rusqlite::params;
use std::fs;
use std::path::Path;

fn get_app_config_dir() -> Option<std::path::PathBuf> {
    dirs::config_dir().map(|p| p.join("pm-app"))
}

fn get_recent_workspaces_file() -> Option<std::path::PathBuf> {
    get_app_config_dir().map(|p| p.join("recent_workspaces.json"))
}

fn load_recent_workspaces() -> Vec<WorkspaceInfo> {
    let file_path = match get_recent_workspaces_file() {
        Some(p) => p,
        None => return Vec::new(),
    };

    if !file_path.exists() {
        return Vec::new();
    }

    match fs::read_to_string(&file_path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn save_recent_workspaces(workspaces: &[WorkspaceInfo]) {
    let file_path = match get_recent_workspaces_file() {
        Some(p) => p,
        None => return,
    };

    if let Some(parent) = file_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Ok(content) = serde_json::to_string(workspaces) {
        let _ = fs::write(&file_path, content);
    }
}

fn add_to_recent_workspaces(path: String, last_opened_at: String) {
    let mut workspaces = load_recent_workspaces();

    workspaces.retain(|w| w.path != path);

    let new_workspace = WorkspaceInfo {
        path: path.clone(),
        db_path: Path::new(&path)
            .join(".app/app.db")
            .to_string_lossy()
            .to_string(),
        last_opened_at,
        settings: None,
    };

    workspaces.insert(0, new_workspace);

    if workspaces.len() > 10 {
        workspaces.truncate(10);
    }

    save_recent_workspaces(&workspaces);
}

/// 工作区状态管理
static WORKSPACE_PATH: once_cell::sync::Lazy<std::sync::Mutex<Option<String>>> =
    once_cell::sync::Lazy::new(|| std::sync::Mutex::new(None));

/// 初始化或打开工作区
#[tauri::command]
pub fn workspace_init_or_open(path: String) -> Result<WorkspaceInfo, String> {
    // 验证路径存在且可写
    let workspace_path = Path::new(&path);
    if !workspace_path.exists() {
        return Err("工作区路径不存在".to_string());
    }

    if !workspace_path.is_dir() {
        return Err("工作区路径必须是目录".to_string());
    }

    // 测试写入权限
    let test_file = workspace_path.join(".app_test_write");
    if std::fs::write(&test_file, "test").is_err() {
        return Err("工作区目录不可写".to_string());
    }
    let _ = std::fs::remove_file(&test_file);

    // 初始化数据库
    crate::db::init_db(&path).map_err(|e| format!("数据库初始化失败: {}", e))?;

    // 更新最近工作区
    let now = Utc::now().to_rfc3339();

    // 保存到全局配置
    add_to_recent_workspaces(path.clone(), now.clone());

    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    conn.execute(
        "INSERT OR REPLACE INTO workspace_meta (key, value, updated_at) VALUES ('last_opened', ?1, ?2)",
        params![&path, &now],
    ).map_err(|e| format!("更新最近工作区失败: {}", e))?;

    // 保存当前工作区路径
    let mut wp = WORKSPACE_PATH.lock().unwrap();
    *wp = Some(path.clone());

    // 获取或创建设置
    let settings = get_workspace_settings_internal(conn);

    Ok(WorkspaceInfo {
        path: path.clone(),
        db_path: Path::new(&path)
            .join(".app/app.db")
            .to_string_lossy()
            .to_string(),
        last_opened_at: now,
        settings,
    })
}

/// 列出最近工作区
#[tauri::command]
pub fn workspace_list_recent() -> Result<Vec<WorkspaceInfo>, String> {
    let workspaces = load_recent_workspaces();
    Ok(workspaces)
}

/// 获取工作区设置
#[tauri::command]
pub fn workspace_settings_get() -> Result<WorkspaceSettings, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    get_workspace_settings_internal(conn).ok_or_else(|| "未找到工作区设置".to_string())
}

fn get_workspace_settings_internal(conn: &rusqlite::Connection) -> Option<WorkspaceSettings> {
    let result: rusqlite::Result<String> = conn.query_row(
        "SELECT value FROM workspace_meta WHERE key = 'settings'",
        [],
        |row| row.get(0),
    );

    match result {
        Ok(json) => serde_json::from_str(&json).ok(),
        Err(_) => Some(WorkspaceSettings::default()),
    }
}

/// 更新工作区设置
#[tauri::command]
pub fn workspace_settings_update(patch: serde_json::Value) -> Result<WorkspaceSettings, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 获取当前设置
    let mut settings = get_workspace_settings_internal(conn).unwrap_or_default();

    // 合并更新
    if let Some(obj) = patch.as_object() {
        if let Some(theme_mode) = obj.get("themeMode").or(obj.get("theme_mode")) {
            if let Some(mode_str) = theme_mode.as_str() {
                settings.theme_mode = match mode_str {
                    "light" => ThemeMode::Light,
                    "dark" => ThemeMode::Dark,
                    "custom" => ThemeMode::Custom,
                    _ => ThemeMode::System,
                };
            }
        }
        if let Some(custom_theme_id) = obj.get("customThemeId").or(obj.get("custom_theme_id")) {
            settings.custom_theme_id = custom_theme_id.as_str().map(String::from);
        }
        if let Some(default_ide) = obj.get("defaultIde").or(obj.get("default_ide")) {
            settings.default_ide = serde_json::from_value(default_ide.clone()).ok();
        }
    }

    // 保存设置
    let json = serde_json::to_string(&settings).map_err(|e| format!("序列化失败: {}", e))?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT OR REPLACE INTO workspace_meta (key, value, updated_at) VALUES ('settings', ?1, ?2)",
        params![json, now],
    ).map_err(|e| format!("保存设置失败: {}", e))?;

    Ok(settings)
}

/// 获取当前工作区路径
pub fn get_workspace_path() -> Option<String> {
    WORKSPACE_PATH.lock().unwrap().clone()
}
