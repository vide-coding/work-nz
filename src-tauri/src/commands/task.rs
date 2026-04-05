use crate::types::Task;
use crate::with_db;
use rusqlite::params;

/// 获取单个任务（辅助函数）
fn task_get(id: String) -> Result<Task, String> {
    with_db!(conn, {
        conn.query_row(
            "SELECT id, directory_id, parent_id, title, description, status, priority,
                    assignee, due_date, sort_order, is_completed, created_at, updated_at
             FROM tasks WHERE id = ?1",
            params![id],
            |row| {
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
            },
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
            .query_map(params![directory_id], |row| {
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
            })
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
) -> Result<Task, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    with_db!(conn, {
        let max_order: Option<i32> = conn
            .query_row(
                "SELECT MAX(sort_order) FROM tasks WHERE directory_id = ?1 AND parent_id IS NULL",
                params![directory_id],
                |row| row.get(0),
            )
            .unwrap_or(None);

        let sort_order = max_order.unwrap_or(-1) + 1;

        conn.execute(
            "INSERT INTO tasks (id, directory_id, parent_id, title, description, status, priority,
                               assignee, due_date, sort_order, is_completed, created_at, updated_at)
             VALUES (?1, ?2, NULL, ?3, ?4, 'todo', ?5, ?6, ?7, ?8, 0, ?9, ?10)",
            params![
                id,
                directory_id,
                title,
                description,
                priority.unwrap_or_else(|| "medium".to_string()),
                assignee,
                due_date,
                sort_order,
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
            .query_map(params![parent_id], |row| {
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
            })
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
        let parent: Task = conn.query_row(
            "SELECT id, directory_id, parent_id, title, description, status, priority,
                    assignee, due_date, sort_order, is_completed, created_at, updated_at
             FROM tasks WHERE id = ?1",
            params![parent_id],
            |row| {
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
            },
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
