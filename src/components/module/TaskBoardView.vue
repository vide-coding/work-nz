<script setup lang="ts">
import { ref, shallowRef, triggerRef, computed, watch, onMounted, onBeforeUnmount } from 'vue'
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
  reorderTask,
  statusValues,
  priorityValues,
  childTasksMap,
  loadChildTasks,
  createChildTask,
  toggleChildComplete,
  deleteChildTask,
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

// Build columns from visible columns (sorted, only visible)
const boardColumns = computed(() =>
  columns.value
    .filter((c) => c.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({
      key: c.statusKey,
      name: c.name,
      color: c.color,
    }))
)

// columnDisplayOrder: 前端显示顺序，shallowRef 保持稳定引用
// 拖拽时直接更新这个 map，不触发 tasksByStatus 的 filter+sort
const columnDisplayOrder = shallowRef<Record<string, Task[]>>({})

// 当 allTasks 加载或变化时，从 allTasks 同步到 columnDisplayOrder
// 初始化或重置时按 sortOrder 排序
function syncColumnDisplayOrder() {
  const map: Record<string, Task[]> = {}
  for (const col of columns.value) {
    map[col.statusKey] = []
  }
  for (const task of allTasks.value) {
    if (map[task.status]) {
      map[task.status].push(task)
    }
  }
  // 初始同步按 sortOrder 排，后续拖拽由 columnDisplayOrder 自己维护
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }
  columnDisplayOrder.value = map
  triggerRef(columnDisplayOrder)
}

// 任务状态变更时，同步 columnDisplayOrder（不触发完整重建）
function syncStatusChange(taskId: string, newStatus: string) {
  const task = allTasks.value.find((t) => t.id === taskId)
  if (!task) return
  const oldStatus = task.status
  if (oldStatus === newStatus) return
  const map = { ...columnDisplayOrder.value }
  const fromList = [...(map[oldStatus] || [])]
  const idx = fromList.findIndex((t) => t.id === taskId)
  if (idx !== -1) {
    fromList.splice(idx, 1)
    map[oldStatus] = fromList
    const toList = [...(map[newStatus] || [])]
    toList.push(task)
    map[newStatus] = toList
    columnDisplayOrder.value = map
    triggerRef(columnDisplayOrder)
  }
}

// 任务删除时，从 columnDisplayOrder 移除
function syncTaskDelete(taskId: string) {
  const task = allTasks.value.find((t) => t.id === taskId)
  if (!task) return
  const map = { ...columnDisplayOrder.value }
  const list = [...(map[task.status] || [])]
  const idx = list.findIndex((t) => t.id === taskId)
  if (idx !== -1) {
    list.splice(idx, 1)
    map[task.status] = list
    columnDisplayOrder.value = map
    triggerRef(columnDisplayOrder)
  }
}

watch([allTasks, columns], syncColumnDisplayOrder, { immediate: true })

// tasksByStatus 直接返回稳定的 columnDisplayOrder 引用
const tasksByStatus = computed(() => columnDisplayOrder.value)

// Selected task for detail panel
const selectedTask = ref<Task | null>(null)
const showDetailPanel = computed(() => selectedTask.value !== null)
const showColumnSettings = ref(false)
const showAddTaskDialog = ref(false)
const addTaskStatusKey = ref('')
const addTaskStatusName = ref('')

// Watch selected task to load child tasks
const stopSelectedTaskWatch = watch(selectedTask, async (task) => {
  if (task) {
    await loadChildTasks(task.id)
  }
})

onMounted(() => {
  loadTasks()
  loadColumns()
})

onBeforeUnmount(() => {
  stopSelectedTaskWatch()
})

async function onQuickAdd(title: string) {
  await createTask({ title })
}

async function onAddTask(statusKey: string, statusName: string) {
  addTaskStatusKey.value = statusKey
  addTaskStatusName.value = statusName
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
  const oldTask = allTasks.value.find((t) => t.id === id)
  await updateTask(id, patch)
  if (patch.status && oldTask && oldTask.status !== patch.status) {
    syncStatusChange(id, patch.status)
  }
  if (selectedTask.value?.id === id) {
    selectedTask.value = { ...selectedTask.value, ...patch } as Task
  }
}

async function onDetailDelete(id: string) {
  await deleteTask(id)
  syncTaskDelete(id)
  selectedTask.value = null
}

// Called when a task is reordered (in-column) or moved to another column (cross-column)
// 关键：只更新 columnDisplayOrder（stable 引用），不修改 allTasks 的 sortOrder
// 这样 tasksByStatus computed 不会触发重新排序，vuedraggable DOM 顺序得以保留
async function onTasksReordered(payload: { taskId: string; newStatus: string; newIndex: number }) {
  const map = { ...columnDisplayOrder.value }
  const task = allTasks.value.find((t) => t.id === payload.taskId)
  if (!task) return

  // 从原列中移除
  const fromStatus = task.status
  const fromList = [...(map[fromStatus] || [])]
  const fromIdx = fromList.findIndex((t) => t.id === payload.taskId)
  if (fromIdx !== -1) {
    fromList.splice(fromIdx, 1)
  }

  // 插入到新列
  const toList = fromStatus === payload.newStatus ? fromList : [...(map[payload.newStatus] || [])]
  toList.splice(payload.newIndex, 0, task)
  map[fromStatus] = fromList
  if (fromStatus !== payload.newStatus) {
    map[payload.newStatus] = toList
  }

  // 立即更新 columnDisplayOrder，stable 引用，vuedraggable DOM 同步
  columnDisplayOrder.value = map
  triggerRef(columnDisplayOrder)

  // 后台调用 API 持久化 sortOrder
  await reorderTask(payload.taskId, payload.newStatus, payload.newIndex)
}

// Child task handlers
async function onToggleChild(childId: string) {
  await toggleChildComplete(childId)
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

async function onCardToggleChild(childId: string) {
  await toggleChildComplete(childId)
}

async function onCardDeleteChild(childId: string) {
  await deleteChildTask(childId)
}

async function onCardAddChild(parentId: string, title: string) {
  await createChildTask(parentId, title)
}

const statusOptions = computed(() =>
  statusValues.value.map((sv) => ({ value: sv.id, label: sv.name }))
)

const priorityOptions = computed(() =>
  priorityValues.value.map((pv) => ({ value: pv.id, label: pv.name }))
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
        {{ boardColumns.length }} {{ $t('workspace.columns') || 'columns' }}
      </span>
      <button class="flex items-center justify-center w-7 h-7 bg-transparent text-gray-400 border-none rounded-md cursor-pointer transition-colors hover:bg-gray-200 hover:text-gray-600" @click="showColumnSettings = true" :title="$t('settings.title')">
        <Settings :size="16" />
      </button>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center text-sm text-gray-500">
      Loading...
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
          :status-name="col.name"
          :status-color="col.color"
          :tasks="tasksByStatus[col.key] || []"
          :child-tasks-map="childTasksMap"
          :get-child-counts="getChildCounts"
          @task-click="onTaskClick"
          @add-task="(key) => onAddTask(key, col.name)"
          @tasks-reordered="onTasksReordered"
          @toggle-child="onCardToggleChild"
          @delete-child="onCardDeleteChild"
          @add-child="onCardAddChild"
          @task-cross-column-move="onTasksReordered"
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
      :status-name="addTaskStatusName"
      @update:visible="showAddTaskDialog = $event"
      @confirm="onAddTaskConfirm"
    />
  </div>
</template>
