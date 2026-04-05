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
  <div class="bg-white border border-gray-200 rounded-lg overflow-hidden transition-shadow hover:shadow-md" :class="{ 'border-gray-300': isExpanded }">
    <div class="flex items-start gap-2 p-2.5 cursor-pointer" @click="onCardClick">
      <div class="text-gray-300 cursor-grab flex-shrink-0 pt-0.5 active:cursor-grabbing">
        <GripVertical :size="14" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1">
          <span class="flex-1 text-sm font-medium text-gray-800 leading-tight truncate">{{ task.title }}</span>
          <button
            v-if="childCount.total > 0"
            class="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[11px] transition-colors hover:bg-gray-200 hover:text-gray-700 flex-shrink-0"
            @click.stop="toggleExpand"
            :title="isExpanded ? 'Collapse' : 'Expand'"
          >
            <span class="font-semibold">{{ childCount.completed }}/{{ childCount.total }}</span>
            <component :is="isExpanded ? ChevronDown : ChevronRight" :size="14" />
          </button>
          <button
            v-else
            class="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            @click.stop="toggleExpand"
            :title="'Expand subtasks'"
          >
            <ChevronRight :size="14" />
          </button>
        </div>
        <div class="flex items-center gap-2 mt-1.5">
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: priorityColor }"
            :title="task.priority"
          />
          <span v-if="task.assignee" class="text-xs text-gray-500">
            {{ task.assignee }}
          </span>
        </div>
      </div>
    </div>

    <!-- Subtask list -->
    <Transition name="expand">
      <div v-if="isExpanded && childTasks.length > 0" class="border-t border-gray-100 p-2 pb-3 bg-gray-50">
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