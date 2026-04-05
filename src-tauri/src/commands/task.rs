use crate::types::{Task, TaskColumn};
use crate::with_db;
use crate::with_db_mut;
use crate::db_helpers::{map_task_row, map_task_column_row};
use rusqlite::params;

/// 获取单个任务（辅助函数）
fn task_get(id: String) -> Result<Task, String> {
    with_db!(conn, {
        conn.query_row(
            "SELECT id, directory_id, parent_id, title, description, status, priority,
                    assignee, due_date, sort_order, is_completed, created_at, updated_at
             FROM tasks WHERE id = ?1",
            params![id],
            map_task_row,
        )
        .map_err(|e| format!("任务不存在: {}", e))
    })
}

/// 获取目录下所有顶层任务（parent_id IS NULL）
#[tauri::command]
pub fn task_list(directory_id: String) -> Result<Vec<Task>, String> {
    with_db!(conn, {
        let mut stmt = conn
            .prepare(
                "SELECT id, directory_id, parent_id, title, description, status, priority,
                        assignee, due_date, sort_order, is_completed, created_at, updated_at
                 FROM tasks
                 WHERE directory_id = ?1 AND parent_id IS NULL
                 ORDER BY sort_order ASC",
            )
            .map_err(|e| format!("查询失败: {}", e))?;

        let tasks = stmt
            .query_map(params![directory_id], map_task_row)
            .map_err(|e| format!("查询失败: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取数据失败: {}", e))?;

        Ok(tasks)
    })
}

/// 创建新任务
#[tauri::command]
pub fn task_create(
    directory_id: String,
    title: String,
    description: Option<String>,
    priority: Option<String>,
    assignee: Option<String>,
    due_date: Option<String>,
    status: Option<String>,
    sort_order: Option<i32>,
) -> Result<Task, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    with_db!(conn, {
        // 如果指定了 sort_order，则将 >= 该值的任务往后挪
        if let Some(order) = sort_order {
            conn.execute(
                "UPDATE tasks SET sort_order = sort_order + 1
                 WHERE directory_id = ?1 AND parent_id IS NULL AND sort_order >= ?2",
                params![directory_id, order],
            )
            .map_err(|e| format!("更新排序失败: {}", e))?;
        }

        // 计算最终的 sort_order
        let final_sort_order = if let Some(order) = sort_order {
            order
        } else {
            // 默认排在最后
            let max_order: Option<i32> = conn
                .query_row(
                    "SELECT MAX(sort_order) FROM tasks WHERE directory_id = ?1 AND parent_id IS NULL",
                    params![directory_id],
                    |row| row.get(0),
                )
                .unwrap_or(None);
            max_order.unwrap_or(-1) + 1
        };

        let status = status.unwrap_or_else(|| "todo".to_string());

        conn.execute(
            "INSERT INTO tasks (id, directory_id, parent_id, title, description, status, priority,
                               assignee, due_date, sort_order, is_completed, created_at, updated_at)
             VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0, ?10, ?11)",
            params![
                id,
                directory_id,
                title,
                description,
                status,
                priority.unwrap_or_else(|| "medium".to_string()),
                assignee,
                due_date,
                final_sort_order,
                now,
                now
            ],
        )
        .map_err(|e| format!("创建任务失败: {}", e))?;
    });

    task_get(id)
}

/// 更新任务
#[tauri::command]
pub fn task_update(id: String, patch: serde_json::Value) -> Result<Task, String> {
    let task = task_get(id.clone())?;
    let now = chrono::Utc::now().to_rfc3339();

    let title = patch.get("title").and_then(|v| v.as_str()).map(String::from).unwrap_or(task.title);
    let description = patch.get("description").and_then(|v| v.as_str()).map(String::from).or(task.description);
    let status = patch.get("status").and_then(|v| v.as_str()).map(String::from).unwrap_or(task.status);
    let priority = patch.get("priority").and_then(|v| v.as_str()).map(String::from).unwrap_or(task.priority);
    let assignee = patch.get("assignee").and_then(|v| v.as_str()).map(String::from).or(task.assignee);
    let due_date = patch.get("dueDate").and_then(|v| v.as_str()).map(String::from).or(task.due_date);

    with_db!(conn, {
        conn.execute(
            "UPDATE tasks SET title = ?1, description = ?2, status = ?3, priority = ?4,
                             assignee = ?5, due_date = ?6, updated_at = ?7
             WHERE id = ?8",
            params![title, description, status, priority, assignee, due_date, now, id],
        )
        .map_err(|e| format!("更新任务失败: {}", e))?;
    });

    task_get(id)
}

