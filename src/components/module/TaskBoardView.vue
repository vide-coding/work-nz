<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Directory, Task } from '@/types'
import { useTaskModule } from '@/composables/useTaskModule'
import TaskColumn from './TaskColumn.vue'
import TaskDetailPanel from './TaskDetailPanel.vue'
import TaskQuickAdd from './TaskQuickAdd.vue'

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
} = useTaskModule(props.directory)

// Map status id to i18n key for localized column names
const statusI18nKeyMap: Record<string, string> = {
  todo: 'task.todo',
  in_progress: 'task.inProgress',
  done: 'task.done',
}

// Build columns from composable statusValues
const columns = computed(() =>
  statusValues.value.map((sv) => ({
    key: sv.id,
    name: sv.name,
    color: sv.color,
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

const selectedTask = ref<Task | null>(null)
const showDetailPanel = computed(() => selectedTask.value !== null)

onMounted(() => {
  loadTasks()
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

// Options passed to the detail panel for localized labels
const statusOptions = computed(() =>
  statusValues.value.map((sv) => ({ value: sv.id, label: sv.name }))
)

const priorityOptions = computed(() =>
  priorityValues.value.map((pv) => ({ value: pv.id, label: pv.name }))
)
</script>

<template>
  <div class="task-board">
    <TaskQuickAdd @add="onQuickAdd" />

    <div v-if="loading" class="task-board__loading">
      Loading...
    </div>

    <div v-else-if="error" class="task-board__error">
      {{ error }}
    </div>

    <div v-else class="task-board__columns">
      <TaskColumn
        v-for="col in columns"
        :key="col.key"
        :status-key="col.key"
        :status-name="col.name"
        :status-color="col.color"
        :tasks="tasksByStatus[col.key]"
        @task-click="onTaskClick"
        @add-task="onAddTask"
        @tasks-changed="(t) => onTasksChanged(col.key, t)"
      />
    </div>

    <TaskDetailPanel
      :task="selectedTask"
      :visible="showDetailPanel"
      :status-options="statusOptions"
      :priority-options="priorityOptions"
      @close="onDetailClose"
      @update="onDetailUpdate"
      @delete="onDetailDelete"
    />
  </div>
</template>

<style scoped>
.task-board {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f3f4f6;
}

.task-board__loading,
.task-board__error {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #6b7280;
}

.task-board__columns {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 16px;
  overflow-x: auto;
  overflow-y: hidden;
}
</style>
