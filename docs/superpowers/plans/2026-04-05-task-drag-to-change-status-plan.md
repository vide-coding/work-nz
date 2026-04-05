# 任务看板跨列拖拽实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持将任务卡片从一列拖拽到另一列，自动更新任务状态并持久化到后端。

**Architecture:** 通过 vuedraggable 的 `@add` 事件（仅跨列时触发）区分跨列移动与同列内排序，跨列时调用现有的 `reorderTask` API（已支持传入 `newStatus`）更新状态。乐观更新 UI，后端失败时重新加载任务列表。

**Tech Stack:** Vue 3 + TypeScript + vuedraggable + Tailwind CSS

---

## 文件概览

| 文件 | 改动 |
|------|------|
| `src/components/module/TaskCard.vue` | 增加 `data-task-id` 属性 |
| `src/components/module/TaskColumn.vue` | 增加 `@add` 事件监听 |
| `src/components/module/TaskBoardView.vue` | 新增跨列移动处理器 |

---

## Task 1: TaskCard.vue 增加 data-task-id 属性

**Files:**
- Modify: `src/components/module/TaskCard.vue`

- [ ] **Step 1: 读取 TaskCard.vue 找到根元素**

读取 `src/components/module/TaskCard.vue`，找到最外层 `div` 标签。

- [ ] **Step 2: 添加 data-task-id 属性**

在根元素上添加 `:data-task-id="task.id"`，确保跨列拖拽时能从 DOM 元素获取任务 ID。

- [ ] **Step 3: 提交**

```bash
git add src/components/module/TaskCard.vue
git commit -m "feat(task): add data-task-id for cross-column drag"
```

---

## Task 2: TaskColumn.vue 增加 @add 事件监听

**Files:**
- Modify: `src/components/module/TaskColumn.vue`

- [ ] **Step 1: 读取 TaskColumn.vue**

- [ ] **Step 2: 声明新事件**

在 `defineEmits` 中添加新事件：

```ts
const emit = defineEmits<{
  'task-click': [task: Task]
  'add-task': [statusKey: string]
  'tasks-changed': [tasks: Task[]]
  'task-cross-column-move': [payload: { taskId: string; newStatus: string; newIndex: number }]
  'toggle-child': [childId: string]
  'delete-child': [childId: string]
  'add-child': [parentId: string, title: string]
}>()
```

- [ ] **Step 3: 添加 onTaskAdded 处理函数**

```ts
function onTaskAdded(evt: { item: HTMLElement; newIndex: number }) {
  const taskId = evt.item.dataset.taskId
  if (taskId) {
    emit('task-cross-column-move', {
      taskId,
      newStatus: props.statusKey,
      newIndex: evt.newIndex,
    })
  }
}
```

- [ ] **Step 4: 在 draggable 上绑定 @add**

```vue
<draggable
  :model-value="tasks"
  @update:model-value="onModelValueUpdate"
  @add="onTaskAdded"
  :group="{ name: 'tasks' }"
  ...
>
```

- [ ] **Step 5: 提交**

```bash
git add src/components/module/TaskColumn.vue
git commit -m "feat(task): add @add handler for cross-column drag detection"
```

---

## Task 3: TaskBoardView.vue 新增跨列移动处理器

**Files:**
- Modify: `src/components/module/TaskBoardView.vue`

- [ ] **Step 1: 读取 TaskBoardView.vue**

重点关注 `onTasksChanged` 函数（行 131-136）和模板中 `@tasks-changed` 绑定（行 223）。

- [ ] **Step 2: 添加 onTaskCrossColumnMove 处理器**

在 `onTasksChanged` 函数后添加：

```ts
// Called when a task is dragged from one column to another (cross-column move)
async function onTaskCrossColumnMove(payload: { taskId: string; newStatus: string; newIndex: number }) {
  await reorderTask(payload.taskId, payload.newStatus, payload.newIndex)
}
```

- [ ] **Step 3: 在 TaskColumn 组件上绑定新事件**

模板中，为 `TaskColumn` 组件添加 `@task-cross-column-move` 绑定：

```vue
<TaskColumn
  v-for="col in boardColumns"
  :key="col.key"
  :status-key="col.key"
  :status-name="col.name"
  :status-color="col.color"
  :tasks="tasksByStatus[col.key] || []"
  :child-tasks-map="childTasksMap"
  :get-child-counts="getChildCounts"
  @task-click="onTaskClick"
  @add-task="(key) => onAddTask(key, col.name)"
  @tasks-changed="(t) => onTasksChanged(col.key, t)"
  @task-cross-column-move="onTaskCrossColumnMove"
  @toggle-child="onCardToggleChild"
  @delete-child="onCardDeleteChild"
  @add-child="onCardAddChild"
/>
```

- [ ] **Step 4: 提交**

```bash
git add src/components/module/TaskBoardView.vue
git commit -m "feat(task): handle cross-column drag to update task status"
```

---

## Task 4: 集成测试验证

**Files:**
- Test: `src/composables/useTaskModule.spec.ts`

- [ ] **Step 1: 读取现有测试文件，确认 reorderTask 测试已覆盖跨列场景**

查看 `describe('reorderTask')` 测试块（行 432-446），确认已测试 `reorderTask('task-1', 'done', 0)` —— 其中 `'done'` 即新状态。

- [ ] **Step 2: 确认 taskApi.reorder mock 已存在**

搜索 `taskApi.reorder.mockResolvedValueOnce`，确认 mock 已就绪。

- [ ] **Step 3: 运行测试验证**

```bash
cd c:/workspace/work-nz && pnpm test:run src/composables/useTaskModule.spec.ts
```

预期：全部通过（特别是 `reorderTask` 测试）。

- [ ] **Step 4: 提交（如有变更）**

```bash
git add src/composables/useTaskModule.spec.ts
git commit -m "test(task): verify reorderTask covers cross-column status update"
```

---

## Task 5: i18n 检查

- [ ] **Step 1: 运行 i18n-checker skill**

```
/i18n-checker
```

- [ ] **Step 2: 如有缺失翻译，补充到 en-US.json 和 zh-CN.json**

- [ ] **Step 3: 提交（如有变更）**

```bash
git add src/locales/
git commit -m "i18n: add missing translation keys for task drag"
```
