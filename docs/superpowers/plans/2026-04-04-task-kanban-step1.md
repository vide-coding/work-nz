# 任务看板模块 - 第 1 步：基础看板实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现固定 3 列看板（To Do / In Progress / Done）加上任务 CRUD、优先级、指派人和快速添加功能

**Architecture:** 遵循项目现有架构模式：Rust 后端使用 `rusqlite` + `with_db!` 宏，前端用 `invoke` 调用 Tauri 命令，Vue 组件封装 UI，`useTaskModule.ts` 作为数据层。拖拽使用已安装的 `vuedraggable`。

**Tech Stack:** Rust (`rusqlite`), Vue 3, TypeScript, `vuedraggable`, `@tauri-apps/api/core`

---

## 文件结构

```
src-tauri/src/
├── db/schema.rs                   # 修改：添加 tasks 表
├── types/mod.rs                   # 修改：添加 Task 类型
└── commands/
    ├── mod.rs                     # 修改：添加 task 模块注册
    └── task.rs                    # 新建：task_list/create/update/delete/reorder

src/
├── types/index.ts                 # 修改：添加 Task 类型
├── composables/
│   ├── useApi.ts                  # 修改：添加 taskApi
│   └── useTaskModule.ts          # 修改：改为调用实际 API
├── components/module/
│   ├── ModuleContentArea.vue      # 修改：替换 task 提示为 TaskBoardView
│   ├── TaskBoardView.vue          # 新建：看板主视图
│   ├── TaskColumn.vue             # 新建：单列
│   ├── TaskCard.vue               # 新建：任务卡片
│   ├── TaskDetailPanel.vue        # 新建：右侧详情滑出面板
│   ├── TaskQuickAdd.vue           # 新建：顶部快速添加栏
│   └── TaskCreateDialog.vue       # 新建：新建任务对话框
└── locales/lang/
    ├── en-US.json                 # 修改：添加 task 相关翻译
    └── zh-CN.json                 # 修改：添加 task 相关翻译
```

---

## 依赖说明

- `vuedraggable` 已在 `package.json` 中安装，直接使用
- `lucide-vue-next` 已在使用，图标复用现有图标

---

## Step 1: 数据库 schema - 添加 tasks 表

**文件:** `src-tauri/src/db/schema.rs`

- [ ] **Step 1: 添加 tasks 表到 SCHEMA 常量**

在 `SCHEMA` 常量的末尾（`-- Indexes for new tables` 注释之前）添加：

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  directory_id TEXT NOT NULL,
  parent_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  assignee TEXT,
  due_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (directory_id) REFERENCES directories(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_directory_id ON tasks(directory_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
```

---

## Step 2: Rust 类型 - 添加 Task 类型

**文件:** `src-tauri/src/types/mod.rs`

- [ ] **Step 1: 在 `types/mod.rs` 文件末尾添加 Task 类型**

在文件最后一个 `}` 之后添加：

```rust
// ============== Task System Types ==============

/// Task priority
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TaskPriority {
    Low,
    Medium,
    High,
    Urgent,
}

impl Default for TaskPriority {
    fn default() -> Self {
        TaskPriority::Medium
    }
}

/// Task
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub directory_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assignee: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due_date: Option<String>,
    pub sort_order: i32,
    pub is_completed: bool,
    pub created_at: String,
    pub updated_at: String,
}
```

同时在 `#[cfg(test)]` 模块内添加测试：

```rust
#[test]
fn test_task_priority_default() {
    assert_eq!(TaskPriority::default(), TaskPriority::Medium);
}

#[test]
fn test_task_serialization() {
    let task = Task {
        id: "task-1".to_string(),
        directory_id: "dir-1".to_string(),
        parent_id: None,
        title: "Test Task".to_string(),
        description: Some("Description".to_string()),
        status: "todo".to_string(),
        priority: "high".to_string(),
        assignee: Some("Alice".to_string()),
        due_date: None,
        sort_order: 0,
        is_completed: false,
        created_at: "2024-01-01T00:00:00Z".to_string(),
        updated_at: "2024-01-01T00:00:00Z".to_string(),
    };

    let json = serde_json::to_string(&task).unwrap();
    assert!(json.contains("Test Task"));
    assert!(json.contains("todo"));
}
```

