use crate::commands::module::module_get;
use crate::commands::project::project_get;
use crate::db::get_db;
use crate::types::*;
use chrono::Utc;
use rusqlite::params;
use std::fs;
use std::path::Path;

/// 列出项目的所有目录
#[tauri::command]
pub fn directory_list(project_id: String) -> Result<Vec<Directory>, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, relative_path, module_id, module_config_json,
                    sort_order, created_at, updated_at
             FROM directories WHERE project_id = ?1 ORDER BY sort_order, name",
        )
        .map_err(|e| format!("查询失败: {}", e))?;

    let dirs = stmt
        .query_map(params![project_id], |row| {
            let module_config_json: Option<String> = row.get(5)?;
            let module_config: Option<serde_json::Value> =
                module_config_json.and_then(|j| serde_json::from_str(&j).ok());

            Ok(Directory {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                relative_path: row.get(3)?,
                module_id: row.get(4)?,
                module_config,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("查询失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取数据失败: {}", e))?;

    Ok(dirs)
}

/// 获取目录
#[tauri::command]
pub fn directory_get(id: String) -> Result<Directory, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    conn.query_row(
        "SELECT id, project_id, name, relative_path, module_id, module_config_json,
                sort_order, created_at, updated_at
         FROM directories WHERE id = ?1",
        params![id],
        |row| {
            let module_config_json: Option<String> = row.get(5)?;
            let module_config: Option<serde_json::Value> =
                module_config_json.and_then(|j| serde_json::from_str(&j).ok());

            Ok(Directory {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                relative_path: row.get(3)?,
                module_id: row.get(4)?,
                module_config,
                sort_order: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| format!("目录不存在: {}", e))
}

/// 创建目录
#[tauri::command]
pub fn directory_create(project_id: String, input: serde_json::Value) -> Result<Directory, String> {
    let name = input
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("缺少目录名称")?
        .to_string();

    let relative_path = input
        .get("relativePath")
        .and_then(|v| v.as_str())
        .ok_or("缺少目录路径")?
        .to_string();

    let module_id = input
        .get("moduleId")
        .and_then(|v| v.as_str())
        .map(String::from);

    let module_config: Option<serde_json::Value> = input
        .get("moduleConfig")
        .cloned();

    let sort_order = input
        .get("sortOrder")
        .and_then(|v| v.as_i64())
        .unwrap_or(0) as i32;

    // 获取项目信息，创建物理目录
    let project = project_get(project_id.clone())?;
    let full_path = Path::new(&project.project_path).join(&relative_path);

    // 创建物理目录（如果不存在）
    fs::create_dir_all(&full_path).map_err(|e| {
        format!("创建物理目录失败: {} - {}", full_path.display(), e)
    })?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let module_config_json = module_config
        .as_ref()
        .map(|c| serde_json::to_string(c).ok())
        .flatten();

    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    conn.execute(
        "INSERT INTO directories (id, project_id, name, relative_path, module_id, module_config_json, sort_order, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, project_id, name, relative_path, module_id, module_config_json, sort_order, now, now],
    )
    .map_err(|e| format!("创建目录失败: {}", e))?;

    Ok(Directory {
        id,
        project_id,
        name,
        relative_path,
        module_id,
        module_config,
        sort_order,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// 更新目录
#[tauri::command]
pub fn directory_update(id: String, patch: serde_json::Value) -> Result<Directory, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 获取当前目录
    let dir = directory_get(id.clone())?;

    // 保存原始值用于后续比较
    let original_relative_path = dir.relative_path.clone();
    let original_project_id = dir.project_id.clone();

    let name = patch
        .get("name")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or(dir.name);

    let relative_path = patch
        .get("relativePath")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or(dir.relative_path);

    let module_id = patch
        .get("moduleId")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or(dir.module_id);

    let module_config: Option<serde_json::Value> = patch
        .get("moduleConfig")
        .cloned()
        .or(dir.module_config.clone());

    let sort_order = patch
        .get("sortOrder")
        .and_then(|v| v.as_i64())
        .map(|v| v as i32)
        .unwrap_or(dir.sort_order);

    let now = Utc::now().to_rfc3339();

    let module_config_json = module_config
        .as_ref()
        .map(|c| serde_json::to_string(c).ok())
        .flatten();

    // 如果相对路径变了，也更新物理目录
    if relative_path != original_relative_path {
        let project = project_get(original_project_id)?;
        let old_full_path = Path::new(&project.project_path).join(&original_relative_path);
        let new_full_path = Path::new(&project.project_path).join(&relative_path);

        if old_full_path.exists() && old_full_path.is_dir() {
            fs::rename(&old_full_path, &new_full_path).map_err(|e| {
                format!("移动目录失败: {} - {}", old_full_path.display(), e)
            })?;
        }
    }

    conn.execute(
        "UPDATE directories SET name = ?1, relative_path = ?2, module_id = ?3,
                           module_config_json = ?4, sort_order = ?5, updated_at = ?6
         WHERE id = ?7",
        params![name, relative_path, module_id, module_config_json, sort_order, now, id],
    )
    .map_err(|e| format!("更新目录失败: {}", e))?;

    Ok(Directory {
        id,
        project_id: dir.project_id,
        name,
        relative_path,
        module_id,
        module_config,
        sort_order,
        created_at: dir.created_at,
        updated_at: now,
    })
}

/// 删除目录
#[tauri::command]
pub fn directory_delete(id: String) -> Result<(), String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 获取目录信息用于删除物理目录
    let _dir = directory_get(id.clone())?;

    // 删除物理目录（可选：只删除记录，不删除物理目录）
    // let project = project_get(dir.project_id)?;
    // let full_path = Path::new(&project.project_path).join(&dir.relative_path);
    // if full_path.exists() && full_path.is_dir() {
    //     fs::remove_dir_all(&full_path).map_err(|e| format!("删除物理目录失败: {}", e))?;
    // }

    conn.execute("DELETE FROM directories WHERE id = ?1", params![id])
        .map_err(|e| format!("删除目录失败: {}", e))?;

    Ok(())
}

/// 在目录上启用模块
#[tauri::command]
pub fn directory_enable_module(
    id: String,
    module_id: String,
    config: Option<serde_json::Value>,
) -> Result<Directory, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 检查目录是否已有模块
    let current_module_id: Option<String> = conn
        .query_row(
            "SELECT module_id FROM directories WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    if current_module_id.is_some() {
        return Err("目录已启用模块，请先禁用现有模块".to_string());
    }

    // 验证模块存在
    let _module = module_get(module_id.clone())?;

    // 验证配置
    if let Some(cfg) = &config {
        let validation = crate::commands::module::module_validate_config(
            module_id.clone(),
            cfg.clone(),
        )?;
        if !validation.get("valid").and_then(|v| v.as_bool()).unwrap_or(false) {
            let errors = validation
                .get("errors")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect::<Vec<_>>()
                        .join(", ")
                })
                .unwrap_or_default();
            return Err(format!("配置验证失败: {}", errors));
        }
    }

    let module_config_json = config
        .as_ref()
        .map(|c| serde_json::to_string(c).ok())
        .flatten();

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE directories SET module_id = ?1, module_config_json = ?2, updated_at = ?3 WHERE id = ?4",
        params![module_id, module_config_json, now, id],
    )
    .map_err(|e| format!("启用模块失败: {}", e))?;

    directory_get(id)
}

/// 禁用目录上的模块
#[tauri::command]
pub fn directory_disable_module(id: String) -> Result<Directory, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE directories SET module_id = NULL, module_config_json = NULL, updated_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| format!("禁用模块失败: {}", e))?;

    directory_get(id)
}

