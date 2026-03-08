use crate::db::get_db;
use crate::types::*;
use chrono::Utc;
use rusqlite::params;

/// 列出所有模块
#[tauri::command]
pub fn module_list() -> Result<Vec<Module>, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, key, name, description, version, capabilities_json, config_schema_json,
                    default_config_json, icon, is_built_in, created_at, updated_at
             FROM modules ORDER BY is_built_in DESC, name",
        )
        .map_err(|e| format!("查询失败: {}", e))?;

    let modules = stmt
        .query_map([], |row| {
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
        })
        .map_err(|e| format!("查询失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取数据失败: {}", e))?;

    // 如果数据库中没有模块，返回内置模块
    if modules.is_empty() {
        return Ok(get_builtin_modules());
    }

    Ok(modules)
}

/// 获取内置模块
fn get_builtin_modules() -> Vec<Module> {
    vec![
        Module {
            id: "builtin:git".to_string(),
            key: "git".to_string(),
            name: "Git".to_string(),
            description: "Git repository management with clone, pull, status, and log capabilities"
                .to_string(),
            version: "1.0.0".to_string(),
            capabilities: vec![
                "git.clone".to_string(),
                "git.pull".to_string(),
                "git.status".to_string(),
                "git.log".to_string(),
                "git.config".to_string(),
            ],
            config_schema: ModuleConfigSchema {
                schema_type: "object".to_string(),
                title: Some("Git Module Configuration".to_string()),
                description: None,
                properties: {
                    let mut props = std::collections::HashMap::new();
                    props.insert(
                        "autoDetect".to_string(),
                        ModuleConfigProperty {
                            prop_type: "boolean".to_string(),
                            title: Some("Auto-detect repositories".to_string()),
                            description: Some(
                                "Automatically detect Git repositories in this directory".to_string(),
                            ),
                            default: Some(serde_json::json!(true)),
                            enum_values: None,
                            items: None,
                            format: None,
                            min_length: None,
                            max_length: None,
                            minimum: None,
                            maximum: None,
                        },
                    );
                    props.insert(
                        "defaultRemote".to_string(),
                        ModuleConfigProperty {
                            prop_type: "string".to_string(),
                            title: Some("Default remote name".to_string()),
                            description: Some(
                                "The default remote to use for pull/fetch operations".to_string(),
                            ),
                            default: Some(serde_json::json!("origin")),
                            enum_values: None,
                            items: None,
                            format: None,
                            min_length: Some(1),
                            max_length: None,
                            minimum: None,
                            maximum: None,
                        },
                    );
                    props.insert(
                        "autoPull".to_string(),
                        ModuleConfigProperty {
                            prop_type: "boolean".to_string(),
                            title: Some("Auto-pull on startup".to_string()),
                            description: Some(
                                "Automatically pull changes when the directory is opened"
                                    .to_string(),
                            ),
                            default: Some(serde_json::json!(false)),
                            enum_values: None,
                            items: None,
                            format: None,
                            min_length: None,
                            max_length: None,
                            minimum: None,
                            maximum: None,
                        },
                    );
                    props
                },
                required: Some(vec![
                    "autoDetect".to_string(),
                    "defaultRemote".to_string(),
                    "autoPull".to_string(),
                ]),
            },
            default_config: serde_json::json!({
                "autoDetect": true,
                "defaultRemote": "origin",
                "autoPull": false
            }),
            icon: Some("git".to_string()),
            is_built_in: true,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        },
        Module {
            id: "builtin:task".to_string(),
            key: "task".to_string(),
            name: "Tasks".to_string(),
            description: "Task management with status tracking, priorities, and assignments"
                .to_string(),
            version: "1.0.0".to_string(),
            capabilities: vec![
                "task.create".to_string(),
                "task.update".to_string(),
                "task.delete".to_string(),
                "task.list".to_string(),
                "task.status".to_string(),
            ],
            config_schema: ModuleConfigSchema {
                schema_type: "object".to_string(),
                title: Some("Task Module Configuration".to_string()),
                description: None,
                properties: {
                    let mut props = std::collections::HashMap::new();
                    props.insert(
                        "defaultStatus".to_string(),
                        ModuleConfigProperty {
                            prop_type: "string".to_string(),
                            title: Some("Default status for new tasks".to_string()),
                            default: Some(serde_json::json!("todo")),
                            enum_values: Some(vec![
                                serde_json::json!("todo"),
                                serde_json::json!("in_progress"),
                                serde_json::json!("done"),
                            ]),
                            ..Default::default()
                        },
                    );
                    props
                },
                required: Some(vec!["defaultStatus".to_string()]),
            },
            default_config: serde_json::json!({
                "defaultStatus": "todo"
            }),
            icon: Some("task".to_string()),
            is_built_in: true,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        },
        Module {
            id: "builtin:file".to_string(),
            key: "file".to_string(),
            name: "Files".to_string(),
            description: "General file browsing and preview capabilities".to_string(),
            version: "1.0.0".to_string(),
            capabilities: vec![
                "file.browse".to_string(),
                "file.read".to_string(),
                "file.preview".to_string(),
                "file.search".to_string(),
                "file.create".to_string(),
                "file.delete".to_string(),
                "file.rename".to_string(),
            ],
            config_schema: ModuleConfigSchema {
                schema_type: "object".to_string(),
                title: Some("File Module Configuration".to_string()),
                description: None,
                properties: {
                    let mut props = std::collections::HashMap::new();
                    props.insert(
                        "defaultViewMode".to_string(),
                        ModuleConfigProperty {
                            prop_type: "string".to_string(),
                            title: Some("Default view mode".to_string()),
                            description: Some("Preferred view mode for file listing".to_string()),
                            default: Some(serde_json::json!("list")),
                            enum_values: Some(vec![
                                serde_json::json!("list"),
                                serde_json::json!("grid"),
                            ]),
                            ..Default::default()
                        },
                    );
                    props.insert(
                        "showHiddenFiles".to_string(),
                        ModuleConfigProperty {
                            prop_type: "boolean".to_string(),
                            title: Some("Show hidden files".to_string()),
                            description: Some("Whether to show files starting with dot".to_string()),
                            default: Some(serde_json::json!(false)),
                            ..Default::default()
                        },
                    );
                    props.insert(
                        "defaultSortOrder".to_string(),
                        ModuleConfigProperty {
                            prop_type: "string".to_string(),
                            title: Some("Default sort order".to_string()),
                            default: Some(serde_json::json!("name")),
                            enum_values: Some(vec![
                                serde_json::json!("name"),
                                serde_json::json!("size"),
                                serde_json::json!("date"),
                            ]),
                            ..Default::default()
                        },
                    );
                    props
                },
                required: Some(vec![
                    "defaultViewMode".to_string(),
                    "showHiddenFiles".to_string(),
                    "defaultSortOrder".to_string(),
                ]),
            },
            default_config: serde_json::json!({
                "defaultViewMode": "list",
                "showHiddenFiles": false,
                "defaultSortOrder": "name",
                "fileTypeFilters": []
            }),
            icon: Some("file".to_string()),
            is_built_in: true,
            created_at: Utc::now().to_rfc3339(),
            updated_at: Utc::now().to_rfc3339(),
        },
    ]
}

