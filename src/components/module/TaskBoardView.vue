<script setup lang="ts">
import { ref, shallowRef, triggerRef, computed, watch, onMounted, onBeforeUnmount, provide } from 'vue'
import { Settings } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import type { Directory, Task } from '@/types'
import { useTaskModule } from '@/composables/useTaskModule'
import TaskColumn from './TaskColumn.vue'
import TaskDetailPanel from './TaskDetailPanel.vue'
import TaskQuickAdd from './TaskQuickAdd.vue'
import ColumnSettingsDialog from './ColumnSettingsDialog.vue'
import TaskAddDialog from './TaskAddDialog.vue'

interface Props {
  directory: Directory
}

const props = defineProps<Props>()

const {
  allTasks,
  loading,
  error,
  loadTasks,
  createTask,
  updateTask,
  deleteTask,
  statusValues,
  priorityValues,
  childTasksMap,
  loadChildTasks,
  loadChildTasksForTasks,
  createChildTask,
  toggleChildComplete,
  deleteChildTask,
  reorderChildren,
  getChildTasks,
  getChildCounts,
  columns,
  columnsLoading,
  loadColumns,
  createColumn,
  updateColumn,
  toggleColumnVisibility,
  deleteColumn,
} = useTaskModule(props.directory)

// Provide priority color map to child components (TaskCard, etc.)
const priorityColorMap = computed(() => {
  const map: Record<string, string> = {}
  for (const pv of priorityValues.value) {
    map[pv.id] = pv.color
  }
  return map
})
provide('priorityColorMap', priorityColorMap.value)

// Build columns from visible columns (sorted, only visible)
const boardColumns = computed(() =>
  columns.value
    .filter((c) => c.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      key: c.statusKey,
      color: c.color,
    }))
)

// columnTasks: shallowRef，TaskColumn 的本地副本变化后 emit 过来
const columnTasks = shallowRef<Record<string, Task[]>>({})

// 拖拽期间的视觉顺序：覆盖 syncColumnTasks 中的 sortOrder 排序
// 解决 watcher 在 sortOrder 更新到 API 之前触发的竞态问题
const pendingColumnOrders = shallowRef<Record<string, string[]>>({})

function syncColumnTasks() {
  const map: Record<string, Task[]> = {}
  for (const col of columns.value) {
    const colTasks = allTasks.value.filter((t) => t.status === col.statusKey)
    const pending = pendingColumnOrders.value[col.statusKey]
    if (pending) {
      // 拖拽期间使用 vuedraggable 提供的视觉顺序
      map[col.statusKey] = pending
        .map((id) => colTasks.find((t) => t.id === id))
        .filter((t): t is Task => t !== undefined)
    } else {
      map[col.statusKey] = colTasks.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    }
  }
  columnTasks.value = map
}

watch([allTasks, columns], syncColumnTasks, { immediate: true })

// TaskColumn 本地副本变化后，通知 Vue 更新 shallowRef
function onColumnUpdate(statusKey: string, newList: Task[]) {
  columnTasks.value[statusKey] = newList
  // 同步视觉顺序到 pending，避免 watcher 触发时 sortOrder 尚未更新
  pendingColumnOrders.value[statusKey] = newList.map((t) => t.id)
  triggerRef(columnTasks)
}

// 拖拽完成：跨列移动时，调用 reorderTask 持久化到 API。
// 关键：必须同时更新 allTasks 中目标列所有任务的 sortOrder 到视觉顺序，
// 否则 filteredTasks 重新计算时会把其他任务的旧 sortOrder 当作正确顺序，
// 导致拖拽后的位置被覆盖。
async function onTaskMoved(payload: { task: Task; from: string; to: string; newIndex: number }) {
  const { task, to, newIndex } = payload
  const destColumn = to !== '__removed__' ? to : task.status

  // 使用 pendingColumnOrders（视觉顺序）而非 sortOrder，
  // 解决 watcher 在 sortOrder 更新到 API 之前触发的竞态问题
  const colTasks =
    pendingColumnOrders.value[destColumn]
      ?.map((id) => allTasks.value.find((t) => t.id === id))
      .filter((t): t is Task => t !== undefined) ||
    columnTasks.value[destColumn] ||
    []

  // 跨列移动时，持久化状态变更
  if (task.status !== destColumn) {
    await updateTask(task.id, { status: destColumn })
  }

  // 更新 allTasks 中目标列所有任务的 sortOrder（匹配 columnTasks 视觉顺序）
  await Promise.all(
    colTasks.map((t, i) => updateTask(t.id, { sortOrder: i }))
  )

  // API 调用完成后清除 pending，恢复 sortOrder 排序
  pendingColumnOrders.value = { ...pendingColumnOrders.value, [destColumn]: undefined as unknown as string[] }
}

// Selected task for detail panel
const selectedTask = ref<Task | null>(null)
const showDetailPanel = computed(() => selectedTask.value !== null)
const showColumnSettings = ref(false)
const showAddTaskDialog = ref(false)
const addTaskStatusKey = ref('')

// Watch selected task to load child tasks
const stopSelectedTaskWatch = watch(selectedTask, async (task) => {
  if (task) {
    await loadChildTasks(task.id)
  }
})

// Track whether child tasks have been batch-loaded to avoid re-running
let childTasksBatchLoaded = false

onMounted(async () => {
  await loadTasks()
  await loadColumns()
  // Batch load child tasks for all tasks on initial load
  if (!childTasksBatchLoaded && allTasks.value.length > 0) {
    childTasksBatchLoaded = true
    loadChildTasksForTasks(allTasks.value.map((t) => t.id))
  }
})

onBeforeUnmount(() => {
  stopSelectedTaskWatch()
})