/// 更新目录的模块配置
#[tauri::command]
pub fn directory_update_module_config(
    id: String,
    config: serde_json::Value,
) -> Result<Directory, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 获取当前模块
    let dir = directory_get(id.clone())?;
    let module_id = dir
        .module_id
        .ok_or("目录未启用模块")?;

    // 验证配置
    let validation =
        crate::commands::module::module_validate_config(module_id.clone(), config.clone())?;
    if !validation.get("valid").and_then(|v| v.as_bool()).unwrap_or(false) {
        let errors = validation
            .get("errors")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect::<Vec<_>>()
                    .join(", ")
            })
            .unwrap_or_default();
        return Err(format!("配置验证失败: {}", errors));
    }

    let module_config_json = serde_json::to_string(&config).ok();

    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE directories SET module_config_json = ?1, updated_at = ?2 WHERE id = ?3",
        params![module_config_json, now, id],
    )
    .map_err(|e| format!("更新模块配置失败: {}", e))?;

    directory_get(id)
}

/// 重新排序目录
#[tauri::command]
pub fn directory_reorder(
    project_id: String,
    ordered_ids: Vec<String>,
) -> Result<Vec<Directory>, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let now = Utc::now().to_rfc3339();

    for (index, id) in ordered_ids.iter().enumerate() {
        conn.execute(
            "UPDATE directories SET sort_order = ?1, updated_at = ?2 WHERE id = ?3 AND project_id = ?4",
            params![index as i32, now, id, project_id],
        )
        .map_err(|e| format!("更新排序失败: {}", e))?;
    }

    // 返回更新后的目录列表
    directory_list(project_id)
}
