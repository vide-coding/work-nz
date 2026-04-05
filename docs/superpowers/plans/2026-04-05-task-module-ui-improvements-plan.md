# 任务模块 UI 改进计划

## 概述

对任务看板模块进行 UI 改进和 Bug 修复，包括响应式 bug 修复和用户体验提升。

## 问题分析

### 根因分析

1. **任务修改后没有实时变化** - 根因：`TaskBoardView.vue` 的 `syncColumnTasks` 函数原地修改数组（`map[col.statusKey].length = 0` + `push`），Vue 响应式系统无法检测数组内部变化
2. **快速添加任务loading闪烁** - `createTask` 时 `loading.value = true`，异步完成后 `loading.value = false`，导致整个看板 loading 状态闪烁
3. **新任务排在第一位** - 创建任务时没有设置 `sortOrder`，默认排在末尾
4. **子任务显示** - 需要在卡片中展示进度和子任务列表
5. **TaskCard显示两行描述** - 当前无描述展示
6. **移除拖拽图标** - 当前有 GripVertical 图标
7. **列设置交互** - 当前双击文字编辑，改为图标按钮

---

## 任务清单

### Task 1: 修复任务修改后没有实时变化的 Bug

**文件:** `src/components/module/TaskBoardView.vue`

**问题:** `syncColumnTasks` 函数原地修改数组，Vue 响应式无法追踪

**当前代码:**
```javascript
function syncColumnTasks() {
  const map = columnTasks.value
  for (const col of columns.value) {
    map[col.statusKey].length = 0  // 原地清空
    for (const task of allTasks.value) {
      if (task.status === col.statusKey) {
        map[col.statusKey].push(task)  // 原地 push
      }
    }
  }
  triggerRef(columnTasks)
}
```

**修复方案:**
```javascript
function syncColumnTasks() {
  const map: Record<string, Task[]> = {}
  for (const col of columns.value) {
    map[col.statusKey] = allTasks.value
      .filter((t) => t.status === col.statusKey)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }
  columnTasks.value = map
}
```

**验证:** 修改任务标题后，卡片应立即更新，无需刷新

---

### Task 2: 修复快速添加任务 loading 闪烁问题

**文件:** `src/components/module/TaskBoardView.vue`

**问题:** `loading.value = true` 导致整个看板显示 loading 状态

**当前代码:**
```javascript
async function createTask(input) {
  loading.value = true  // ← 导致整个看板 loading
  const newTask = await taskApi.create(...)
  tasks.value = [...tasks.value, newTask]
  loading.value = false
}
```

**修复方案:**
1. 在 `useTaskModule.ts` 添加 `saving` 状态（已有）
2. 移除 `createTask` 中的 `loading.value = true`
3. 在 `TaskQuickAdd.vue` 中添加本地 loading 状态
4. 只有快速添加框显示 loading，不影响整个看板

**TaskQuickAdd.vue 修改:**
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Loader2 } from 'lucide-vue-next'

const emit = defineEmits<{
  add: [title: string]
}>()

const title = ref('')
const isSubmitting = ref(false)

async function onSubmit() {
  const t = title.value.trim()
  if (!t || isSubmitting.value) return
  isSubmitting.value = true
  emit('add', t)
  // 父组件处理完成后重置
}
</script>

<template>
  <!-- 添加 :disabled="isSubmitting" -->
  <!-- 添加 Loading 图标 -->
