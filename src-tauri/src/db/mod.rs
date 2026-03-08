use once_cell::sync::Lazy;
use rusqlite::{params, Connection, Result};
use std::path::Path;
use std::sync::Mutex;

pub mod schema;

pub use schema::*;

/// 全局数据库连接
pub static DB: Lazy<Mutex<Option<Connection>>> = Lazy::new(|| Mutex::new(None));

/// 初始化数据库
pub fn init_db(workspace_path: &str) -> Result<()> {
    let app_dir = Path::new(workspace_path).join(".app");
    std::fs::create_dir_all(&app_dir).ok();

    let db_path = app_dir.join("app.db");
    let conn = Connection::open(&db_path)?;

    // 创建表
    conn.execute_batch(SCHEMA)?;

    // 执行迁移
    run_migrations(&conn)?;

    // 插入默认目录类型
    insert_default_directory_types(&conn)?;

    // 插入内置模块
    insert_builtin_modules(&conn)?;

    // 存储连接
    let mut db = DB.lock().unwrap();
    *db = Some(conn);

    Ok(())
}

/// 执行数据库迁移
fn run_migrations(conn: &Connection) -> Result<()> {
    // 迁移 1: 添加 custom_name 列到 git_repositories 表
    let has_custom_name = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('git_repositories') WHERE name = 'custom_name'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if !has_custom_name {
        conn.execute(
            "ALTER TABLE git_repositories ADD COLUMN custom_name TEXT",
            [],
        )?;
    }

    // 迁移 2: 添加 description 列到 git_repositories 表（如果缺失）
    let has_description = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('git_repositories') WHERE name = 'description'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if !has_description {
        conn.execute(
            "ALTER TABLE git_repositories ADD COLUMN description TEXT",
            [],
        )?;
    }

    // 迁移 3: 添加 visible 列到 projects 表
    migrate_add_visible_column(conn)?;

    Ok(())
}

/// 数据库迁移：为 projects 表添加 visible 列
fn migrate_add_visible_column(conn: &Connection) -> Result<()> {
    // 检查 visible 列是否存在
    let mut stmt = conn.prepare("PRAGMA table_info(projects)")?;
    let table_info: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(1)?, row.get(2)?)))?
        .filter_map(|r| r.ok())
        .collect();

    let has_visible = table_info.iter().any(|(name, _)| name == "visible");

    if !has_visible {
        conn.execute(
            "ALTER TABLE projects ADD COLUMN visible INTEGER NOT NULL DEFAULT 1",
            [],
        )?;
    }

    Ok(())
}

/// 插入默认目录类型
fn insert_default_directory_types(conn: &Connection) -> Result<()> {
    let default_types = vec![
        ("code", "代码", "code", 1),
        ("docs", "文档", "docs", 2),
        ("ui_design", "UI 设计", "ui_design", 3),
        ("project_planning", "项目规划", "project_planning", 4),
    ];

    for (kind, name, category, sort_order) in default_types {
        conn.execute(
            "INSERT OR IGNORE INTO directory_types (id, kind, name, category, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'), datetime('now'))",
            params![uuid::Uuid::new_v4().to_string(), kind, name, category, sort_order],
        )?;
    }

    Ok(())
}

/// 插入内置模块
fn insert_builtin_modules(conn: &Connection) -> Result<()> {
    let now = chrono::Utc::now().to_rfc3339();

    // Git 模块
    let git_capabilities = r#"["git.clone","git.pull","git.status","git.log","git.config"]"#;
    let git_config_schema = r#"{
        "type": "object",
        "title": "Git Module Configuration",
        "properties": {
            "autoDetect": {
                "type": "boolean",
                "title": "Auto-detect repositories",
                "default": true
            }
        }
    }"#;
    let git_default_config = r#"{"autoDetect": true}"#;

    conn.execute(
        "INSERT OR IGNORE INTO modules (id, key, name, description, version, capabilities_json, config_schema_json, default_config_json, icon, is_built_in, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?10)",
        params![
            "builtin:git",
            "git",
            "Git",
            "Git repository management with clone, pull, status, and log capabilities",
            "1.0.0",
            git_capabilities,
            git_config_schema,
            git_default_config,
            "git",
            now
        ],
    )?;

    // Task 模块
    let task_capabilities = r#"["task.create","task.list","task.update","task.delete","task.kanban"]"#;
    let task_config_schema = r#"{
        "type": "object",
        "title": "Task Module Configuration",
        "properties": {
            "defaultPriority": {
                "type": "string",
                "title": "Default Priority",
                "enum": ["urgent", "high", "medium", "low"],
                "default": "medium"
            }
        }
    }"#;
    let task_default_config = r#"{"defaultPriority": "medium"}"#;

    conn.execute(
        "INSERT OR IGNORE INTO modules (id, key, name, description, version, capabilities_json, config_schema_json, default_config_json, icon, is_built_in, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?10)",
        params![
            "builtin:task",
            "task",
            "Task",
            "Task and issue tracking with kanban board support",
            "1.0.0",
            task_capabilities,
            task_config_schema,
            task_default_config,
            "checklist",
            now
        ],
    )?;

    // File 模块
    let file_capabilities = r#"["file.read","file.write","file.list","file.search"]"#;
    let file_config_schema = r#"{
        "type": "object",
        "title": "File Module Configuration",
        "properties": {
            "showHidden": {
                "type": "boolean",
                "title": "Show Hidden Files",
                "default": false
            }
        }
    }"#;
    let file_default_config = r#"{"showHidden": false}"#;

    conn.execute(
        "INSERT OR IGNORE INTO modules (id, key, name, description, version, capabilities_json, config_schema_json, default_config_json, icon, is_built_in, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, ?10, ?10)",
        params![
            "builtin:file",
            "file",
            "File",
            "File management with read, write, list, and search capabilities",
            "1.0.0",
            file_capabilities,
            file_config_schema,
            file_default_config,
            "folder",
            now
        ],
    )?;

    Ok(())
}

/// 获取数据库连接
pub fn get_db() -> Result<std::sync::MutexGuard<'static, Option<Connection>>> {
    Ok(DB.lock().unwrap())
}
