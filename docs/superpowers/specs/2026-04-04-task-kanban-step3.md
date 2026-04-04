# 任务看板模块 - 第 3 步：列自定义

## 目标

在第 1+2 步基础上，添加状态列的自定义功能：用户可添加、编辑、删除状态列，并控制每列的显示/隐藏。

## 数据库变更

### task_columns 表

```sql
CREATE TABLE task_columns (
  id TEXT PRIMARY KEY,
  directory_id TEXT NOT NULL,
  status_key TEXT NOT NULL,       -- 状态唯一标识（用于 API）
  name TEXT NOT NULL,              -- 显示名称（如 "In Review"）
  color TEXT NOT NULL,             -- 列头颜色
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(directory_id, status_key)
);

CREATE INDEX idx_task_columns_directory_id ON task_columns(directory_id);
```

### 初始数据

每个目录创建后，默认插入 3 列：

| status_key | name | color | sort_order |
|------------|------|-------|------------|
| todo | To Do | #9CA3AF | 0 |
| in_progress | In Progress | #3B82F6 | 1 |
| done | Done | #10B981 | 2 |

## Rust 后端 API

| 命令 | 签名 | 说明 |
|------|------|------|
| `task_column_list` | `(directory_id: String) -> Vec<TaskColumn>` | 获取目录下所有列配置 |
| `task_column_create` | `(directory_id, status_key, name, color) -> TaskColumn` | 创建新列 |
| `task_column_update` | `(id: String, patch) -> TaskColumn` | 更新列（名称/颜色/排序） |
| `task_column_toggle_visibility` | `(id: String) -> TaskColumn` | 切换显示/隐藏 |
| `task_column_delete` | `(id: String) -> ()` | 删除列（同时更新该列任务为 null 或默认列） |

### TaskColumn 类型

```rust
struct TaskColumn {
    id: String,
    directory_id: String,
    status_key: String,
    name: String,
    color: String,
    sort_order: i32,
    is_visible: bool,
    created_at: String,
    updated_at: String,
}
```

### 删除列的业务处理

- 删除列时，该列的任务默认移动到"todo"列（如果"todo"存在）
- 如果"todo"也被删除，则移动到第一列
- 不能删除所有列（至少保留一列）

## 前端变更

### 组件变更

#### TaskBoardView.vue 变更

- 不再硬编码 3 列，改为从 API 加载列配置
- 添加"列设置"按钮（看板右上角 ⚙️）
- 列根据 `is_visible` 过滤显示

#### ColumnSettingsDialog.vue（新建）

弹窗编辑列配置：
- 列表展示所有列
- 每列可编辑名称、颜色（颜色选择器）
- 显示/隐藏开关
- 拖动排序
- 添加新列（输入 status_key + 名称 + 颜色）
- 删除列（确认提示）

```
┌─────────────────────────────────────────┐
│ 列设置                              [×] │
├─────────────────────────────────────────┤
│ ≡ 🔴 To Do          [显示 ▼]  [删除]   │
│ ≡ 🔵 In Progress    [显示 ▼]  [删除]   │
│ ≡ 🟢 Done           [显示 ▼]  [删除]   │
│ ≡ 🟣 In Review      [隐藏 ▼]  [删除]   │
│                                         │
│ [+ 添加新列]                            │
└─────────────────────────────────────────┘
```

#### TaskColumn.vue 变更

- 列头显示自定义颜色和名称
- 列头显示任务数量

### API 变更

#### useTaskModule.ts 变更

```typescript
// 新增
const columns = ref<TaskColumn[]>([])
const loadColumns = async () => { /* invoke('task_column_list') */ }
const createColumn = async (input) => { /* invoke('task_column_create') */ }
const updateColumn = async (id, patch) => { /* invoke('task_column_update') */ }
const toggleColumnVisibility = async (id) => { /* invoke('task_column_toggle_visibility') */ }
const deleteColumn = async (id) => { /* invoke('task_column_delete') */ }
```

#### task_list 变更

返回结果中每条任务携带其列的 `color` 字段，供卡片渲染优先级之外的另一套颜色体系（如果需要）。

## 交付标准

- [ ] `task_columns` 表创建成功
- [ ] 目录初始化时自动创建 3 个默认列
- [ ] 列配置弹窗可正常打开和保存
- [ ] 可添加新列（指定 status_key + 名称 + 颜色）
- [ ] 可编辑列的名称、颜色
- [ ] 可拖动列排序
- [ ] 可隐藏/显示列（隐藏后该列不显示在看板，但任务数据保留）
- [ ] 可删除列（任务自动迁移到默认列）
- [ ] 看板列根据配置动态渲染
