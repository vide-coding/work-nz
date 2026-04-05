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

    // 迁移 4: 添加 sort_order 列到 git_repositories 表
    let has_sort_order = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('git_repositories') WHERE name = 'sort_order'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if !has_sort_order {
        conn.execute(
            "ALTER TABLE git_repositories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
            [],
        )?;
    }

    // 迁移 5: 添加 folder 列到 git_repositories 表
    let has_folder = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('git_repositories') WHERE name = 'folder'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if !has_folder {
        conn.execute(
            "ALTER TABLE git_repositories ADD COLUMN folder TEXT",
            [],
        )?;
    }

    // 迁移 6: 回填 folder 列（从路径提取）
    // 检查是否有 NULL folder 且 path 有效
    let has_null_folder = conn
        .query_row(
            "SELECT COUNT(*) FROM git_repositories WHERE folder IS NULL AND path IS NOT NULL",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0) > 0;

    if has_null_folder {
        // 回填 folder - 路径格式通常是 <project_path>/<folder>/<repo_name>
        // 从路径中提取倒数第二个路径组件作为 folder
        let mut stmt = conn.prepare(
            "SELECT id, path FROM git_repositories WHERE folder IS NULL AND path IS NOT NULL"
        )?;
        let repos_to_update: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .filter_map(|r| r.ok())
            .collect();

        for (repo_id, path) in repos_to_update {
            // 使用 Rust 的 Path 来提取文件夹名
            let folder = std::path::Path::new(&path)
                .components()
                .rev()
                .nth(1) // 倒数第二个组件是 folder
                .and_then(|c| c.as_os_str().to_str())
                .map(|s| s.to_string());

            if let Some(folder_name) = folder {
                conn.execute(
                    "UPDATE git_repositories SET folder = ?1 WHERE id = ?2",
                    params![folder_name, repo_id],
                )?;
            }
        }
    }

    // 迁移 7: 创建 task_columns 表
    migrate_task_columns(conn)?;

    Ok(())
}

/// 数据库迁移：为 projects 表添加 visible 列
fn migrate_add_visible_column(conn: &Connection) -> Result<()> {
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

/// 数据库迁移：创建 task_columns 表并初始化默认列
fn migrate_task_columns(conn: &Connection) -> Result<()> {
    // 检查 task_columns 表是否存在
    let has_table = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='task_columns'",
            [],
            |row| row.get::<_, i32>(0),
        )
        .unwrap_or(0)
        > 0;

    if !has_table {
        // 创建表（已在 SCHEMA 中定义，这里仅处理迁移）
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS task_columns (
              id TEXT PRIMARY KEY,
              directory_id TEXT NOT NULL,
              status_key TEXT NOT NULL,
              name TEXT NOT NULL,
              color TEXT NOT NULL,
              sort_order INTEGER NOT NULL DEFAULT 0,
              is_visible INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              UNIQUE(directory_id, status_key)
            );
            CREATE INDEX IF NOT EXISTS idx_task_columns_directory_id ON task_columns(directory_id);",
        )?;

        // 为已有的 task 模块目录初始化默认列
        let now = chrono::Utc::now().to_rfc3339();
        let default_columns = vec![
            ("todo", "To Do", "#9CA3AF", 0),
            ("in_progress", "In Progress", "#3B82F6", 1),
            ("done", "Done", "#10B981", 2),
        ];

        let mut stmt = conn.prepare(
            "SELECT d.id FROM directories d
             JOIN modules m ON d.module_id = m.id
             WHERE m.key = 'task'",
        )?;
        let task_dirs: Vec<String> = stmt
            .query_map([], |row| row.get(0))?
            .filter_map(|r| r.ok())
            .collect();

        for dir_id in task_dirs {
            for (status_key, name, color, sort_order) in &default_columns {
                conn.execute(
                    "INSERT OR IGNORE INTO task_columns (id, directory_id, status_key, name, color, sort_order, is_visible, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?8)",
                    params![
                        uuid::Uuid::new_v4().to_string(),
                        dir_id,
                        status_key,
                        name,
                        color,
                        sort_order,
                        now,
                        now
                    ],
                )?;
            }
        }
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
