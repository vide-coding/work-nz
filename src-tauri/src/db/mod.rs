use rusqlite::{Connection, Result, params};
use std::path::Path;
use std::sync::Mutex;
use once_cell::sync::Lazy;

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

    // 插入默认目录类型
    insert_default_directory_types(&conn)?;

    // 存储连接
    let mut db = DB.lock().unwrap();
    *db = Some(conn);

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
