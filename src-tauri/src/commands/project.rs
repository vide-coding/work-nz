use crate::commands::workspace::get_workspace_path;
use crate::db::get_db;
use crate::types::*;
use chrono::Utc;
use rusqlite::params;
use std::path::Path;

/// 项目创建输入
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCreateInput {
    pub name: String,
    pub description: Option<String>,
    pub display: Option<ProjectDisplay>,
}

/// 项目更新输入
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectUpdateInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub display: Option<ProjectDisplay>,
    pub ide_override: Option<IdeConfig>,
}

/// 列出所有项目
#[tauri::command]
pub fn projects_list() -> Result<Vec<Project>, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let mut stmt = conn
        .prepare("SELECT id, name, description, project_path, display_json, ide_override_json, updated_at FROM projects ORDER BY updated_at DESC")
        .map_err(|e| format!("查询失败: {}", e))?;

    let projects = stmt
        .query_map([], |row| {
            let display_json: Option<String> = row.get(4)?;
            let ide_override_json: Option<String> = row.get(5)?;

            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                project_path: row.get(3)?,
                display: display_json.and_then(|j| serde_json::from_str(&j).ok()),
                ide_override: ide_override_json.and_then(|j| serde_json::from_str(&j).ok()),
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("查询失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取数据失败: {}", e))?;

    Ok(projects)
}

/// 创建项目
#[tauri::command]
pub fn project_create(input: ProjectCreateInput) -> Result<Project, String> {
    // 首先检查工作区是否打开
    let workspace_path = match get_workspace_path() {
        Some(p) => p,
        None => return Err("未打开工作区，请先在工作区页面选择或创建一个工作区".to_string()),
    };

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // 验证项目名称
    if input.name.trim().is_empty() {
        return Err("项目名称不能为空".to_string());
    }

    // 创建项目目录
    let project_path = Path::new(&workspace_path).join(&input.name);
    
    // 检查目录是否已存在
    if project_path.exists() {
        return Err(format!("项目目录已存在: {}", project_path.display()));
    }
    
    // 创建目录
    std::fs::create_dir_all(&project_path)
        .map_err(|e| format!("创建项目目录失败: {} - {}", project_path.display(), e))?;

    // 序列化 display
    let display_json = input.display.as_ref()
        .and_then(|d| serde_json::to_string(d).ok());

    // 获取数据库连接
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 插入项目记录
    conn.execute(
        "INSERT INTO projects (id, name, description, project_path, display_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            id,
            input.name,
            input.description,
            project_path.to_string_lossy().to_string(),
            display_json,
            now,
            now
        ],
    )
    .map_err(|e| format!("创建项目记录失败: {}", e))?;

    Ok(Project {
        id,
        name: input.name,
        description: input.description,
        project_path: project_path.to_string_lossy().to_string(),
        display: input.display,
        ide_override: None,
        updated_at: now,
    })
}

/// 获取项目
#[tauri::command]
pub fn project_get(id: String) -> Result<Project, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    conn.query_row(
        "SELECT id, name, description, project_path, display_json, ide_override_json, updated_at FROM projects WHERE id = ?1",
        params![id],
        |row| {
            let display_json: Option<String> = row.get(4)?;
            let ide_override_json: Option<String> = row.get(5)?;

            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                project_path: row.get(3)?,
                display: display_json.and_then(|j| serde_json::from_str(&j).ok()),
                ide_override: ide_override_json.and_then(|j| serde_json::from_str(&j).ok()),
                updated_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| format!("项目不存在: {}", e))
}

/// 更新项目
#[tauri::command]
pub fn project_update(id: String, patch: ProjectUpdateInput) -> Result<Project, String> {
    let now = Utc::now().to_rfc3339();

    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 获取当前项目
    let mut project = project_get(id.clone())?;

    // 更新字段
    if let Some(name) = patch.name {
        project.name = name;
    }
    if let Some(description) = patch.description {
        project.description = Some(description);
    }
    if let Some(display) = patch.display {
        project.display = Some(display);
    }
    if let Some(ide_override) = patch.ide_override {
        project.ide_override = Some(ide_override);
    }

    let display_json = project.display.as_ref()
        .and_then(|d| serde_json::to_string(d).ok());
    let ide_override_json = project.ide_override.as_ref()
        .and_then(|i| serde_json::to_string(i).ok());

    conn.execute(
        "UPDATE projects SET name = ?1, description = ?2, display_json = ?3, ide_override_json = ?4, updated_at = ?5 WHERE id = ?6",
        params![
            project.name,
            project.description,
            display_json,
            ide_override_json,
            now,
            id
        ],
    )
    .map_err(|e| format!("更新项目失败: {}", e))?;

    project.updated_at = now;
    Ok(project)
}

/// 删除项目
#[tauri::command]
pub fn project_delete(id: String) -> Result<serde_json::Value, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 先获取项目路径
    let _project = project_get(id.clone())?;

    // 删除数据库记录
    conn.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| format!("删除项目失败: {}", e))?;

    // 可选：删除项目目录（这里不删除，保留用户数据）
    // std::fs::remove_dir_all(&project.project_path).ok();

    Ok(serde_json::json!({ "ok": true }))
}