---

## Step 3: Rust 命令 - task.rs

**文件:** `src-tauri/src/commands/task.rs` (新建)

- [ ] **Step 1: 编写 task_list 命令**

```rust
use crate::types::Task;
use crate::with_db;
use rusqlite::params;

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
```

- [ ] **Step 2: 编写 task_create 命令**

```rust
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

    // 获取当前最大 sort_order
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

    // 返回创建的任务
    task_get(id)
}

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
```

- [ ] **Step 3: 编写 task_update 命令**

```rust
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
```

- [ ] **Step 4: 编写 task_delete 命令**

```rust
/// 删除任务（同时删除子任务）
#[tauri::command]
pub fn task_delete(id: String) -> Result<(), String> {
    with_db!(conn, {
        // 先删除子任务
        conn.execute(
            "DELETE FROM tasks WHERE parent_id = ?1",
            params![id],
        )
        .map_err(|e| format!("删除子任务失败: {}", e))?;

        // 再删除任务本身
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
            .map_err(|e| format!("删除任务失败: {}", e))?;
    });

    Ok(())
}
```

- [ ] **Step 5: 编写 task_reorder 命令**

```rust
/// 拖拽后更新任务状态和排序
#[tauri::command]
pub fn task_reorder(id: String, new_status: String, new_sort_order: i32) -> Result<Task, String> {
    let now = chrono::Utc::now().to_rfc3339();

    with_db!(conn, {
        // 先把被挤占的任务 sort_order +1
        conn.execute(
            "UPDATE tasks SET sort_order = sort_order + 1
             WHERE directory_id = (SELECT directory_id FROM tasks WHERE id = ?1)
               AND parent_id IS NULL AND status = ?2 AND sort_order >= ?3",
            params![id, new_status, new_sort_order],
        )
        .map_err(|e| format!("更新排序失败: {}", e))?;

        // 更新当前任务
        conn.execute(
            "UPDATE tasks SET status = ?1, sort_order = ?2, updated_at = ?3 WHERE id = ?4",
            params![new_status, new_sort_order, now, id],
        )
        .map_err(|e| format!("更新任务失败: {}", e))?;
    });

    task_get(id)
}
```

- [ ] **Step 6: 验证 Rust 编译**

Run: `cd src-tauri && cargo build`
Expected: 无编译错误

---

## Step 4: 注册 task 模块到 commands/mod.rs

**文件:** `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: 添加 task 模块**

在 `pub mod workspace;` 后添加：

```rust
pub mod task;
pub use task::*;
```

---

## Step 5: 前端类型 - Task 类型

**文件:** `src/types/index.ts`

- [ ] **Step 1: 在文件末尾添加 Task 类型**

在最后一个类型定义后添加：

```typescript
/**
 * Task priority
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

/**
 * Task - represents a task in the task board
 */
