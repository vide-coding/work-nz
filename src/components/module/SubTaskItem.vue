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
  <div class="group flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-md transition-colors hover:bg-gray-100">
    <input
      type="checkbox"
      :checked="task.isCompleted"
      class="w-3.5 h-3.5 cursor-pointer flex-shrink-0"
      @change="emit('toggle', task.id)"
    />
    <span
      class="flex-1 text-[13px] text-gray-700 leading-tight min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
      :class="{ 'line-through text-gray-400': task.isCompleted }"
    >
      {{ task.title }}
    </span>
    <button class="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 text-gray-300 hover:text-red-500 rounded transition-all flex-shrink-0" @click="emit('delete', task.id)">
      <Trash2 :size="12" />
    </button>
  </div>
</template>