</template>
```

---

### Task 3: 新任务默认排在第一位

**文件:** `src/composables/useTaskModule.ts`

**问题:** 创建任务时没有设置 sortOrder

**修复方案:**
在 `createTask` 中，获取当前列最大 sortOrder，然后设置为 `maxSortOrder + 1`

```javascript
async function createTask(input: {...}): Promise<Task | null> {
  // ...
  // 计算新任务的 sortOrder（排在最后）
  const colTasks = tasks.value.filter(t => t.status === (input.status || defaultStatus))
  const maxSortOrder = colTasks.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), -1)
  
  const newTask = await taskApi.create(
    directory.id,
    input.title,
    input.description,
    input.priority,
    input.assignee,
    input.dueDate,
    input.status,
    maxSortOrder + 1  // 需要检查 API 是否支持
  )
  // ...
}
```

**注意:** 需要检查 `taskApi.create` 是否支持 sortOrder 参数，如果不支持，需要添加新的 API

---

### Task 4: TaskCard 移除拖拽图标，显示两行描述

**文件:** `src/components/module/TaskCard.vue`

**改动:**
1. 移除 `<GripVertical>` 图标
2. 添加描述显示（最多2行）
3. 调整优先级和 assignee 布局
4. vuedraggable 的 handle 改为整个卡片

**目标布局:**
```
┌─────────────────────────────────────┐
│ ● 任务标题                      [2/5]▶│
│ 描述文字最多显示两行...              │
│ @zhangsan                          │
└─────────────────────────────────────┘
```

**TaskColumn.vue 改动:**
```vue
<draggable
  v-model="localTasks"
  class="flex flex-col gap-2 min-h-10"
  item-key="id"
  handle=".task-card-drag-handle"  <!-- 改为整个卡片 -->
>
```

---

### Task 5: 子任务在卡片中显示进度和列表

**文件:** `src/components/module/TaskCard.vue`

**改动:**
1. 保留现有的子任务计数 badge（已有）
2. 当展开时，在卡片底部显示子任务列表
3. 只显示最多3条未完成的子任务
4. 子任务可点击切换完成状态

**子任务显示逻辑:**
```vue
<div v-if="isExpanded && childTasks.length > 0" class="...">
  <!-- 只显示未完成的，最多3条 -->
  <div
    v-for="child in unfinishedChildTasks.slice(0, 3)"
    :key="child.id"
    class="flex items-center gap-2"
  >
    <input type="checkbox" @change="emit('toggle-child', child.id)" />
    <span>{{ child.title }}</span>
  </div>
  <span v-if="unfinishedChildTasks.length > 3">
    +{{ unfinishedChildTasks.length - 3 }} more
  </span>
</div>
```

---

### Task 6: 列设置改为图标按钮交互

**文件:** `src/components/module/ColumnSettingsDialog.vue`

**改动:**
1. 将 `@dblclick="startEdit(col)"` 替换为铅笔图标按钮
2. 移除 `@dblclick` 事件
3. 添加 `Pencil` 图标到 lucide-vue-next 导入

**目标布局:**
```
┌──────────────────────────────────────────┐
│ ⦿ In Progress  in_progress  [✏️]  [显示] [🗑] │
└──────────────────────────────────────────┘
```

**代码改动:**
```vue
<!-- 替换 -->
<span class="cursor-text" @dblclick="startEdit(col)">{{ col.name }}</span>

<!-- 改为 -->
<div class="flex items-center gap-2">
  <span>{{ col.name }}</span>
  <button
    class="opacity-0 group-hover:opacity-100 ..."
    @click="startEdit(col)"
  >
    <Pencil :size="13" />
  </button>
</div>
```

---

## 文件清单

| 文件 | 改动类型 |
|------|----------|
| `src/components/module/TaskBoardView.vue` | Bug 修复 |
| `src/components/module/TaskCard.vue` | UI 改进 |
| `src/components/module/TaskColumn.vue` | UI 改进 |
| `src/components/module/TaskQuickAdd.vue` | Bug 修复 |
| `src/composables/useTaskModule.ts` | 功能增强 |
| `src/components/module/ColumnSettingsDialog.vue` | UI 改进 |

---

## 测试验证

1. **任务修改实时更新** - 修改标题/描述，卡片立即响应
2. **快速添加无闪烁** - 添加任务时只有输入框显示 loading
3. **新任务排第一** - 添加新任务出现在列首
4. **子任务显示** - 展开卡片可见子任务列表
5. **描述显示** - 有描述的任务卡显示2行描述
6. **列设置编辑** - 点击铅笔图标进入编辑模式

---

## 依赖关系

- Task 1 和 Task 2 可并行
- Task 4 依赖 Task 5 的子任务逻辑
- Task 6 独立
