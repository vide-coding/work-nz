<script setup lang="ts">
import { ref } from 'vue'
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

const newTaskTitle = ref('')

function onAdd() {
  const title = newTaskTitle.value.trim()
  if (!title) return
  emit('add', props.parentId, title)
  newTaskTitle.value = ''
}
</script>

<template>
  <div class="subtask-list">
    <draggable
      v-model="childTasks"
      item-key="id"
      class="subtask-list__items"
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

    <div class="subtask-list__add">
      <input
        v-model="newTaskTitle"
        class="subtask-list__input"
        :placeholder="$t('task.quickAdd')"
        @keydown.enter="onAdd"
      />
    </div>
  </div>
</template>

<style scoped>
.subtask-list {
  border-top: 1px solid #e5e7eb;
  padding-top: 8px;
  margin-top: 8px;
}

.subtask-list__items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.subtask-list__add {
  margin-top: 8px;
}

.subtask-list__input {
  width: 100%;
  padding: 6px 10px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  color: #374151;
  background: transparent;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.subtask-list__input:focus {
  outline: none;
  border-color: #3b82f6;
  border-style: solid;
}

.subtask-list__input::placeholder {
  color: #9ca3af;
}
</style>
