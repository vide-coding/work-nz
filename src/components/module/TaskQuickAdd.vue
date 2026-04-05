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
  <div class="flex gap-2 p-3 bg-white border-b border-gray-200">
    <input
      v-model="title"
      class="flex-1 px-3.5 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg transition-colors focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
      :placeholder="$t('task.quickAdd')"
      @keydown.enter="onSubmit"
    />
    <button class="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600" :disabled="!title.trim()" @click="onSubmit">
      <Plus :size="16" />
      {{ $t('task.add') }}
    </button>
  </div>
</template>