async function onQuickAdd(title: string, onDone: () => void) {
  try {
    await createTask({ title })
  } finally {
    onDone()
  }
}

async function onAddTask(statusKey: string) {
  addTaskStatusKey.value = statusKey
  showAddTaskDialog.value = true
}

async function onAddTaskConfirm(title: string) {
  await createTask({ title, status: addTaskStatusKey.value })
}

function onTaskClick(task: Task) {
  selectedTask.value = task
}

function onDetailClose() {
  selectedTask.value = null
}

async function onDetailUpdate(id: string, patch: Partial<Task>) {
  await updateTask(id, patch)
  if (selectedTask.value?.id === id) {
    selectedTask.value = { ...selectedTask.value, ...patch } as Task
  }
}

async function onDetailDelete(id: string) {
  await deleteTask(id)
  selectedTask.value = null
}

async function onToggleChild(payload: string | { childId: string; parentId: string }) {
  const childId = typeof payload === 'string' ? payload : payload.childId
  const parentId = typeof payload === 'string' ? undefined : payload.parentId
  await toggleChildComplete(childId)
  if (parentId) {
    await loadChildTasks(parentId)
  }
  if (selectedTask.value) {
    await loadChildTasks(selectedTask.value.id)
  }
}

async function onDeleteChild(childId: string) {
  await deleteChildTask(childId)
  if (selectedTask.value) {
    await loadChildTasks(selectedTask.value.id)
  }
}

async function onAddChild(parentId: string, title: string) {
  await createChildTask(parentId, title)
}

async function onUpdateChild(childId: string, title: string) {
  const child = childTasksMap.value[selectedTask.value?.id || '']?.find(c => c.id === childId)
  if (child) {
    await updateTask(childId, { title })
    if (selectedTask.value) {
      await loadChildTasks(selectedTask.value.id)
    }
  }
}

async function onReorderChildren(childIds: string[]) {
  if (!selectedTask.value) return
  await reorderChildren(selectedTask.value.id, childIds)
}

const statusOptions = computed(() =>
  statusValues.value.map((sv) => ({
    value: sv.id,
    label: sv.name || sv.id,
    color: sv.color,
  }))
)

const priorityOptions = computed(() =>
  priorityValues.value.map((pv) => ({ value: pv.id, label: pv.name, color: pv.color }))
)

function getSelectedChildTasks(): Task[] {
  if (!selectedTask.value) return []
  return childTasksMap.value[selectedTask.value.id] || []
}
</script>

<template>
  <div class="flex flex-col h-full bg-gray-100">
    <TaskQuickAdd @add="onQuickAdd" />

    <div class="flex items-center justify-end gap-2 px-4 pb-2">
      <span class="text-xs text-gray-400">
        {{ boardColumns.length }} {{ $t('workspace.columns') }}
      </span>
      <button class="flex items-center justify-center w-7 h-7 bg-transparent text-gray-400 border-none rounded-md cursor-pointer transition-colors hover:bg-gray-200 hover:text-gray-600" @click="showColumnSettings = true" :title="$t('settings.title')" :aria-label="$t('settings.title')">
        <Settings :size="16" />
      </button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-sm text-gray-500">
      {{ $t('common.loading') }}
    </div>

    <div v-else-if="error" class="flex-1 flex items-center justify-center text-sm text-red-500">
      {{ error }}
    </div>

    <div v-else-if="boardColumns.length === 0" class="flex-1 flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
      <p>{{ $t('task.noVisibleColumns') }}</p>
      <button class="px-4 py-2 text-[13px] font-medium text-white bg-blue-500 border-none rounded-lg cursor-pointer transition-colors hover:bg-blue-600" @click="showColumnSettings = true">
        {{ $t('task.configureColumns') }}
      </button>
    </div>

    <div v-else class="flex-1 flex overflow-hidden">
      <div class="flex-1 flex gap-4 p-4 overflow-x-auto overflow-y-hidden">
        <TaskColumn
          v-for="col in boardColumns"
          :key="col.key"
          :status-key="col.key"
          :status-color="col.color"
          :model-value="columnTasks[col.key] || []"
          :get-child-counts="getChildCounts"
          :child-tasks-map="childTasksMap"
          @update:model-value="(list) => onColumnUpdate(col.key, list)"
          @task-click="onTaskClick"
          @add-task="(key) => onAddTask(key)"
          @task-moved="onTaskMoved"
          @toggle-child="onToggleChild"
        />
      </div>

      <TaskDetailPanel
        :task="selectedTask"
        :visible="showDetailPanel"
        :status-options="statusOptions"
        :priority-options="priorityOptions"
        :child-tasks="getSelectedChildTasks()"
        :child-count="selectedTask ? getChildCounts(selectedTask.id) : { total: 0, completed: 0 }"
        @close="onDetailClose"
        @update="onDetailUpdate"
        @delete="onDetailDelete"
        @toggle-child="onToggleChild"
        @delete-child="onDeleteChild"
        @add-child="onAddChild"
        @update-child="onUpdateChild"
        @reorder-children="onReorderChildren"
      />
    </div>

    <ColumnSettingsDialog
      :visible="showColumnSettings"
      :columns="columns"
      :loading="columnsLoading"
      @close="showColumnSettings = false"
      @create="createColumn"
      @update="updateColumn"
      @toggle-visibility="toggleColumnVisibility"
      @delete="deleteColumn"
    />

    <TaskAddDialog
      :visible="showAddTaskDialog"
      :status-key="addTaskStatusKey"
      @update:visible="showAddTaskDialog = $event"
      @confirm="onAddTaskConfirm"
    />
  </div>
</template>
