# 任务看板模块 - 第 1 步：基础看板

## 目标

实现固定 3 列看板（To Do / In Progress / Done）加上任务 CRUD、优先级、指派人和快速添加功能。

## 数据库结构

### tasks 表

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  directory_id TEXT NOT NULL,
  parent_id TEXT,                          -- Step 2 启用，Step 1 忽略
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',  -- low | medium | high | urgent
  assignee TEXT,
  due_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,  -- Step 2 启用
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (directory_id) REFERENCES directories(id),
  FOREIGN KEY (parent_id) REFERENCES tasks(id)
);

CREATE INDEX idx_tasks_directory_id ON tasks(directory_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
```

## Rust 后端 API

| 命令 | 签名 | 说明 |
|------|------|------|
| `task_list` | `(directory_id: String) -> Vec<Task>` | 获取目录下所有顶层任务（parent_id IS NULL） |
| `task_create` | `(directory_id, title, description, priority, assignee, due_date) -> Task` | 创建任务，默认 status='todo' |
| `task_update` | `(id: String, patch: serde_json::Value) -> Task` | 更新任务字段（status/priority/assignee/title/description/due_date） |
| `task_delete` | `(id: String) -> ()` | 删除任务 |
| `task_reorder` | `(id: String, new_status: String, new_sort_order: i32) -> Task` | 拖拽后更新状态和排序 |

### Task 类型

```rust
struct Task {
    id: String,
    directory_id: String,
    parent_id: Option<String>,        // Step 1 忽略
    title: String,
    description: Option<String>,
    status: String,                   // todo | in_progress | done
    priority: String,                 // low | medium | high | urgent
    assignee: Option<String>,
    due_date: Option<String>,
    sort_order: i32,
    is_completed: bool,               // Step 1 忽略
    created_at: String,
    updated_at: String,
}
```

## 前端

### 组件结构

```
TaskBoardView.vue           # 看板主视图
├── TaskColumn.vue          # 单列
│   └── TaskCard.vue        # 任务卡片
├── TaskCreateDialog.vue    # 新建任务对话框
├── TaskDetailPanel.vue     # 右侧详情滑出面板
└── TaskQuickAdd.vue        # 顶部快速添加栏
```

### useTaskModule 改造

`useTaskModule.ts` 已存在，需要：
1. 将 mock 数据改为调用实际 API（`invoke('task_list')` 等）
2. 添加 `reorderTask()` 方法

### UI 布局

```
┌─────────────────────────────────────────────────────┐
│ [TaskModuleView]                                    │
│ ┌─ 快速添加: [输入标题...              ] [+ 添加]  ┐ │
│ ├─────────────┬──────────────┬─────────────────────┤ │
│ │  To Do (3) │ In Progress  │ Done (5)            │ │
│ │ ┌─────────┐ │ ┌──────────┐ │ ┌─────────────────┐ │ │
│ │ │ Task 1  │ │ │ Task 4   │ │ │ Task 7          │ │ │
│ │ │ 🔴 High │ │ │ 🟡 Med   │ │ │                 │ │ │
│ │ │ 👤 张三 │ │ └──────────┘ │ └─────────────────┘ │ │
│ │ └─────────┘ │              │ ┌─────────────────┐ │ │
│ │ ┌─────────┐ │              │ │ Task 8          │ │ │
│ │ │ Task 2  │ │              │ └─────────────────┘ │ │
│ │ └─────────┘ │              │                     │ │
│ └─────────────┴──────────────┴─────────────────────┘ │
│                          ▲ 右侧滑出面板（点击卡片时）   │
└─────────────────────────────────────────────────────┘
```

### 任务卡片显示内容

- 拖拽手柄（左侧）
- 标题（单行截断）
- 优先级色点（urgent=🔴 EF4444, high=🟡 F59E0B, medium=🟢 10B981, low=🩶 9CA3AF）
- 指派人名称（如果有）

### 拖拽交互

- 使用 `@vueuse/gesture` 或 `sortablejs` 实现
- 列内拖动：更新 `sort_order`
- 跨列拖动：更新 `status` + `sort_order`
- 拖拽时显示占位符指示线

### 详情面板

右侧滑出（宽度约 400px），包含：
- 标题（input，可编辑）
- 描述（textarea）
- 状态（select: To Do / In Progress / Done）
- 优先级（select: Low / Medium / High / Urgent）
- 指派人（input text）
- 截止日期（date input）
- 删除按钮（底部，红色）

## 交付标准

- [ ] 数据库表 `tasks` 创建成功
- [ ] 5 个 Rust 命令全部可用
- [ ] 3 列固定看板正常显示
- [ ] 卡片可在列内和跨列拖动排序
- [ ] 快速添加能创建任务
- [ ] 点击卡片显示详情面板，可编辑所有字段
- [ ] 删除任务功能正常
