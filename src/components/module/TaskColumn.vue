<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import type { Task } from '@/types'
import TaskCard from './TaskCard.vue'

interface Props {
  statusKey: string
  statusName: string
  statusColor: string
  modelValue: Task[]
  childTasksMap?: Record<string, Task[]>
  getChildCounts?: (taskId: string) => { total: number; completed: number }
}

const props = withDefaults(defineProps<Props>(), {
  childTasksMap: () => ({}),
  getChildCounts: () => () => ({ total: 0, completed: 0 }),
})

const emit = defineEmits<{
  'update:modelValue': [tasks: Task[]]
  'task-click': [task: Task]
  'add-task': [statusKey: string]
  'task-moved': [payload: { task: Task; from: string; to: string; newIndex: number }]
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

// @change: vuedraggable 内部已修改数组，evt.added/evt.removed 描述变化
// we emit to parent so it can update columnTasks (shallowRef needs manual trigger)
function onChange(evt: { added?: { element: Task; newIndex: number }; removed?: { element: Task; oldIndex: number }; moved?: { element: Task; newIndex: number; oldIndex: number } }) {
  // Cross-column: element was added to this column from another
  if (evt.added) {
    emit('update:modelValue', [...props.modelValue])
    emit('task-moved', {
      task: evt.added.element,
      from: '__unknown__', // parent resolves actual from via columnTasks diff
      to: props.statusKey,
      newIndex: evt.added.newIndex,
    })
  }
  // In-column reorder: element moved within same column
  if (evt.moved) {
    emit('update:modelValue', [...props.modelValue])
    emit('task-moved', {
      task: evt.moved.element,
      from: props.statusKey,
      to: props.statusKey,
      newIndex: evt.moved.newIndex,
    })
  }
  // evt.removed is ignored — source column handles its own update
}
</script>

<template>
  <div class="flex flex-col min-w-[280px] max-w-[320px] flex-1 bg-gray-50 rounded-xl overflow-hidden" :data-column-key="statusKey">
    <div class="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
      <span
        class="w-2.5 h-2.5 rounded-full flex-shrink-0"
        :style="{ backgroundColor: statusColor }"
      />
      <span class="text-sm font-semibold text-gray-700 flex-1">{{ statusName }}</span>
      <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{{ modelValue.length }}</span>
      <button class="flex items-center justify-center w-6 h-6 text-gray-400 bg-transparent rounded hover:bg-gray-100 hover:text-gray-700 transition-colors" @click="onAddClick" :title="$t('task.add')">
        <Plus :size="14" />
      </button>
    </div>

    <div class="flex-1 p-2 overflow-y-auto">
      <draggable
        v-model="props.modelValue"
        @change="onChange"
        :group="{ name: 'tasks' }"
        item-key="id"
        class="flex flex-col gap-2 min-h-10"
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
