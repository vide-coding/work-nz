<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'

const emit = defineEmits<{
  add: [title: string]
}>()

const title = ref('')

function onSubmit() {
  const t = title.value.trim()
  if (!t) return
  emit('add', t)
  title.value = ''
}
</script>

<template>
  <div class="task-quick-add">
    <input
      v-model="title"
      class="task-quick-add__input"
      :placeholder="$t('task.quickAdd')"
      @keydown.enter="onSubmit"
    />
    <button class="task-quick-add__btn" :disabled="!title.trim()" @click="onSubmit">
      <Plus :size="16" />
      {{ $t('task.add') }}
    </button>
  </div>
</template>

<style scoped>
.task-quick-add {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
}

.task-quick-add__input {
  flex: 1;
  padding: 8px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  color: #111827;
  transition: border-color 0.15s;
}

.task-quick-add__input:focus {
  outline: none;
  border-color: #3b82f6;
}

.task-quick-add__input::placeholder {
  color: #9ca3af;
}

.task-quick-add__btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  border: none;
  background: #3b82f6;
  color: white;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.task-quick-add__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.task-quick-add__btn:not(:disabled):hover {
  background: #2563eb;
}
</style>
