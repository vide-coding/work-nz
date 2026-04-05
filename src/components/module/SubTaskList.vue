<script setup lang="ts">
import { ref, watch } from 'vue'
import draggable from 'vuedraggable'
import type { Task } from '@/types'
import SubTaskItem from './SubTaskItem.vue'

interface Props {
  parentId: string
  childTasks: Task[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'toggle': [id: string]
  'delete': [id: string]
  'add': [parentId: string, title: string]
}>()

const localTasks = ref<Task[]>([...props.childTasks])

watch(() => props.childTasks, (tasks) => {
  localTasks.value = [...tasks]
})

const newTaskTitle = ref('')

function onAdd() {
  const title = newTaskTitle.value.trim()
  if (!title) return
  emit('add', props.parentId, title)
  newTaskTitle.value = ''
}
</script>

<template>
  <div class="border-t border-gray-200 pt-2 mt-2">
    <draggable
      v-model="localTasks"
      item-key="id"
      class="flex flex-col gap-1"
      handle=".subtask-item"
    >
      <template #item="{ element }">
        <SubTaskItem
          :task="element"
          @toggle="emit('toggle', $event)"
          @delete="emit('delete', $event)"
        />
      </template>
    </draggable>

    <div class="mt-2">
      <input
        v-model="newTaskTitle"
        class="w-full px-2.5 py-1.5 text-[13px] text-gray-700 bg-transparent border border-dashed border-gray-300 rounded-md transition-colors focus:outline-none focus:border-blue-500 focus:border-solid placeholder:text-gray-400"
        :placeholder="$t('task.quickAdd')"
        @keydown.enter="onAdd"
      />
    </div>
  </div>
</template>