/// 根据 ID 获取模块
#[tauri::command]
pub fn module_get(id: String) -> Result<Module, String> {
    // 先尝试从数据库获取
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let result: Result<Module, _> = conn.query_row(
        "SELECT id, key, name, description, version, capabilities_json, config_schema_json,
                default_config_json, icon, is_built_in, created_at, updated_at
         FROM modules WHERE id = ?1",
        params![id],
        |row| {
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
        },
    );

    match result {
        Ok(module) => Ok(module),
        Err(_) => {
            // 如果数据库中没有，尝试内置模块
            let builtin = get_builtin_modules();
            builtin
                .into_iter()
                .find(|m| m.id == id)
                .ok_or_else(|| format!("模块不存在: {}", id))
        }
    }
}

/// 根据 key 获取模块
#[tauri::command]
pub fn module_get_by_key(key: String) -> Result<Module, String> {
    // 先尝试从数据库获取
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let result: Result<Module, _> = conn.query_row(
        "SELECT id, key, name, description, version, capabilities_json, config_schema_json,
                default_config_json, icon, is_built_in, created_at, updated_at
         FROM modules WHERE key = ?1",
        params![key],
        |row| {
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
        },
    );

    match result {
        Ok(module) => Ok(module),
        Err(_) => {
            // 如果数据库中没有，尝试内置模块
            let builtin = get_builtin_modules();
            builtin
                .into_iter()
                .find(|m| m.key == key)
                .ok_or_else(|| format!("模块不存在: {}", key))
        }
    }
}

