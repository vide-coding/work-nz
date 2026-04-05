<script setup lang="ts">
import { ref, shallowRef, triggerRef, nextTick, computed, watch, onMounted, onBeforeUnmount } from 'vue'
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

// columnTasks: shallowRef，vuedraggable 可以直接修改数组引用（不用经过 readonly proxy）
// 初始化时从 allTasks 同步，注意：不替换已有数组引用，避免打断 vuedraggable
const columnTasks = shallowRef<Record<string, Task[]>>({})

function syncColumnTasks() {
  const map = columnTasks.value
  // 初始化：为每个列创建数组
  if (Object.keys(map).length === 0) {
    for (const col of columns.value) {
      map[col.statusKey] = []
    }
  }
  // 重新填充任务
  for (const col of columns.value) {
    map[col.statusKey] = []
  }
  for (const task of allTasks.value) {
    if (map[task.status]) {
      map[task.status].push(task)
    }
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }
  triggerRef(columnTasks)
}

watch([allTasks, columns], syncColumnTasks, { immediate: true })

// vuedraggable 内部修改数组后，Vue 不会自动感知（shallowRef 不跟踪深层）
// 需要手动调用 setColumnTasks 来：1）更新 columnTasks 引用，2）同步 allTasks 状态
function setColumnTasks(statusKey: string, newList: Task[]) {
  // 更新 columnTasks 的该列引用（vuedraggable 已修改数组，直接引用）
  columnTasks.value[statusKey] = newList
  // 检测跨列移动：对比任务当前 status，任务是否移入本列
  if (newList.some((t) => t.status !== statusKey)) {
    // 用 nextTick 等 vuedraggable DOM 操作完成后再更新 allTasks
    // 这样 syncColumnTasks 看到的是已更新的 allTasks
    nextTick(() => {
      for (const task of newList) {
        if (task.status !== statusKey) {
          const idx = allTasks.value.findIndex((t) => t.id === task.id)
          if (idx !== -1) {
            allTasks.value[idx] = { ...allTasks.value[idx], status: statusKey }
          }
        }
      }
      triggerRef(columnTasks)
    })
  }
}

// 拖拽操作：vuedraggable v-model 直接管理内部列表，
// 父组件通过 task-moved 事件同步 allTasks（后台 API 调用，不影响显示）
async function onTaskMoved(payload: { task: Task; from: string; to: string; newIndex: number }) {
  const { task, from, to, newIndex } = payload
  // 状态变更通过 setColumnTasks 已同步到 allTasks，这里只做 API 持久化
  await reorderTask(task.id, to, newIndex)
}

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
  await updateTask(id, patch)
  if (selectedTask.value?.id === id) {
    selectedTask.value = { ...selectedTask.value, ...patch } as Task
  }
}

async function onDetailDelete(id: string) {
  await deleteTask(id)
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
          :model-value="columnTasks[col.key] || []"
          :child-tasks-map="childTasksMap"
          :get-child-counts="getChildCounts"
          @update:model-value="(list) => setColumnTasks(col.key, list)"
          @task-click="onTaskClick"
          @add-task="(key) => onAddTask(key, col.name)"
          @task-moved="onTaskMoved"
          @toggle-child="onCardToggleChild"
          @delete-child="onCardDeleteChild"
          @add-child="onCardAddChild"
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
