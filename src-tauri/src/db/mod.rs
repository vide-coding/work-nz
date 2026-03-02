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

/// 获取数据库连接
pub fn get_db() -> Result<std::sync::MutexGuard<'static, Option<Connection>>> {
    Ok(DB.lock().unwrap())
}
