//! 数据库操作辅助函数和宏
//! 消除命令文件中重复的数据库连接和 row 映射模式

use crate::types::*;
use rusqlite::{Row, Result as SqliteResult};

/// 获取数据库连接的简写模式，返回错误信息字符串
/// 使用示例: with_db!(conn, { conn.prepare(...) })
#[macro_export]
macro_rules! with_db {
    ($conn:ident, $body:block) => {{
        let db_guard =
            $crate::db::get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
        let $conn = db_guard.as_ref().ok_or("数据库未初始化")?;
        let __result = { $body };
        drop(db_guard);
        __result
    }};
}

/// 获取可变数据库连接的简写模式，用于需要事务的操作
/// 使用示例: with_db_mut!(conn, { let tx = conn.transaction()?; ... })
#[macro_export]
macro_rules! with_db_mut {
    ($conn:ident, $body:block) => {{
        let mut db_guard =
            $crate::db::get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
        let $conn = (&mut *db_guard).as_mut().ok_or("数据库未初始化")?;
        let __result = { $body };
        drop(db_guard);
        __result
    }};
}

/// 辅助函数：从 Row 中解析 ide_override_json 字段
pub fn parse_ide_override(row: &Row, idx: usize) -> Option<IdeConfig> {
    row.get::<_, Option<String>>(idx)
        .ok()
        .flatten()
        .and_then(|j| serde_json::from_str(&j).ok())
}

/// 辅助函数：从 Row 中解析可选 JSON 字段（通用）
pub fn parse_optional_json<T: serde::de::DeserializeOwned>(
    row: &Row,
    idx: usize,
) -> Option<T> {
    row.get::<_, Option<String>>(idx)
        .ok()
        .flatten()
        .and_then(|j| serde_json::from_str(&j).ok())
}

/// 从 git_repositories 行映射为 GitRepository
/// cols: id, project_id, name, path, folder, remote_url, branch, description,
///       last_sync_at, last_status_checked_at, ide_override_json(idx=10), sort_order
pub fn map_git_repository_row(row: &Row) -> SqliteResult<GitRepository> {
    Ok(GitRepository {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        path: row.get(3)?,
        folder: row.get(4)?,
        remote_url: row.get(5)?,
        branch: row.get(6)?,
        description: row.get(7)?,
        last_sync_at: row.get(8)?,
        last_status_checked_at: row.get(9)?,
        ide_override: parse_ide_override(row, 10),
        sort_order: row.get(11)?,
    })
}

/// 从 projects 行映射为 Project
/// cols: id, name, description, project_path, display_json(idx=4), ide_override_json(idx=5), visible, updated_at
pub fn map_project_row(row: &Row) -> SqliteResult<Project> {
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        project_path: row.get(3)?,
        display: parse_optional_json(row, 4),
        ide_override: parse_optional_json(row, 5),
        visible: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

/// 从 modules 行映射为 Module（用于 module_list）
pub fn map_module_row(row: &Row) -> SqliteResult<Module> {
    let capabilities_json: String = row.get(5)?;
    let config_schema_json: String = row.get(6)?;
    let default_config_json: String = row.get(7)?;

    let capabilities: Vec<String> =
        serde_json::from_str(&capabilities_json).unwrap_or_default();
    let config_schema: ModuleConfigSchema =
        serde_json::from_str(&config_schema_json).unwrap_or(ModuleConfigSchema {
            schema_type: "object".to_string(),
            title: None,
            description: None,
            properties: std::collections::HashMap::new(),
            required: None,
        });
    let default_config: serde_json::Value =
        serde_json::from_str(&default_config_json).unwrap_or(serde_json::json!({}));

    Ok(Module {
        id: row.get(0)?,
        key: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        version: row.get(4)?,
        capabilities,
        config_schema,
        default_config,
        icon: row.get(8)?,
        is_built_in: row.get::<_, i32>(9)? != 0,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

/// 从 tasks 表行映射为 Task
/// cols: id(0), directory_id(1), parent_id(2), title(3), description(4),
///       status(5), priority(6), assignee(7), due_date(8), sort_order(9),
///       is_completed(10), created_at(11), updated_at(12)
pub fn map_task_row(row: &Row) -> SqliteResult<Task> {
    Ok(Task {
        id: row.get(0)?,
        directory_id: row.get(1)?,
        parent_id: row.get(2)?,
        title: row.get(3)?,
        description: row.get(4)?,
        status: row.get(5)?,
        priority: row.get(6)?,
        assignee: row.get(7)?,
        due_date: row.get(8)?,
        sort_order: row.get(9)?,
        is_completed: row.get::<_, i32>(10)? != 0,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

/// 从 task_columns 表行映射为 TaskColumn
/// cols: id(0), directory_id(1), status_key(2), name(3), color(4),
///       sort_order(5), is_visible(6), created_at(7), updated_at(8)
pub fn map_task_column_row(row: &Row) -> SqliteResult<TaskColumn> {
    Ok(TaskColumn {
        id: row.get(0)?,
        directory_id: row.get(1)?,
        status_key: row.get(2)?,
        name: row.get(3)?,
        color: row.get(4)?,
        sort_order: row.get(5)?,
        is_visible: row.get::<_, i32>(6)? != 0,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}
