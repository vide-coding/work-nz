# 任务看板跨列拖拽设计

## 背景

当前任务看板使用 `vuedraggable` 实现同列内排序，但不支持任务跨列拖拽以修改状态。需要增加跨列拖拽功能。

## 目标

支持将任务卡片从一列拖拽到另一列，自动更新任务状态为新列的 `statusKey`，并持久化到后端。

## 设计方案

### 核心策略

- **乐观更新**：拖拽释放时立即更新前端状态和后端 API，失败时回滚
- **事件区分**：通过 vuedraggable 的 `@add`（跨列）和 `@update:model-value`（同列）区分操作类型
- **最小改动**：仅修改 `TaskColumn.vue` 和 `TaskBoardView.vue`，不改动 composable 逻辑

### 实现细节

#### 1. TaskColumn.vue

```vue
<draggable
  :model-value="tasks"
  @update:model-value="onModelValueUpdate"
  @add="onTaskAdded"
  :group="{ name: 'tasks' }"
  ...
>
```

- `@update:model-value`：同列内排序 → emit `tasks-changed`（现有逻辑）
- `@add`：跨列移入 → emit `task-cross-column-move` 新事件，传递 `{ task, newStatus, newIndex }`

```ts
function onTaskAdded(evt: any) {
  // evt.item = 被拖拽的 DOM 元素（可通过其 data-id 或重新查找 task）
  // evt.to = 目标容器
  // evt.from = 来源容器
  const taskId = evt.item.dataset.taskId
  const newIndex = evt.newIndex
  emit('task-cross-column-move', {
    taskId,
    newStatus: props.statusKey,
    newIndex,
  })
}
```

> 注意：`vuedraggable` 的 `@add` 事件 `evt` 包含完整拖拽信息，其中 `evt.item` 是原生 DOM 元素，需要从 `data-task-id` 属性获取任务 ID。因此 `TaskCard.vue` 渲染时需设置 `:data-task-id="task.id"`。

#### 2. TaskBoardView.vue

新增 `onTaskCrossColumnMove` 处理器：

```ts
async function onTaskCrossColumnMove(payload: { taskId: string; newStatus: string; newIndex: number }) {
  // 1. 乐观更新本地 tasks（任务已通过 vuedraggable 移入新列，tasksByStatus 自动反映）
  // 2. 调用后端 API
  await reorderTask(payload.taskId, payload.newStatus, payload.newIndex)
  // 3. 若失败，后端返回新状态，前端已通过 vuedraggable 乐观更新，无需额外回滚
  //    （若 API 报错，可考虑重新加载 tasks）
}
```

> `reorderTask` 已支持传入 `newStatus`，后端 `task_reorder` 命令同时更新状态和排序。

#### 3. TaskCard.vue

为支持 `onTaskAdded` 获取任务 ID，添加 `data-task-id` 属性：

```vue
<div :data-task-id="task.id">
  <!-- 卡片内容 -->
</div>
```

### 数据流

```
用户拖拽任务到新列
  → vuedraggable 触发 @add
    → TaskColumn.onTaskAdded
      → emit('task-cross-column-move')
        → TaskBoardView.onTaskCrossColumnMove
          → useTaskModule.reorderTask()
            → taskApi.reorder(id, newStatus, newSortOrder)
              → Rust backend task_reorder
```

### 错误处理

- **乐观更新**：任务已在 UI 中移动，若 API 失败，提示用户（可 toast 通知）
- **重复操作防护**：拖拽操作结束后才触发 API，不会因拖拽过程中的多次移动而产生中间状态更新

### 测试要点

1. 同列内排序不受影响
2. 跨列拖拽后状态正确更新
3. 跨列拖拽后任务出现在目标列正确位置
4. API 失败时 UI 保持一致

## 涉及文件

- `src/components/module/TaskColumn.vue`：增加 `@add` 监听和 `data-task-id` 支持
- `src/components/module/TaskCard.vue`：增加 `data-task-id` 属性
- `src/components/module/TaskBoardView.vue`：新增 `onTaskCrossColumnMove` 和事件绑定
- `src/composables/useTaskModule.spec.ts`：补充跨列拖拽场景测试（如已有 `reorderTask` 测试可覆盖）
