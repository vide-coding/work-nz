<script setup lang="ts">
import { ref, watch } from 'vue'
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
  getChildCounts: () => ({ total: 0, completed: 0 }),
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

// props.modelValue is readonly (Vue SFC). Give vuedraggable a writable local copy.
// 初始值从 prop 同步，之后由 vuedraggable 驱动变化，emit 到父组件更新 columnTasks。
const localTasks = ref<Task[]>([...props.modelValue])

// 当外部更新 prop（如初始加载、API 响应）时，同步到本地副本
// isDraggingRef 告诉父组件正在拖拽，此时不覆盖本地状态
let isDragging = false
watch(
  () => props.modelValue,
  (newVal) => {
    if (isDragging) return
    localTasks.value = [...newVal]
  }
)

function getChildren(taskId: string): Task[] {
  return props.childTasksMap[taskId] || []
}

function onTaskClick(task: Task) {
  emit('task-click', task)
}

function onAddClick() {
  emit('add-task', props.statusKey)
}

// @change: vuedraggable 已修改 localTasks，描述变化
// 跨列：source 列 fire evt.removed，destination 列 fire evt.added
// 同列：fire evt.moved
function onChange(evt: { added?: { element: Task; newIndex: number }; removed?: { element: Task; oldIndex: number }; moved?: { element: Task; newIndex: number; oldIndex: number } }) {
  isDragging = true
  try {
    if (evt.removed) {
      emit('update:modelValue', [...localTasks.value])
      emit('task-moved', { task: evt.removed.element, from: props.statusKey, to: '__removed__', newIndex: -1 })
    } else if (evt.added) {
      emit('update:modelValue', [...localTasks.value])
      emit('task-moved', { task: evt.added.element, from: '__unknown__', to: props.statusKey, newIndex: evt.added.newIndex })
    } else if (evt.moved) {
      emit('update:modelValue', [...localTasks.value])
      emit('task-moved', { task: evt.moved.element, from: props.statusKey, to: props.statusKey, newIndex: evt.moved.newIndex })
    }
  } finally {
    // 等 DOM 更新完成（vuedraggable 内部会更新），再允许外部同步
    setTimeout(() => { isDragging = false }, 0)
  }
}
</script>

<template>
  <div class="flex flex-col min-w-[280px] max-w-[320px] flex-1 bg-gray-50 rounded-xl overflow-hidden" :data-column-key="statusKey">
    <div class="flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200">
      <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: statusColor }" />
      <span class="text-sm font-semibold text-gray-700 flex-1">{{ statusName }}</span>
      <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{{ localTasks.length }}</span>
      <button class="flex items-center justify-center w-6 h-6 text-gray-400 bg-transparent rounded hover:bg-gray-100 hover:text-gray-700 transition-colors" @click="onAddClick" :title="$t('task.add')">
        <Plus :size="14" />
      </button>
    </div>

    <div class="flex-1 p-2 overflow-y-auto">
      <draggable
        v-model="localTasks"
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
