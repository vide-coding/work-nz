<script setup lang="ts">
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue'
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
  tasks,
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

// Group tasks by status - returns same reference when no changes
const tasksByStatus = computed(() => {
  const map: Record<string, Task[]> = {}
  for (const col of columns.value) {
    map[col.statusKey] = []
  }
  for (const task of tasks.value) {
    if (map[task.status]) {
      map[task.status].push(task)
    }
  }
  return map
})

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
async function onTasksReordered(payload: { taskId: string; newStatus: string; newIndex: number }) {
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
