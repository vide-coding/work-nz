<script setup lang="ts">
import { ref } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import type { Task } from '@/types'

interface Props {
  task: Task
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <div class="subtask-item">
    <input
      type="checkbox"
      :checked="task.isCompleted"
      class="subtask-item__checkbox"
      @change="emit('toggle', task.id)"
    />
    <span
      class="subtask-item__title"
      :class="{ 'subtask-item__title--completed': task.isCompleted }"
    >
      {{ task.title }}
    </span>
    <button class="subtask-item__delete" @click="emit('delete', task.id)">
      <Trash2 :size="12" />
    </button>
  </div>
</template>

<style scoped>
.subtask-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f9fafb;
  border-radius: 6px;
  transition: background 0.15s;
}

.subtask-item:hover {
  background: #f3f4f6;
}

.subtask-item__checkbox {
  width: 14px;
  height: 14px;
  cursor: pointer;
  flex-shrink: 0;
}

.subtask-item__title {
  flex: 1;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.subtask-item__title--completed {
  text-decoration: line-through;
  color: #9ca3af;
}

.subtask-item__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
  flex-shrink: 0;
}

.subtask-item:hover .subtask-item__delete {
  opacity: 1;
}

.subtask-item__delete:hover {
  color: #ef4444;
}
</style>
