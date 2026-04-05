<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import type { Task } from '@/types'

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

// 计算未完成的子任务（最多3条）
const unfinishedChildTasks = computed(() => {
  return (props.childTasks || [])
    .filter(t => !t.isCompleted)
    .slice(0, 3)
})

const moreUnfinishedCount = computed(() => {
  const total = (props.childTasks || []).filter(t => !t.isCompleted).length
  return Math.max(0, total - 3)
})

// 快速添加子任务
const newChildTitle = ref('')

function onAddChild() {
  const title = newChildTitle.value.trim()
  if (title) {
    emit('add-child', props.task.id, title)
    newChildTitle.value = ''
  }
}

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
  <div
    class="task-card-drag-handle bg-white border border-gray-200 rounded-lg overflow-hidden transition-shadow hover:shadow-md select-none"
    :class="{ 'border-gray-300': isExpanded }"
    :data-task-id="task.id"
    @click="onCardClick"
  >
    <div class="flex items-start gap-2 p-2.5 cursor-pointer">
      <div class="flex-1 min-w-0">
        <!-- 标题行：优先级 + 标题 + 子任务计数 -->
        <div class="flex items-center gap-1.5">
          <span
            class="w-2 h-2 rounded-full flex-shrink-0"
            :style="{ backgroundColor: priorityColor }"
            :title="task.priority"
          />
          <span class="flex-1 text-sm font-medium text-gray-800 leading-tight truncate">{{ task.title }}</span>
          <button
            v-if="childCount.total > 0"
            class="flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[11px] transition-colors hover:bg-gray-200 hover:text-gray-700 flex-shrink-0"
            @click.stop="toggleExpand"
            :title="isExpanded ? $t('task.collapse') : $t('task.expand')"
          >
            <span class="font-semibold">{{ childCount.completed }}/{{ childCount.total }}</span>
            <component :is="isExpanded ? ChevronDown : ChevronRight" :size="14" />
          </button>
          <button
            v-else
            class="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            @click.stop="toggleExpand"
            :title="$t('task.expandSubtasks')"
          >
            <ChevronRight :size="14" />
          </button>
        </div>

        <!-- 描述行：最多显示2行 -->
        <p
          v-if="task.description"
          class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed"
        >
          {{ task.description }}
        </p>

        <!-- Assignee 行 -->
        <div v-if="task.assignee" class="flex items-center gap-2 mt-1">
          <span class="text-xs text-gray-400">@{{ task.assignee }}</span>
        </div>
      </div>
    </div>

    <!-- 子任务列表 -->
    <Transition name="expand">
      <div v-if="isExpanded" class="border-t border-gray-100 p-2 pb-3 bg-gray-50">
        <!-- 未完成的子任务（最多3条） -->
        <div
          v-for="child in unfinishedChildTasks"
          :key="child.id"
          class="group flex items-center gap-2 py-1.5 px-2 bg-white border border-gray-100 rounded-md mb-1.5"
        >
          <input
            type="checkbox"
            :checked="child.isCompleted"
            class="w-3.5 h-3.5 cursor-pointer flex-shrink-0"
            @change="emit('toggle-child', child.id)"
          />
          <span class="flex-1 text-[13px] text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap">
            {{ child.title }}
          </span>
        </div>

        <!-- 如果有更多未完成的子任务 -->
        <div v-if="moreUnfinishedCount > 0" class="text-[11px] text-gray-400 text-center py-1">
          +{{ moreUnfinishedCount }} more
        </div>

        <!-- 添加子任务输入框 -->
        <div class="mt-2 flex gap-2">
          <input
            v-model="newChildTitle"
            class="flex-1 px-2 py-1.5 text-[12px] bg-white border border-dashed border-gray-300 rounded-md"
            :placeholder="$t('task.quickAdd')"
            @keydown.enter="onAddChild"
          />
          <button
            class="px-2.5 py-1 text-[12px] bg-blue-500 text-white rounded-md"
            @click="onAddChild"
          >
            {{ $t('task.add') }}
          </button>
        </div>
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

/* line-clamp-2 utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
