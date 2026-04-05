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

// columnTasks: shallowRef，TaskColumn 的本地副本变化后 emit 过来
const columnTasks = shallowRef<Record<string, Task[]>>({})

function syncColumnTasks() {
  // 原地修改数组，保持 columnTasks[destColumn] === TaskColumn.localTasks 引用
  // 这样 onTaskMoved 中的 colTasks 和 columnTasks.value[destColumn] 始终是同一数组
  const map = columnTasks.value
  const existingKeys = Object.keys(map)
  const newKeys = columns.value.map((c) => c.statusKey)

  // 新增列：创建空数组
  for (const key of newKeys) {
    if (!map[key]) {
      map[key] = []
    }
  }
  // 删除列：从 map 中移除
  for (const key of existingKeys) {
    if (!newKeys.includes(key)) {
      delete map[key]
    }
  }
  // 重建所有列的任务（原地清空+填充，不替换数组引用）
  for (const col of columns.value) {
    map[col.statusKey].length = 0
    for (const task of allTasks.value) {
      if (task.status === col.statusKey) {
        map[col.statusKey].push(task)
      }
    }
    map[col.statusKey].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }
  triggerRef(columnTasks)
}

watch([allTasks, columns], syncColumnTasks, { immediate: true })

// TaskColumn 本地副本变化后，通知 Vue 更新 shallowRef
function onColumnUpdate(statusKey: string, newList: Task[]) {
  columnTasks.value[statusKey] = newList
  triggerRef(columnTasks)
}

// 拖拽完成：跨列移动时，调用 reorderTask 持久化到 API。
// 关键：必须同时更新 allTasks 中目标列所有任务的 sortOrder 到视觉顺序，
// 否则 filteredTasks 重新计算时会把其他任务的旧 sortOrder 当作正确顺序，
// 导致拖拽后的位置被覆盖。
async function onTaskMoved(payload: { task: Task; from: string; to: string; newIndex: number }) {
  const { task, to, newIndex } = payload
  const destColumn = to !== '__removed__' ? to : task.status

  // 更新 allTasks 中目标列所有任务的 sortOrder（匹配 columnTasks 视觉顺序）
  const colTasks = columnTasks.value[destColumn] || []
  await Promise.all(
    colTasks.map((t, i) => updateTask(t.id, { sortOrder: i }))
  )

  // 跨列移动时，持久化状态变更
  if (task.status !== destColumn) {
    await updateTask(task.id, { status: destColumn })
  }
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
          @update:model-value="(list) => onColumnUpdate(col.key, list)"
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
