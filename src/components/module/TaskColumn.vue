<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import type { Task } from '@/types'
import TaskCard from './TaskCard.vue'

interface Props {
  statusKey: string
  statusName: string
  statusColor: string
  tasks: Task[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'task-click': [task: Task]
  'add-task': [statusKey: string]
  'tasks-changed': [tasks: Task[]]
}>()

const localTasks = computed({
  get: () => props.tasks,
  set: (val) => emit('tasks-changed', val),
})

function onTaskClick(task: Task) {
  emit('task-click', task)
}

function onAddClick() {
  emit('add-task', props.statusKey)
}
</script>

<template>
  <div class="task-column">
    <div class="task-column__header">
      <span
        class="task-column__dot"
        :style="{ backgroundColor: statusColor }"
      />
      <span class="task-column__name">{{ statusName }}</span>
      <span class="task-column__count">{{ tasks.length }}</span>
      <button class="task-column__add" @click="onAddClick" :title="$t('task.add')">
        <Plus :size="14" />
      </button>
    </div>

    <div class="task-column__body">
      <draggable
        v-model="localTasks"
        :group="{ name: 'tasks' }"
        item-key="id"
        class="task-column__list"
        ghost-class="task-card--ghost"
        drag-class="task-card--drag"
      >
        <template #item="{ element }">
          <TaskCard :task="element" @click="onTaskClick" />
        </template>
      </draggable>

      <div v-if="tasks.length === 0" class="task-column__empty">
        {{ $t('task.noTasks') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-column {
  display: flex;
  flex-direction: column;
  min-width: 280px;
  max-width: 320px;
  flex: 1;
  background: #f9fafb;
  border-radius: 12px;
  overflow: hidden;
}

.task-column__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.task-column__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-column__name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  flex: 1;
}

.task-column__count {
  font-size: 12px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
}

.task-column__add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9ca3af;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.task-column__add:hover {
  background: #f3f4f6;
  color: #374151;
}

.task-column__body {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.task-column__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 40px;
}

.task-column__empty {
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  padding: 24px 0;
}
</style>

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