/// 创建模块
#[tauri::command]
pub fn module_create(input: serde_json::Value) -> Result<Module, String> {
    let key = input
        .get("key")
        .and_then(|v| v.as_str())
        .ok_or("缺少模块 key")?
        .to_string();

    let name = input
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("缺少模块名称")?
        .to_string();

    let description = input
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let version = input
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("1.0.0")
        .to_string();

    let capabilities: Vec<String> = input
        .get("capabilities")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    let config_schema: ModuleConfigSchema = input
        .get("configSchema")
        .cloned()
        .unwrap_or(serde_json::json!({
            "type": "object",
            "properties": {}
        }))
        .as_object()
        .map(|obj| {
            let mut schema = ModuleConfigSchema {
                schema_type: obj.get("type").and_then(|v| v.as_str()).unwrap_or("object").to_string(),
                title: obj.get("title").and_then(|v| v.as_str()).map(String::from),
                description: obj.get("description").and_then(|v| v.as_str()).map(String::from),
                properties: std::collections::HashMap::new(),
                required: obj.get("required").and_then(|v| v.as_array()).map(|arr| {
                    arr.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                }),
            };
            if let Some(props) = obj.get("properties").and_then(|v| v.as_object()) {
                for (key, val) in props {
                    if let Some(prop_obj) = val.as_object() {
                        let mut prop = ModuleConfigProperty::default();
                        prop.prop_type = prop_obj.get("type").and_then(|v| v.as_str()).unwrap_or("string").to_string();
                        prop.title = prop_obj.get("title").and_then(|v| v.as_str()).map(String::from);
                        prop.description = prop_obj.get("description").and_then(|v| v.as_str()).map(String::from);
                        prop.default = prop_obj.get("default").cloned();
                        prop.enum_values = prop_obj.get("enum").and_then(|v| v.as_array()).cloned();
                        prop.format = prop_obj.get("format").and_then(|v| v.as_str()).map(String::from);
                        prop.min_length = prop_obj.get("minLength").and_then(|v| v.as_i64()).map(|v| v as i32);
                        prop.max_length = prop_obj.get("maxLength").and_then(|v| v.as_i64()).map(|v| v as i32);
                        prop.minimum = prop_obj.get("minimum").and_then(|v| v.as_f64());
                        prop.maximum = prop_obj.get("maximum").and_then(|v| v.as_f64());
                        schema.properties.insert(key.clone(), prop);
                    }
                }
            }
            schema
        })
        .unwrap_or(ModuleConfigSchema {
            schema_type: "object".to_string(),
            title: None,
            description: None,
            properties: std::collections::HashMap::new(),
            required: None,
        });

    let default_config = input
        .get("defaultConfig")
        .cloned()
        .unwrap_or(serde_json::json!({}));

    let icon = input
        .get("icon")
        .and_then(|v| v.as_str())
        .map(String::from);

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    let capabilities_json = serde_json::to_string(&capabilities)
        .map_err(|e| format!("序列化失败: {}", e))?;
    let config_schema_json = serde_json::to_string(&config_schema)
        .map_err(|e| format!("序列化失败: {}", e))?;
    let default_config_json = serde_json::to_string(&default_config)
        .map_err(|e| format!("序列化失败: {}", e))?;

    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    conn.execute(
        "INSERT INTO modules (id, key, name, description, version, capabilities_json,
                             config_schema_json, default_config_json, icon, is_built_in, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10, ?11)",
        params![
            id,
            key,
            name,
            description,
            version,
            capabilities_json,
            config_schema_json,
            default_config_json,
            icon,
            now,
            now
        ],
    )
    .map_err(|e| format!("创建模块失败: {}", e))?;

    Ok(Module {
        id,
        key,
        name,
        description,
        version,
        capabilities,
        config_schema,
        default_config,
        icon,
        is_built_in: false,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// 更新模块
#[tauri::command]
pub fn module_update(id: String, patch: serde_json::Value) -> Result<Module, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 获取当前模块
    let module = module_get(id.clone())?;

    // 不能修改内置模块
    if module.is_built_in {
        return Err("不能修改内置模块".to_string());
    }

    let name = patch
        .get("name")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or(module.name);

    let description = patch
        .get("description")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or(module.description);

    let version = patch
        .get("version")
        .and_then(|v| v.as_str())
        .map(String::from)
        .unwrap_or(module.version);

    let capabilities: Vec<String> = patch
        .get("capabilities")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or(module.capabilities);

    let config_schema: ModuleConfigSchema = patch
        .get("configSchema")
        .cloned()
        .map(|v| {
            if let Some(obj) = v.as_object() {
                let mut schema = ModuleConfigSchema {
                    schema_type: obj.get("type").and_then(|v| v.as_str()).unwrap_or("object").to_string(),
                    title: obj.get("title").and_then(|v| v.as_str()).map(String::from),
                    description: obj.get("description").and_then(|v| v.as_str()).map(String::from),
                    properties: std::collections::HashMap::new(),
                    required: obj.get("required").and_then(|v| v.as_array()).map(|arr| {
                        arr.iter().filter_map(|v| v.as_str().map(String::from)).collect()
                    }),
                };
                if let Some(props) = obj.get("properties").and_then(|v| v.as_object()) {
                    for (key, val) in props {
                        if let Some(prop_obj) = val.as_object() {
                            let mut prop = ModuleConfigProperty::default();
                            prop.prop_type = prop_obj.get("type").and_then(|v| v.as_str()).unwrap_or("string").to_string();
                            prop.title = prop_obj.get("title").and_then(|v| v.as_str()).map(String::from);
                            prop.description = prop_obj.get("description").and_then(|v| v.as_str()).map(String::from);
                            prop.default = prop_obj.get("default").cloned();
                            prop.enum_values = prop_obj.get("enum").and_then(|v| v.as_array()).cloned();
                            prop.format = prop_obj.get("format").and_then(|v| v.as_str()).map(String::from);
                            prop.min_length = prop_obj.get("minLength").and_then(|v| v.as_i64()).map(|v| v as i32);
                            prop.max_length = prop_obj.get("maxLength").and_then(|v| v.as_i64()).map(|v| v as i32);
                            prop.minimum = prop_obj.get("minimum").and_then(|v| v.as_f64());
                            prop.maximum = prop_obj.get("maximum").and_then(|v| v.as_f64());
                            schema.properties.insert(key.clone(), prop);
                        }
                    }
                }
                schema
            } else {
                module.config_schema.clone()
            }
        })
        .unwrap_or(module.config_schema.clone());

    let default_config = patch
        .get("defaultConfig")
        .cloned()
        .unwrap_or(module.default_config.clone());

    let icon = patch
        .get("icon")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or(module.icon);

    let now = Utc::now().to_rfc3339();

    let capabilities_json =
        serde_json::to_string(&capabilities).map_err(|e| format!("序列化失败: {}", e))?;
    let config_schema_json =
        serde_json::to_string(&config_schema).map_err(|e| format!("序列化失败: {}", e))?;
    let default_config_json =
        serde_json::to_string(&default_config).map_err(|e| format!("序列化失败: {}", e))?;

    conn.execute(
        "UPDATE modules SET name = ?1, description = ?2, version = ?3, capabilities_json = ?4,
                           config_schema_json = ?5, default_config_json = ?6, icon = ?7, updated_at = ?8
         WHERE id = ?9",
        params![
            name,
            description,
            version,
            capabilities_json,
            config_schema_json,
            default_config_json,
            icon,
            now,
            id
        ],
    )
    .map_err(|e| format!("更新模块失败: {}", e))?;

    Ok(Module {
        id,
        key: module.key,
        name,
        description,
        version,
        capabilities,
        config_schema,
        default_config,
        icon,
        is_built_in: false,
        created_at: module.created_at,
        updated_at: now,
    })
}

/// 删除模块
#[tauri::command]
pub fn module_delete(id: String) -> Result<(), String> {
    // 不能删除内置模块
    if id.starts_with("builtin:") {
        return Err("不能删除内置模块".to_string());
    }

    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    // 检查是否有目录使用此模块
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM directories WHERE module_id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("查询失败: {}", e))?;

    if count > 0 {
        return Err(format!(
            "有 {} 个目录正在使用此模块，请先移除模块绑定",
            count
        ));
    }

    conn.execute("DELETE FROM modules WHERE id = ?1", params![id])
        .map_err(|e| format!("删除模块失败: {}", e))?;

    Ok(())
}