/// 删除任务（同时删除子任务）
#[tauri::command]
pub fn task_delete(id: String) -> Result<(), String> {
    with_db!(conn, {
        conn.execute(
            "DELETE FROM tasks WHERE parent_id = ?1",
            params![id],
        )
        .map_err(|e| format!("删除子任务失败: {}", e))?;

        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
            .map_err(|e| format!("删除任务失败: {}", e))?;
    });

    Ok(())
}

/// 拖拽后更新任务状态和排序
#[tauri::command]
pub fn task_reorder(id: String, new_status: String, new_sort_order: i32) -> Result<Task, String> {
    let now = chrono::Utc::now().to_rfc3339();

    with_db!(conn, {
        conn.execute(
            "UPDATE tasks SET sort_order = sort_order + 1
             WHERE directory_id = (SELECT directory_id FROM tasks WHERE id = ?1)
               AND parent_id IS NULL AND status = ?2 AND sort_order >= ?3",
            params![id, new_status, new_sort_order],
        )
        .map_err(|e| format!("更新排序失败: {}", e))?;

        conn.execute(
            "UPDATE tasks SET status = ?1, sort_order = ?2, updated_at = ?3 WHERE id = ?4",
            params![new_status, new_sort_order, now, id],
        )
        .map_err(|e| format!("更新任务失败: {}", e))?;
    });

    task_get(id)
}

/// 获取子任务列表
#[tauri::command]
pub fn task_list_children(parent_id: String) -> Result<Vec<Task>, String> {
    with_db!(conn, {
        let mut stmt = conn
            .prepare(
                "SELECT id, directory_id, parent_id, title, description, status, priority,
                        assignee, due_date, sort_order, is_completed, created_at, updated_at
                 FROM tasks
                 WHERE parent_id = ?1
                 ORDER BY sort_order ASC",
            )
            .map_err(|e| format!("查询失败: {}", e))?;

        let tasks = stmt
            .query_map(params![parent_id], map_task_row)
            .map_err(|e| format!("查询失败: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取数据失败: {}", e))?;

        Ok(tasks)
    })
}

/// 切换子任务完成状态
#[tauri::command]
pub fn task_toggle_complete(id: String) -> Result<Task, String> {
    let task = task_get(id.clone())?;

    with_db!(conn, {
        let new_completed = if task.is_completed { 0 } else { 1 };
        conn.execute(
            "UPDATE tasks SET is_completed = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_completed, chrono::Utc::now().to_rfc3339(), id],
        )
        .map_err(|e| format!("更新完成状态失败: {}", e))?;
    });

    task_get(id)
}

/// 创建子任务
#[tauri::command]
pub fn task_create_child(
    parent_id: String,
    title: String,
) -> Result<Task, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    with_db!(conn, {
        // 获取父任务信息（用于 directory_id）
        let parent = conn.query_row(
            "SELECT id, directory_id, parent_id, title, description, status, priority,
                    assignee, due_date, sort_order, is_completed, created_at, updated_at
             FROM tasks WHERE id = ?1",
            params![parent_id],
            map_task_row,
        )
        .map_err(|e| format!("父任务不存在: {}", e))?;

        let max_order: Option<i32> = conn
            .query_row(
                "SELECT MAX(sort_order) FROM tasks WHERE parent_id = ?1",
                params![parent_id],
                |row| row.get(0),
            )
            .unwrap_or(None);

        let sort_order = max_order.unwrap_or(-1) + 1;

        conn.execute(
            "INSERT INTO tasks (id, directory_id, parent_id, title, description, status, priority,
                               assignee, due_date, sort_order, is_completed, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, NULL, '', '', NULL, NULL, ?5, 0, ?6, ?7)",
            params![
                id,
                parent.directory_id,
                parent_id,
                title,
                sort_order,
                now,
                now
            ],
        )
        .map_err(|e| format!("创建子任务失败: {}", e))?;
    });

    task_get(id)
}

