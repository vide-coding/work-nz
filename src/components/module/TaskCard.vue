<script setup lang="ts">
import { computed } from 'vue'
import { GripVertical } from 'lucide-vue-next'
import type { Task } from '@/types'

interface Props {
  task: Task
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: [task: Task]
}>()

const priorityColors: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#10B981',
  low: '#9CA3AF',
}

const priorityColor = computed(() => priorityColors[props.task.priority] || '#9CA3AF')
</script>

<template>
  <div class="task-card" @click="emit('click', props.task)">
    <div class="task-card__drag-handle">
      <GripVertical :size="14" />
    </div>
    <div class="task-card__content">
      <div class="task-card__title">{{ task.title }}</div>
      <div class="task-card__meta">
        <span
          class="task-card__priority"
          :style="{ backgroundColor: priorityColor }"
          :title="task.priority"
        />
        <span v-if="task.assignee" class="task-card__assignee">
          {{ task.assignee }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}

.task-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.task-card__drag-handle {
  color: #d1d5db;
  cursor: grab;
  flex-shrink: 0;
  padding-top: 2px;
}

.task-card__drag-handle:active {
  cursor: grabbing;
}

.task-card__content {
  flex: 1;
  min-width: 0;
}

.task-card__title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.task-card__priority {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.task-card__assignee {
  font-size: 12px;
  color: #6b7280;
}
</style>