/// 验证模块配置
#[tauri::command]
pub fn module_validate_config(
    id: String,
    config: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let module = module_get(id)?;

    let schema = &module.config_schema;
    let mut errors: Vec<String> = Vec::new();

    // 检查必填字段
    if let Some(required) = &schema.required {
        for field in required {
            if !config.get(field).is_some() {
                errors.push(format!("缺少必填字段: {}", field));
            }
        }
    }

    // 验证字段类型和约束
    for (key, value) in config.as_object().unwrap_or(&serde_json::Map::new()) {
        if let Some(prop) = schema.properties.get(key) {
            // 类型检查
            match prop.prop_type.as_str() {
                "string" => {
                    if !value.is_string() {
                        errors.push(format!("{} 必须是字符串", key));
                    }
                    if let Some(min) = prop.min_length {
                        if let Some(s) = value.as_str() {
                            if s.len() < min as usize {
                                errors.push(format!("{} 长度必须至少为 {}", key, min));
                            }
                        }
                    }
                    if let Some(max) = prop.max_length {
                        if let Some(s) = value.as_str() {
                            if s.len() > max as usize {
                                errors.push(format!("{} 长度必须最多为 {}", key, max));
                            }
                        }
                    }
                }
                "number" | "integer" => {
                    if !value.is_number() {
                        errors.push(format!("{} 必须是数字", key));
                    }
                    if let Some(min) = prop.minimum {
                        if let Some(n) = value.as_f64() {
                            if n < min {
                                errors.push(format!("{} 必须大于等于 {}", key, min));
                            }
                        }
                    }
                    if let Some(max) = prop.maximum {
                        if let Some(n) = value.as_f64() {
                            if n > max {
                                errors.push(format!("{} 必须小于等于 {}", key, max));
                            }
                        }
                    }
                }
                "boolean" => {
                    if !value.is_boolean() {
                        errors.push(format!("{} 必须是布尔值", key));
                    }
                }
                "array" => {
                    if !value.is_array() {
                        errors.push(format!("{} 必须是数组", key));
                    }
                }
                "object" => {
                    if !value.is_object() {
                        errors.push(format!("{} 必须是对象", key));
                    }
                }
                _ => {}
            }

            // 枚举检查
            if let Some(enums) = &prop.enum_values {
                if !enums.contains(value) {
                    errors.push(format!(
                        "{} 的值无效，必须是其中一个: {:?}",
                        key,
                        enums.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect::<Vec<_>>()
                    ));
                }
            }
        } else {
            errors.push(format!("未知的字段: {}", key));
        }
    }

    Ok(serde_json::json!({
        "valid": errors.is_empty(),
        "errors": errors
    }))
}
