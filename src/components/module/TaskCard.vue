<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import type { Task } from '@/types'

interface Props {
  task: Task
  childCount?: { total: number; completed: number }
  childTasks?: Task[]
  priorityColorMap?: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  childCount: () => ({ total: 0, completed: 0 }),
  childTasks: () => [],
  priorityColorMap: () => ({}),
})

const emit = defineEmits<{
  click: [task: Task]
  'toggle-child': [payload: { childId: string; parentId: string }]
}>()

// 从 TaskBoardView provide 注入，优先用 inject，兜底用 props
const injectedColorMap = inject<Record<string, string>>('priorityColorMap', {})
const colorMap = computed(() =>
  Object.keys(props.priorityColorMap).length > 0 ? props.priorityColorMap : injectedColorMap
)

const priorityColor = computed(() => colorMap.value[props.task.priority] ?? '#9CA3AF')

// 只显示未完成子任务（最多3条）
const displayedChildren = computed(() =>
  props.childTasks.filter((c) => !c.isCompleted).slice(0, 3)
)

// 点击后标记消失动画，避免列表抖动
const disappearingIds = ref<Set<string>>(new Set())

function onCardClick() {
  emit('click', props.task)
}

function onChildCheckClick(childId: string, e: Event) {
  e.stopPropagation()
  // 触发消失动画，300ms 后 emit 真正完成
  disappearingIds.value = new Set([...disappearingIds.value, childId])
  setTimeout(() => {
    emit('toggle-child', { childId, parentId: props.task.id })
    disappearingIds.value = new Set([...disappearingIds.value].filter((id) => id !== childId))
  }, 300)
}
</script>

<template>
  <div
    class="task-card-drag-handle bg-white border border-gray-200 rounded-lg overflow-hidden transition-shadow hover:shadow-md select-none"
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
          <span
            v-if="childCount.total > 0"
            class="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[11px] font-semibold flex-shrink-0"
            :class="{ 'bg-green-100 text-green-600': childCount.completed === childCount.total }"
          >
            {{ childCount.completed }}/{{ childCount.total }}
          </span>
        </div>

        <!-- 描述行：最多显示2行 -->
        <p
          v-if="task.description"
          class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed"
        >
          {{ task.description }}
        </p>

        <!-- 子任务列表：最多显示3条（仅未完成），带视觉分割 -->
        <div v-if="displayedChildren.length > 0" class="mt-2 pt-2 border-t border-dashed border-gray-200 flex flex-col gap-1">
          <div
            v-for="child in displayedChildren"
            :key="child.id"
            class="flex items-center gap-1.5"
          >
            <!-- 仅复选框可点击，内容不可触发 -->
            <span
              class="w-3 h-3 rounded-sm border border-gray-300 bg-white flex-shrink-0 cursor-pointer hover:border-blue-400 transition-colors"
              :class="{ 'child-disappearing': disappearingIds.has(child.id) }"
              @click.stop="onChildCheckClick(child.id, $event)"
            />
            <span class="text-[11px] leading-tight text-gray-600 truncate select-none">
              {{ child.title }}
            </span>
          </div>
        </div>

        <!-- Assignee 行 -->
        <div v-if="task.assignee" class="flex items-center gap-2 mt-1">
          <span class="text-xs text-gray-400">@{{ task.assignee }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* line-clamp-2 utility */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 子任务完成消失动画 */
.child-disappearing {
  opacity: 0;
  transform: scale(0.7);
  transition: opacity 300ms ease, transform 300ms ease;
}
</style>