export interface Task {
  id: string
  directoryId: string
  parentId?: string        // Step 2 启用
  title: string
  description?: string
  status: string           // todo | in_progress | done
  priority: string         // low | medium | high | urgent
  assignee?: string
  dueDate?: string
  sortOrder: number
  isCompleted: boolean     // Step 2 启用
  createdAt: string
  updatedAt: string
}
```

---

## Step 6: 前端 API - taskApi

**文件:** `src/composables/useApi.ts`

- [ ] **Step 1: 导入 Task 类型**

在 `import type {` 的类型列表中添加：
```typescript
Task,
```

- [ ] **Step 2: 在 `templateApi` 之后添加 taskApi**

```typescript
// Task API
export const taskApi = {
  async list(directoryId: string): Promise<Task[]> {
    return invoke('task_list', { directoryId })
  },

  async create(
    directoryId: string,
    title: string,
    description?: string,
    priority?: string,
    assignee?: string,
    dueDate?: string
  ): Promise<Task> {
    return invoke('task_create', { directoryId, title, description, priority, assignee, dueDate })
  },

  async update(id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'dueDate'>>): Promise<Task> {
    return invoke('task_update', { id, patch })
  },

  async delete(id: string): Promise<void> {
    return invoke('task_delete', { id })
  },

  async reorder(id: string, newStatus: string, newSortOrder: number): Promise<Task> {
    return invoke('task_reorder', { id, newStatus, newSortOrder })
  },
}
```

---

## Step 7: useTaskModule 改造

**文件:** `src/composables/useTaskModule.ts`

- [ ] **Step 1: 添加 taskApi 导入**

在文件顶部添加：
```typescript
import { taskApi } from './useApi'
```

- [ ] **Step 2: 修改 loadTasks 函数**

将 mock 数据部分替换为：
```typescript
async function loadTasks() {
  if (!hasTaskCapability.value) {
    error.value = 'Task module not enabled for this directory'
    return
  }

  loading.value = true
  error.value = null
  try {
    const allTasks = await taskApi.list(directory.id)
    tasks.value = allTasks
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load tasks'
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 3: 修改 createTask 函数**

```typescript
async function createTask(input: {
  title: string
  description?: string
  priority?: string
  assignee?: string
  dueDate?: string
}): Promise<Task | null> {
  if (!hasTaskCapability.value) {
    error.value = 'Task module not enabled for this directory'
    return null
  }

  loading.value = true
  error.value = null
  try {
    const newTask = await taskApi.create(
      directory.id,
      input.title,
      input.description,
      input.priority,
      input.assignee,
      input.dueDate
    )
    tasks.value.push(newTask)
    return newTask
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create task'
    return null
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 4: 修改 updateTask 函数**

```typescript
async function updateTask(
  taskId: string,
  patch: Partial<
    Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'dueDate'>
  >
): Promise<Task | null> {
  if (!hasTaskCapability.value) {
    error.value = 'Task module not enabled for this directory'
    return null
  }

  loading.value = true
  error.value = null
  try {
    const updated = await taskApi.update(taskId, patch)
    const index = tasks.value.findIndex((t) => t.id === taskId)
    if (index !== -1) {
      tasks.value[index] = updated
    }
    return updated
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to update task'
    return null
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 5: 修改 deleteTask 函数**

```typescript
async function deleteTask(taskId: string): Promise<boolean> {
  if (!hasTaskCapability.value) {
    error.value = 'Task module not enabled for this directory'
    return false
  }

  loading.value = true
  error.value = null
  try {
    await taskApi.delete(taskId)
    const index = tasks.value.findIndex((t) => t.id === taskId)
    if (index !== -1) {
      tasks.value.splice(index, 1)
    }
    return true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to delete task'
    return false
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 6: 添加 reorderTask 方法**

在 `clearFilter` 函数后添加：

```typescript
async function reorderTask(taskId: string, newStatus: string, newSortOrder: number): Promise<Task | null> {
  if (!hasTaskCapability.value) return null

  loading.value = true
  error.value = null
  try {
    const updated = await taskApi.reorder(taskId, newStatus, newSortOrder)
    const index = tasks.value.findIndex((t) => t.id === taskId)
    if (index !== -1) {
      tasks.value[index] = updated
    }
    return updated
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to reorder task'
    return null
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 7: 更新返回值**

在 return 语句中添加 `reorderTask`：

```typescript
return {
  // ... existing exports ...
  deleteTask,
  reorderTask,  // 添加这行
  setFilter,
  setSort,
  clearFilter,
}
```

- [ ] **Step 8: 验证 TypeScript 编译**

Run: `cd src && npx vue-tsc --noEmit`
Expected: 无类型错误（Task 类型需要与后端一致）

---

## Step 8: i18n 翻译

**文件:** `src/locales/lang/en-US.json`

- [ ] **Step 1: 添加 task 相关翻译**

在 en-US.json 中添加：

```json
"task": {
  "quickAdd": "Quick add task...",
  "add": "Add",
  "todo": "To Do",
  "inProgress": "In Progress",
  "done": "Done",
  "priority": "Priority",
  "assignee": "Assignee",
  "dueDate": "Due Date",
  "description": "Description",
  "status": "Status",
  "delete": "Delete Task",
  "deleteConfirm": "Are you sure you want to delete this task?",
  "noTasks": "No tasks yet",
  "createFirst": "Create your first task"
}
```

**文件:** `src/locales/lang/zh-CN.json`

- [ ] **Step 2: 添加中文翻译**

```json
"task": {
  "quickAdd": "快速添加任务...",
  "add": "添加",
  "todo": "待办",
  "inProgress": "进行中",
  "done": "已完成",
  "priority": "优先级",
  "assignee": "指派人",
  "dueDate": "截止日期",
  "description": "描述",
  "status": "状态",
  "delete": "删除任务",
  "deleteConfirm": "确定要删除这个任务吗？",
  "noTasks": "暂无任务",
  "createFirst": "创建你的第一个任务"
}
```

---

## Step 9: TaskCard 组件

**文件:** `src/components/module/TaskCard.vue` (新建)

- [ ] **Step 1: 编写 TaskCard.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { GripVertical } from 'lucide-vue-next'
import type { Task } from '@/types'

interface Props {
  task: Task
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: [task: Task]
}>()

const priorityColors: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#10B981',
  low: '#9CA3AF',
}

const priorityColor = computed(() => priorityColors[props.task.priority] || '#9CA3AF')
</script>

<template>
  <div class="task-card" @click="emit('click', props.task)">
    <div class="task-card__drag-handle">
      <GripVertical :size="14" />
    </div>
    <div class="task-card__content">
      <div class="task-card__title">{{ task.title }}</div>
      <div class="task-card__meta">
        <span
          class="task-card__priority"
          :style="{ backgroundColor: priorityColor }"
          :title="task.priority"
        />
        <span v-if="task.assignee" class="task-card__assignee">
          {{ task.assignee }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.task-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.task-card__drag-handle {
  color: #d1d5db;
  cursor: grab;
  flex-shrink: 0;
  padding-top: 2px;
}

.task-card__drag-handle:active {
  cursor: grabbing;
}

.task-card__content {
  flex: 1;
  min-width: 0;
}

.task-card__title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.task-card__priority {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-card__assignee {
  font-size: 12px;
  color: #6b7280;
}
</style>
```

---

## Step 10: TaskColumn 组件

**文件:** `src/components/module/TaskColumn.vue` (新建)

- [ ] **Step 1: 编写 TaskColumn.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import type { Task } from '@/types'
import TaskCard from './TaskCard.vue'

interface Props {
  statusKey: string
  statusName: string
  statusColor: string
  tasks: Task[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'task-click': [task: Task]
  'add-task': [statusKey: string]
  'tasks-changed': [evt: { moved?: { element: Task; newIndex: number; oldIndex: number } }]
}>()

const localTasks = computed({
  get: () => props.tasks,
  set: (val) => emit('tasks-changed', { tasks: val }),
})

function onTaskClick(task: Task) {
  emit('task-click', task)
}

function onAddClick() {
  emit('add-task', props.statusKey)
}
</script>

<template>
  <div class="task-column">
    <div class="task-column__header">
      <span
        class="task-column__dot"
        :style="{ backgroundColor: statusColor }"
      />
      <span class="task-column__name">{{ statusName }}</span>
      <span class="task-column__count">{{ tasks.length }}</span>
      <button class="task-column__add" @click="onAddClick" :title="$t('task.add')">
        <Plus :size="14" />
      </button>
    </div>

    <div class="task-column__body">
      <draggable
        v-model="localTasks"
        :group="{ name: 'tasks' }"
        item-key="id"
        class="task-column__list"
        ghost-class="task-card--ghost"
        drag-class="task-card--drag"
      >
        <template #item="{ element }">
          <TaskCard :task="element" @click="onTaskClick" />
        </template>
      </draggable>

      <div v-if="tasks.length === 0" class="task-column__empty">
        {{ $t('task.noTasks') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-column {
  display: flex;
  flex-direction: column;
  min-width: 280px;
  max-width: 320px;
  flex: 1;
  background: #f9fafb;
  border-radius: 12px;
  overflow: hidden;
}

.task-column__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.task-column__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-column__name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  flex: 1;
}

.task-column__count {
  font-size: 12px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
}

.task-column__add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9ca3af;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.task-column__add:hover {
  background: #f3f4f6;
  color: #374151;
}

.task-column__body {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.task-column__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 40px;
}

.task-column__empty {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  padding: 24px 0;
}
</style>

<style>
/* Global drag styles */
.task-card--ghost {
  opacity: 0.4;
  background: #dbeafe;
  border: 2px dashed #3b82f6;
}

.task-card--drag {
  transform: rotate(2deg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
</style>
```

---

## Step 11: TaskDetailPanel 组件

**文件:** `src/components/module/TaskDetailPanel.vue` (新建)

- [ ] **Step 1: 编写 TaskDetailPanel.vue**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Trash2 } from 'lucide-vue-next'
import type { Task } from '@/types'

interface Props {
  task: Task | null
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  update: [id: string, patch: Partial<Task>]
  delete: [id: string]
}>()

const editTitle = ref('')
const editDescription = ref('')
const editStatus = ref('')
const editPriority = ref('')
const editAssignee = ref('')
const editDueDate = ref('')

watch(
  () => props.task,
  (task) => {
    if (task) {
      editTitle.value = task.title
      editDescription.value = task.description || ''
      editStatus.value = task.status
      editPriority.value = task.priority
      editAssignee.value = task.assignee || ''
      editDueDate.value = task.dueDate || ''
    }
  },
  { immediate: true }
)

const statusOptions = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

function save() {
  if (!props.task) return
  emit('update', props.task.id, {
    title: editTitle.value,
    description: editDescription.value || undefined,
    status: editStatus.value,
    priority: editPriority.value,
    assignee: editAssignee.value || undefined,
    dueDate: editDueDate.value || undefined,
  })
}

function onDelete() {
  if (!props.task) return
  if (confirm('Are you sure you want to delete this task?')) {
    emit('delete', props.task.id)
  }
}

function onClose() {
  save()
  emit('close')
}
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && task" class="task-detail-panel">
      <div class="task-detail-panel__header">
        <h3 class="task-detail-panel__title">Task Details</h3>
        <button class="task-detail-panel__close" @click="onClose">
          <X :size="18" />
        </button>
      </div>

      <div class="task-detail-panel__body">
        <div class="form-field">
          <label class="form-field__label">{{ $t('task.title') }}</label>
          <input
            v-model="editTitle"
            class="form-field__input"
            @blur="save"
          />
        </div>

        <div class="form-field">
          <label class="form-field__label">{{ $t('task.description') }}</label>
          <textarea
            v-model="editDescription"
            class="form-field__textarea"
            rows="4"
            @blur="save"
          />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-field__label">{{ $t('task.status') }}</label>
            <select v-model="editStatus" class="form-field__select" @change="save">
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="form-field">
            <label class="form-field__label">{{ $t('task.priority') }}</label>
            <select v-model="editPriority" class="form-field__select" @change="save">
              <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-field__label">{{ $t('task.assignee') }}</label>
            <input
              v-model="editAssignee"
              class="form-field__input"
              @blur="save"
            />
          </div>

          <div class="form-field">
            <label class="form-field__label">{{ $t('task.dueDate') }}</label>
            <input
              v-model="editDueDate"
              type="date"
              class="form-field__input"
              @blur="save"
            />
          </div>
        </div>
      </div>

      <div class="task-detail-panel__footer">
        <button class="task-detail-panel__delete" @click="onDelete">
          <Trash2 :size="16" />
          {{ $t('task.delete') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.task-detail-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-detail-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.task-detail-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.task-detail-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 6px;
  cursor: pointer;
}

.task-detail-panel__close:hover {
  background: #f3f4f6;
}

.task-detail-panel__body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-field__label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-field__input,
.form-field__select,
.form-field__textarea {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  color: #111827;
  background: white;
  transition: border-color 0.15s;
}

.form-field__input:focus,
.form-field__select:focus,
.form-field__textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-field__textarea {
  resize: vertical;
  min-height: 80px;
}

.task-detail-panel__footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

.task-detail-panel__delete {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #fca5a5;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.task-detail-panel__delete:hover {
  background: #fee2e2;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
```

---

## Step 12: TaskQuickAdd 组件

**文件:** `src/components/module/TaskQuickAdd.vue` (新建)

- [ ] **Step 1: 编写 TaskQuickAdd.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'

const emit = defineEmits<{
  add: [title: string]
}>()

const title = ref('')

function onSubmit() {
  const t = title.value.trim()
  if (!t) return
  emit('add', t)
  title.value = ''
}
</script>

<template>
  <div class="task-quick-add">
    <input
      v-model="title"
      class="task-quick-add__input"
      :placeholder="$t('task.quickAdd')"
      @keydown.enter="onSubmit"
    />
    <button class="task-quick-add__btn" :disabled="!title.trim()" @click="onSubmit">
      <Plus :size="16" />
      {{ $t('task.add') }}
    </button>
  </div>
</template>

<style scoped>
.task-quick-add {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.task-quick-add__input {
  flex: 1;
  padding: 8px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #111827;
  transition: border-color 0.15s;
}

.task-quick-add__input:focus {
  outline: none;
  border-color: #3b82f6;
}

.task-quick-add__input::placeholder {
  color: #9ca3af;
}

.task-quick-add__btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border: none;
  background: #3b82f6;
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.task-quick-add__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.task-quick-add__btn:not(:disabled):hover {
  background: #2563eb;
}
</style>
```

---

## Step 13: TaskBoardView 主视图

**文件:** `src/components/module/TaskBoardView.vue` (新建)

- [ ] **Step 1: 编写 TaskBoardView.vue**

```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus } from 'lucide-vue-next'
import type { Task } from '@/types'
import { useTaskModule } from '@/composables/useTaskModule'
import TaskColumn from './TaskColumn.vue'
import TaskDetailPanel from './TaskDetailPanel.vue'
import TaskQuickAdd from './TaskQuickAdd.vue'

interface Props {
  directory: { id: string }
}

const props = defineProps<Props>()

const {
  tasks,
  loading,
  error,
  loadTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTask,
} = useTaskModule({ ...props.directory, name: '', relativePath: '', sortOrder: 0, projectId: '', createdAt: '', updatedAt: '' } as any)

// 固定 3 列配置
const columns = [
  { key: 'todo', name: 'To Do', color: '#9CA3AF' },
  { key: 'in_progress', name: 'In Progress', color: '#3B82F6' },
  { key: 'done', name: 'Done', color: '#10B981' },
]

// 按状态分组的任务
const tasksByStatus = computed(() => {
  const map: Record<string, Task[]> = {
    todo: [],
    in_progress: [],
    done: [],
  }
  for (const task of tasks.value) {
    if (map[task.status]) {
      map[task.status].push(task)
    }
  }
  return map
})

// 详情面板状态
const selectedTask = ref<Task | null>(null)
const showDetailPanel = computed(() => selectedTask.value !== null)

// 加载任务
onMounted(() => {
  loadTasks()
})

// 快速添加
async function onQuickAdd(title: string) {
  await createTask({ title })
}

// 添加任务（指定状态）
async function onAddTask(statusKey: string) {
  const title = prompt('Task title:')
  if (!title) return
  await createTask({ title, priority: 'medium' })
  // 新建的任务默认在 todo，不需要手动设置 status
}

// 点击任务卡片
function onTaskClick(task: Task) {
  selectedTask.value = task
}

// 关闭详情面板
function onDetailClose() {
  selectedTask.value = null
}

// 更新任务
async function onDetailUpdate(id: string, patch: Partial<Task>) {
  await updateTask(id, patch)
  // 同步 selectedTask
  if (selectedTask.value?.id === id) {
    selectedTask.value = { ...selectedTask.value, ...patch } as Task
  }
}

// 删除任务
async function onDetailDelete(id: string) {
  await deleteTask(id)
  selectedTask.value = null
}

// 拖拽排序变化
async function onTasksChanged(statusKey: string, evt: any) {
  // vuedraggable 会在原地修改 tasks，sortOrder 已在后端通过 column 内排序隐式更新
  // 但我们需要更新被拖动任务的状态
  if (evt.added) {
    const task = evt.added.element as Task
    const newIndex = evt.added.newIndex
    await reorderTask(task.id, statusKey, newIndex)
  } else if (evt.moved) {
    const task = evt.moved.element as Task
    const newIndex = evt.moved.newIndex
    await reorderTask(task.id, statusKey, newIndex)
  }
}
</script>

<template>
  <div class="task-board">
    <!-- 顶部快速添加 -->
    <TaskQuickAdd @add="onQuickAdd" />

    <!-- 加载状态 -->
    <div v-if="loading" class="task-board__loading">
      Loading...
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="task-board__error">
      {{ error }}
    </div>

    <!-- 看板列 -->
    <div v-else class="task-board__columns">
      <TaskColumn
        v-for="col in columns"
        :key="col.key"
        :status-key="col.key"
        :status-name="col.name"
        :status-color="col.color"
        :tasks="tasksByStatus[col.key]"
        @task-click="onTaskClick"
        @add-task="onAddTask"
        @tasks-changed="(e) => onTasksChanged(col.key, e)"
      />
    </div>

    <!-- 详情面板 -->
    <TaskDetailPanel
      :task="selectedTask"
      :visible="showDetailPanel"
      @close="onDetailClose"
      @update="onDetailUpdate"
      @delete="onDetailDelete"
    />
  </div>
</template>

<style scoped>
.task-board {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f3f4f6;
}

.task-board__loading,
.task-board__error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #6b7280;
}

.task-board__columns {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>
```

---

## Step 14: 替换 ModuleContentArea 中的 task 提示

**文件:** `src/components/module/ModuleContentArea.vue`

- [ ] **Step 1: 导入 TaskBoardView**

在 `<script setup>` 中添加导入：
```typescript
import TaskBoardView from './TaskBoardView.vue'
```

- [ ] **Step 2: 替换 task 模板**

将 `template v-else-if="moduleType === 'task'"` 部分替换为：

```vue
<!-- Task Module Content -->
<template v-else-if="moduleType === 'task'">
  <TaskBoardView :directory="props.directory" />
</template>
```

---

## Step 15: 最终验证

- [ ] **Step 1: Rust 编译测试**

Run: `cd src-tauri && cargo build`
Expected: 无编译错误

- [ ] **Step 2: 前端 TypeScript 检查**

Run: `npx vue-tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: 运行开发服务器**

Run: `pnpm dev`
Expected: 开发服务器正常启动，无 console 错误

---

## 自查清单

1. 数据库 tasks 表已添加到 schema.rs
2. Task 类型已在 `types/mod.rs` 和 `types/index.ts` 中定义
3. 5 个 Rust 命令已实现：task_list, task_create, task_update, task_delete, task_reorder
4. taskApi 已添加到 useApi.ts
5. useTaskModule.ts 已改造为调用实际 API
6. 翻译 key 已添加到 en-US.json 和 zh-CN.json
7. 5 个 Vue 组件已创建：TaskCard, TaskColumn, TaskDetailPanel, TaskQuickAdd, TaskBoardView
8. ModuleContentArea 中 task 模块占位符已替换为 TaskBoardView
9. 使用已有的 vuedraggable 实现拖拽
10. 优先级颜色对应正确：urgent=#EF4444, high=#F59E0B, medium=#10B981, low=#9CA3AF
