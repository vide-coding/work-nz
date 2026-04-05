<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import type { Task } from '@/types'
import TaskCard from './TaskCard.vue'

interface Props {
  statusKey: string
  statusName: string
  statusColor: string
  tasks: Task[]
  childTasksMap?: Record<string, Task[]>
  getChildCounts?: (taskId: string) => { total: number; completed: number }
}

const props = withDefaults(defineProps<Props>(), {
  childTasksMap: () => ({}),
  getChildCounts: () => () => ({ total: 0, completed: 0 }),
})

const emit = defineEmits<{
  'task-click': [task: Task]
  'add-task': [statusKey: string]
  'tasks-reordered': [payload: { taskId: string; newStatus: string; newIndex: number }]
  'task-cross-column-move': [payload: { taskId: string; newStatus: string; newIndex: number }]
  'toggle-child': [childId: string]
  'delete-child': [childId: string]
  'add-child': [parentId: string, title: string]
}>()

function getChildren(taskId: string): Task[] {
  return props.childTasksMap[taskId] || []
}

function onTaskClick(task: Task) {
  emit('task-click', task)
}

function onAddClick() {
  emit('add-task', props.statusKey)
}

// Handle vuedraggable change events for in-column reorder
function onChange(evt: { added?: { element: Task; newIndex: number }; moved?: { element: Task; newIndex: number } }) {
  if (evt.moved) {
    // In-column reorder: use the moved element directly
    emit('tasks-reordered', {
      taskId: evt.moved.element.id,
      newStatus: props.statusKey,
      newIndex: evt.moved.newIndex,
    })
  } else if (evt.added) {
    // Cross-column move into this column
    emit('task-cross-column-move', {
      taskId: evt.added.element.id,
      newStatus: props.statusKey,
      newIndex: evt.added.newIndex,
    })
  }
}
</script>

<template>
  <div class="flex flex-col min-w-[280px] max-w-[320px] flex-1 bg-gray-50 rounded-xl overflow-hidden">
    <div class="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
      <span
        class="w-2.5 h-2.5 rounded-full flex-shrink-0"
        :style="{ backgroundColor: statusColor }"
      />
      <span class="text-sm font-semibold text-gray-700 flex-1">{{ statusName }}</span>
      <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{{ tasks.length }}</span>
      <button class="flex items-center justify-center w-6 h-6 text-gray-400 bg-transparent rounded hover:bg-gray-100 hover:text-gray-700 transition-colors" @click="onAddClick" :title="$t('task.add')">
        <Plus :size="14" />
      </button>
    </div>

    <div class="flex-1 p-2 overflow-y-auto">
      <draggable
        :model-value="tasks"
        @change="onChange"
        :group="{ name: 'tasks' }"
        item-key="id"
        class="flex flex-col gap-2"
        :class="tasks.length === 0 ? 'min-h-48' : 'min-h-10'"
        animation="200"
        force-fallback="true"
        ghost-class="opacity-50"
      >
        <template #item="{ element }">
          <TaskCard
            :task="element"
            :child-tasks="getChildren(element.id)"
            :child-count="getChildCounts(element.id)"
            @click="onTaskClick"
            @toggle-child="emit('toggle-child', $event)"
            @delete-child="emit('delete-child', $event)"
            @add-child="(parentId, title) => emit('add-child', parentId, title)"
          />
        </template>
        <template #footer>
          <div v-if="tasks.length === 0" class="h-32 border-2 border-dashed border-gray-300 rounded-lg" />
        </template>
      </draggable>
    </div>
  </div>
</template>
<style>
.task-card--ghost {
  opacity: 0.4;
  background: #dbeafe;
  border: 2px dashed #3b82f6;
}

.task-card--drag {
  transform: rotate(2deg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
</style>