/// 删除子任务
#[tauri::command]
pub fn task_delete_child(id: String) -> Result<(), String> {
    with_db!(conn, {
        conn.execute("DELETE FROM tasks WHERE id = ?1 AND parent_id IS NOT NULL", params![id])
            .map_err(|e| format!("删除子任务失败: {}", e))?;
    });
    Ok(())
}

// ============ 列配置命令 ============

fn column_get(id: String) -> Result<TaskColumn, String> {
    with_db!(conn, {
        conn.query_row(
            "SELECT id, directory_id, status_key, name, color, sort_order, is_visible, created_at, updated_at
             FROM task_columns WHERE id = ?1",
            params![id],
            map_task_column_row,
        )
        .map_err(|e| format!("列不存在: {}", e))
    })
}

/// 获取目录下所有列配置
#[tauri::command]
pub fn task_column_list(directory_id: String) -> Result<Vec<TaskColumn>, String> {
    with_db!(conn, {
        let mut stmt = conn
            .prepare(
                "SELECT id, directory_id, status_key, name, color, sort_order, is_visible, created_at, updated_at
                 FROM task_columns WHERE directory_id = ?1 ORDER BY sort_order ASC",
            )
            .map_err(|e| format!("查询失败: {}", e))?;

        let columns = stmt
            .query_map(params![directory_id], map_task_column_row)
            .map_err(|e| format!("查询失败: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取数据失败: {}", e))?;

        Ok(columns)
    })
}

/// 创建新列
#[tauri::command]
pub fn task_column_create(
    directory_id: String,
    status_key: String,
    name: String,
    color: String,
) -> Result<TaskColumn, String> {
    // 检查 status_key 是否重复
    with_db!(conn, {
        let exists: Option<i32> = conn
            .query_row(
                "SELECT 1 FROM task_columns WHERE directory_id = ?1 AND status_key = ?2",
                params![directory_id, status_key],
                |row| row.get(0),
            )
            .ok()
            .flatten();
        if exists.is_some() {
            return Err("该列已存在".to_string());
        }
    });

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    with_db!(conn, {
        let max_order: Option<i32> = conn
            .query_row(
                "SELECT MAX(sort_order) FROM task_columns WHERE directory_id = ?1",
                params![directory_id],
                |row| row.get(0),
            )
            .unwrap_or(None);

        let sort_order = max_order.unwrap_or(-1) + 1;

        conn.execute(
            "INSERT INTO task_columns (id, directory_id, status_key, name, color, sort_order, is_visible, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?8)",
            params![id, directory_id, status_key, name, color, sort_order, now, now],
        )
        .map_err(|e| format!("创建列失败: {}", e))?;
    });

    column_get(id)
}

/// 更新列（名称/颜色/排序）
#[tauri::command]
pub fn task_column_update(id: String, patch: serde_json::Value) -> Result<TaskColumn, String> {
    let col = column_get(id.clone())?;
    let now = chrono::Utc::now().to_rfc3339();

    let name = patch.get("name").and_then(|v| v.as_str()).map(String::from).unwrap_or(col.name);
    let color = patch.get("color").and_then(|v| v.as_str()).map(String::from).unwrap_or(col.color);
    let sort_order = patch.get("sortOrder").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(col.sort_order);

    with_db!(conn, {
        conn.execute(
            "UPDATE task_columns SET name = ?1, color = ?2, sort_order = ?3, updated_at = ?4 WHERE id = ?5",
            params![name, color, sort_order, now, id],
        )
        .map_err(|e| format!("更新列失败: {}", e))?;
    });

    column_get(id)
}

