<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Settings } from 'lucide-vue-next'
import type { Directory, Task } from '@/types'
import { useTaskModule } from '@/composables/useTaskModule'
import TaskColumn from './TaskColumn.vue'
import TaskDetailPanel from './TaskDetailPanel.vue'
import TaskQuickAdd from './TaskQuickAdd.vue'
import ColumnSettingsDialog from './ColumnSettingsDialog.vue'

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

// Group tasks by status
const tasksByStatus = computed(() => {
  const map: Record<string, Task[]> = { todo: [], in_progress: [], done: [] }
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

// Watch selected task to load child tasks
watch(selectedTask, async (task) => {
  if (task) {
    await loadChildTasks(task.id)
  }
})

// Get child tasks for a task
function getChildren(taskId: string): Task[] {
  return childTasksMap.value[taskId] || []
}

// Get child counts for a task
function getCounts(taskId: string): { total: number; completed: number } {
  const children = getChildren(taskId)
  return {
    total: children.length,
    completed: children.filter((c) => c.isCompleted).length,
  }
}

// Get child tasks for selected task
const selectedChildTasks = computed(() => {
  if (!selectedTask.value) return []
  return getChildren(selectedTask.value.id)
})

const selectedChildCounts = computed(() => {
  if (!selectedTask.value) return { total: 0, completed: 0 }
  return getCounts(selectedTask.value.id)
})

onMounted(() => {
  loadTasks()
  loadColumns()
})

async function onQuickAdd(title: string) {
  await createTask({ title })
}

async function onAddTask(statusKey: string) {
  const title = window.prompt('Task title:')
  if (!title) return
  await createTask({ title, status: statusKey })
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

async function onTasksChanged(statusKey: string, newTasks: Task[]) {
  if (newTasks.length > 0) {
    const last = newTasks[newTasks.length - 1]
    await reorderTask(last.id, statusKey, newTasks.length - 1)
  }
}

// Child task handlers
async function onToggleChild(childId: string) {
  await toggleChildComplete(childId)
  // Refresh child tasks for selected task
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

// Card-level child task handlers
async function onCardToggleChild(childId: string) {
  await toggleChildComplete(childId)
}

async function onCardDeleteChild(childId: string) {
  await deleteChildTask(childId)
}

async function onCardAddChild(parentId: string, title: string) {
  await createChildTask(parentId, title)
}

// Options passed to the detail panel for localized labels
const statusOptions = computed(() =>
  statusValues.value.map((sv) => ({ value: sv.id, label: sv.name }))
)

const priorityOptions = computed(() =>
  priorityValues.value.map((pv) => ({ value: pv.id, label: pv.name }))
)
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

    <div v-else class="flex-1 flex gap-4 p-4 overflow-x-auto overflow-y-hidden">
      <TaskColumn
        v-for="col in boardColumns"
        :key="col.key"
        :status-key="col.key"
        :status-name="col.name"
        :status-color="col.color"
        :tasks="tasksByStatus[col.key]"
        :child-tasks-map="childTasksMap"
        :get-child-counts="getCounts"
        @task-click="onTaskClick"
        @add-task="onAddTask"
        @tasks-changed="(t) => onTasksChanged(col.key, t)"
        @toggle-child="onCardToggleChild"
        @delete-child="onCardDeleteChild"
        @add-child="onCardAddChild"
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

    <TaskDetailPanel
      :task="selectedTask"
      :visible="showDetailPanel"
      :status-options="statusOptions"
      :priority-options="priorityOptions"
      :child-tasks="selectedChildTasks"
      :child-count="selectedChildCounts"
      @close="onDetailClose"
      @update="onDetailUpdate"
      @delete="onDetailDelete"
      @toggle-child="onToggleChild"
      @delete-child="onDeleteChild"
      @add-child="onAddChild"
    />
  </div>
</template>
