<script setup lang="ts">
import { ref, computed } from 'vue'
import { GripVertical, ChevronDown, ChevronRight } from 'lucide-vue-next'
import type { Task } from '@/types'
import SubTaskList from './SubTaskList.vue'

interface Props {
  task: Task
  childTasks?: Task[]
  childCount?: { total: number; completed: number }
}

const props = withDefaults(defineProps<Props>(), {
  childTasks: () => [],
  childCount: () => ({ total: 0, completed: 0 }),
})

const emit = defineEmits<{
  click: [task: Task]
  'toggle-child': [childId: string]
  'delete-child': [childId: string]
  'add-child': [parentId: string, title: string]
}>()

const isExpanded = ref(false)

const priorityColors: Record<string, string> = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#10B981',
  low: '#9CA3AF',
}

const priorityColor = computed(() => priorityColors[props.task.priority] || '#9CA3AF')

function toggleExpand(e: Event) {
  e.stopPropagation()
  isExpanded.value = !isExpanded.value
}

function onCardClick() {
  emit('click', props.task)
}
</script>

<template>
  <div class="task-card" :class="{ 'task-card--expanded': isExpanded }">
    <div class="task-card__main" @click="onCardClick">
      <div class="task-card__drag-handle">
        <GripVertical :size="14" />
      </div>
      <div class="task-card__content">
        <div class="task-card__title-row">
          <span class="task-card__title">{{ task.title }}</span>
          <button
            v-if="childCount.total > 0"
            class="task-card__expand-btn"
            @click="toggleExpand"
            :title="isExpanded ? 'Collapse' : 'Expand'"
          >
            <span class="task-card__progress">{{ childCount.completed }}/{{ childCount.total }}</span>
            <component :is="isExpanded ? ChevronDown : ChevronRight" :size="14" />
          </button>
          <button
            v-else
            class="task-card__expand-btn task-card__expand-btn--hint"
            @click="toggleExpand"
            :title="'Expand subtasks'"
          >
            <ChevronRight :size="14" />
          </button>
        </div>
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

    <!-- Subtask list -->
    <Transition name="expand">
      <div v-if="isExpanded && childTasks.length > 0" class="task-card__subtasks">
        <SubTaskList
          :parent-id="task.id"
          :child-tasks="childTasks"
          @toggle="emit('toggle-child', $event)"
          @delete="emit('delete-child', $event)"
          @add="(parentId, title) => emit('add-child', parentId, title)"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.task-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.task-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.task-card--expanded {
  border-color: #d1d5db;
}

.task-card__main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
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

.task-card__title-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.task-card__title {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-card__expand-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 10px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  flex-shrink: 0;
}

.task-card__expand-btn:hover {
  background: #e5e7eb;
  color: #374151;
}

.task-card__expand-btn--hint {
  padding: 2px 4px;
}

.task-card__progress {
  font-weight: 600;
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

.task-card__subtasks {
  border-top: 1px solid #f3f4f6;
  padding: 8px 12px 12px;
  background: #fafafa;
}

/* Expand transition */
.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.2s ease, max-height 0.2s ease;
  overflow: hidden;
  max-height: 500px;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
</style>
