use crate::commands::directory::directory_create;
use crate::db::get_db;
use crate::types::*;
use chrono::Utc;
use rusqlite::params;

/// 列出模板
#[tauri::command]
pub fn template_list(
    scope: Option<String>,
    project_id: Option<String>,
) -> Result<Vec<DirectoryTemplate>, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let query = match (&scope, &project_id) {
        (Some(s), None) => format!(
            "SELECT id, name, description, scope, project_id, items_json, created_by, created_at, updated_at
             FROM directory_templates WHERE scope = '{}' ORDER BY name",
            s
        ),
        (None, Some(p)) => format!(
            "SELECT id, name, description, scope, project_id, items_json, created_by, created_at, updated_at
             FROM directory_templates WHERE scope = 'project' AND project_id = '{}' ORDER BY name",
            p
        ),
        (Some(s), Some(p)) => format!(
            "SELECT id, name, description, scope, project_id, items_json, created_by, created_at, updated_at
             FROM directory_templates WHERE scope = '{}' AND project_id = '{}' ORDER BY name",
            s, p
        ),
        _ => "SELECT id, name, description, scope, project_id, items_json, created_by, created_at, updated_at
              FROM directory_templates ORDER BY scope, name"
            .to_string(),
    };

    let mut stmt = conn.prepare(&query).map_err(|e| format!("查询失败: {}", e))?;

    let templates = stmt
        .query_map([], |row| {
            let items_json: String = row.get(5)?;
            let items: Vec<DirectoryTemplateItem> =
                serde_json::from_str(&items_json).unwrap_or_default();
            let scope_str: String = row.get(3)?;

            let scope = match scope_str.as_str() {
                "local" => TemplateScope::Local,
                "project" => TemplateScope::Project,
                _ => TemplateScope::Official,
            };

            Ok(DirectoryTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                scope,
                project_id: row.get(4)?,
                items,
                created_by: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("查询失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取数据失败: {}", e))?;

    Ok(templates)
}

/// 获取模板
#[tauri::command]
pub fn template_get(id: String) -> Result<DirectoryTemplate, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    conn.query_row(
        "SELECT id, name, description, scope, project_id, items_json, created_by, created_at, updated_at
         FROM directory_templates WHERE id = ?1",
        params![id],
        |row| {
            let items_json: String = row.get(5)?;
            let items: Vec<DirectoryTemplateItem> =
                serde_json::from_str(&items_json).unwrap_or_default();
            let scope_str: String = row.get(3)?;

            let scope = match scope_str.as_str() {
                "local" => TemplateScope::Local,
                "project" => TemplateScope::Project,
                _ => TemplateScope::Official,
            };

            Ok(DirectoryTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                scope,
                project_id: row.get(4)?,
                items,
                created_by: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| format!("模板不存在: {}", e))
}

/// 创建模板
#[tauri::command]
pub fn template_create(input: serde_json::Value) -> Result<DirectoryTemplate, String> {
    let name = input
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("缺少模板名称")?
        .to_string();

    let description = input
        .get("description")
        .and_then(|v| v.as_str())
        .map(String::from);

    let scope_str = input
        .get("scope")
        .and_then(|v| v.as_str())
        .unwrap_or("local");

    let scope = match scope_str {
        "local" => TemplateScope::Local,
        "project" => TemplateScope::Project,
        _ => TemplateScope::Official,
    };

    let project_id = input
        .get("projectId")
        .and_then(|v| v.as_str())
        .map(String::from);

    let items: Vec<DirectoryTemplateItem> = input
        .get("items")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| {
                    Some(DirectoryTemplateItem {
                        name: v.get("name")?.as_str()?.to_string(),
                        relative_path: v.get("relativePath")?.as_str()?.to_string(),
                        module_id: v.get("moduleId")?.as_str()?.to_string(),
                        module_config: v.get("moduleConfig").cloned(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let created_by = input
        .get("createdBy")
        .and_then(|v| v.as_str())
        .map(String::from);

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let items_json =
        serde_json::to_string(&items).map_err(|e| format!("序列化失败: {}", e))?;

    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    conn.execute(
        "INSERT INTO directory_templates (id, name, description, scope, project_id, items_json, created_by, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, name, description, scope_str, project_id, items_json, created_by, now, now],
    )
    .map_err(|e| format!("创建模板失败: {}", e))?;

    Ok(DirectoryTemplate {
        id,
        name,
        description,
        scope,
        project_id,
        items,
        created_by,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// 更新模板
#[tauri::command]
pub fn template_update(
    id: String,
    patch: serde_json::Value,
) -> Result<DirectoryTemplate, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 获取当前模板
    let template = template_get(id.clone())?;

    let name = patch
        .get("name")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or(template.name);

    let description = patch
        .get("description")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or(template.description);

    let items: Vec<DirectoryTemplateItem> = patch
        .get("items")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| {
                    Some(DirectoryTemplateItem {
                        name: v.get("name")?.as_str()?.to_string(),
                        relative_path: v.get("relativePath")?.as_str()?.to_string(),
                        module_id: v.get("moduleId")?.as_str()?.to_string(),
                        module_config: v.get("moduleConfig").cloned(),
                    })
                })
                .collect()
        })
        .unwrap_or(template.items);

    let now = Utc::now().to_rfc3339();
    let items_json =
        serde_json::to_string(&items).map_err(|e| format!("序列化失败: {}", e))?;

    conn.execute(
        "UPDATE directory_templates SET name = ?1, description = ?2, items_json = ?3, updated_at = ?4 WHERE id = ?5",
        params![name, description, items_json, now, id],
    )
    .map_err(|e| format!("更新模板失败: {}", e))?;

    Ok(DirectoryTemplate {
        id,
        name,
        description,
        scope: template.scope,
        project_id: template.project_id,
        items,
        created_by: template.created_by,
        created_at: template.created_at,
        updated_at: now,
    })
}

/// 删除模板
#[tauri::command]
pub fn template_delete(id: String) -> Result<(), String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    conn.execute(
        "DELETE FROM directory_templates WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("删除模板失败: {}", e))?;

    Ok(())
}

/// 应用模板到项目
#[tauri::command]
pub fn template_apply(
    template_id: String,
    project_id: String,
    customizations: Option<serde_json::Value>,
) -> Result<Vec<Directory>, String> {
    let template = template_get(template_id)?;

    let mut created_dirs = Vec::new();

    for item in template.items {
        // 检查是否被排除
        let excluded = customizations
            .as_ref()
            .and_then(|c| c.get("items"))
            .and_then(|items| items.as_array())
            .map(|items| {
                items.iter().any(|i| {
                    i.get("relativePath")
                        .and_then(|r| r.as_str())
                        .map(|r| r == item.relative_path)
                        .unwrap_or(false)
                        && i.get("excluded")
                            .and_then(|e| e.as_bool())
                            .unwrap_or(false)
                })
            })
            .unwrap_or(false);

        if excluded {
            continue;
        }

        // 自定义相对路径
        let relative_path = customizations
            .as_ref()
            .and_then(|c| c.get("items"))
            .and_then(|items| items.as_array())
            .and_then(|items| {
                items.iter().find(|i| {
                    i.get("relativePath")
                        .and_then(|r| r.as_str())
                        .map(|r| r == item.relative_path)
                        .unwrap_or(false)
                })
            })
            .and_then(|i| i.get("relativePath"))
            .and_then(|r| r.as_str())
            .map(String::from)
            .unwrap_or(item.relative_path.clone());

        // 创建目录
        let dir = directory_create(
            project_id.clone(),
            serde_json::json!({
                "name": item.name,
                "relativePath": relative_path,
                "moduleId": item.module_id,
                "moduleConfig": item.module_config
            }),
        )?;

        created_dirs.push(dir);
    }

    Ok(created_dirs)
}

/// 从现有目录创建模板
#[tauri::command]
pub fn template_from_directories(
    name: String,
    description: Option<String>,
    scope: String,
    project_id: String,
    directory_ids: Vec<String>,
) -> Result<DirectoryTemplate, String> {
    let mut items = Vec::new();

    for dir_id in directory_ids {
        let dir = crate::commands::directory::directory_get(dir_id)?;

        items.push(DirectoryTemplateItem {
            name: dir.name.clone(),
            relative_path: dir.relative_path.clone(),
            module_id: dir.module_id.unwrap_or_default(),
            module_config: dir.module_config,
        });
    }

    let input = serde_json::json!({
        "name": name,
        "description": description,
        "scope": scope,
        "projectId": project_id,
        "items": items
    });

    template_create(input)
}

/// 导出模板
#[tauri::command]
pub fn template_export(template_id: String) -> Result<String, String> {
    let template = template_get(template_id)?;
    serde_json::to_string_pretty(&template).map_err(|e| format!("序列化失败: {}", e))
}

/// 导入模板
#[tauri::command]
pub fn template_import(file_path: String) -> Result<DirectoryTemplate, String> {
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;

    let template: DirectoryTemplate =
        serde_json::from_str(&content).map_err(|e| format!("解析模板失败: {}", e))?;

    // 创建新模板（使用新的 ID）
    let input = serde_json::json!({
        "name": template.name,
        "description": template.description,
        "scope": "local",
        "items": template.items
    });

    template_create(input)
}