/// 切换列显示/隐藏
#[tauri::command]
pub fn task_column_toggle_visibility(id: String) -> Result<TaskColumn, String> {
    let col = column_get(id.clone())?;
    let now = chrono::Utc::now().to_rfc3339();
    let new_visible = if col.is_visible { 0 } else { 1 };

    with_db!(conn, {
        conn.execute(
            "UPDATE task_columns SET is_visible = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_visible, now, id],
        )
        .map_err(|e| format!("切换显示状态失败: {}", e))?;
    });

    column_get(id)
}

/// 删除列（任务迁移到默认列）
#[tauri::command]
pub fn task_column_delete(id: String) -> Result<(), String> {
    with_db_mut!(conn, {
        let result: Result<(), String> = (|| {
            let tx = conn.transaction().map_err(|e| format!("开启事务失败: {}", e))?;

            // 获取该列信息
            let col: TaskColumn = tx.query_row(
                "SELECT id, directory_id, status_key, name, color, sort_order, is_visible, created_at, updated_at
                 FROM task_columns WHERE id = ?1",
                params![id],
                map_task_column_row,
            )
            .map_err(|e| format!("列不存在: {}", e))?;

            // 检查是否只剩一列
            let count: i32 = tx
                .query_row(
                    "SELECT COUNT(*) FROM task_columns WHERE directory_id = ?1",
                    params![col.directory_id],
                    |row| row.get(0),
                )
                .unwrap_or(0);

            if count <= 1 {
                return Err("至少保留一列".to_string());
            }

            // 查找目标列（优先 todo，其次按 sort_order 第一）
            let target_key: String = tx
                .query_row(
                    "SELECT status_key FROM task_columns
                     WHERE directory_id = ?1 AND id != ?2
                     ORDER BY CASE WHEN status_key = 'todo' THEN 0 ELSE 1 END, sort_order ASC
                     LIMIT 1",
                    params![col.directory_id, id],
                    |row| row.get(0),
                )
                .map_err(|e| format!("查找目标列失败: {}", e))?;

            // 将该列任务迁移到目标列
            tx.execute(
                "UPDATE tasks SET status = ?1 WHERE directory_id = ?2 AND status = ?3 AND parent_id IS NULL",
                params![target_key, col.directory_id, col.status_key],
            )
            .map_err(|e| format!("迁移任务失败: {}", e))?;

            // 删除列
            tx.execute("DELETE FROM task_columns WHERE id = ?1", params![id])
                .map_err(|e| format!("删除列失败: {}", e))?;

            // 提交事务
            tx.commit().map_err(|e| format!("提交事务失败: {}", e))?;

            Ok(())
        })();
        result
    })
}

/// 为目录初始化默认列（当目录启用 task 模块时调用）
#[tauri::command]
pub fn task_column_init_defaults(directory_id: String) -> Result<Vec<TaskColumn>, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let defaults = vec![
        ("todo", "To Do", "#9CA3AF", 0),
        ("in_progress", "In Progress", "#3B82F6", 1),
        ("done", "Done", "#10B981", 2),
    ];

    with_db!(conn, {
        let mut err_msg = String::new();
        for (status_key, name, color, sort_order) in defaults {
            if let Err(e) = conn.execute(
                "INSERT OR IGNORE INTO task_columns (id, directory_id, status_key, name, color, sort_order, is_visible, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?8)",
                params![
                    uuid::Uuid::new_v4().to_string(),
                    directory_id,
                    status_key,
                    name,
                    color,
                    sort_order,
                    now,
                    now
                ],
            ) {
                err_msg = format!("创建列失败: {}", e);
            }
        }
        if !err_msg.is_empty() {
            return Err(err_msg);
        }
    });

    task_column_list(directory_id)
}

