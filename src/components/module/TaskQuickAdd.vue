<script setup lang="ts">
import { ref } from 'vue'
import { Plus } from 'lucide-vue-next'

const emit = defineEmits<{
  add: [title: string, onDone: () => void]
}>()

const title = ref('')
const isSubmitting = ref(false)

function onSubmit() {
  const t = title.value.trim()
  if (!t || isSubmitting.value) return
  isSubmitting.value = true
  emit('add', t, () => {
    // 父组件调用此回调表示操作完成（成功或失败均需重置）
    isSubmitting.value = false
    title.value = ''
  })
}
</script>

<template>
  <div class="flex gap-2 p-3 bg-white border-b border-gray-200">
    <input
      v-model="title"
      class="flex-1 px-3.5 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg transition-colors focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
      :placeholder="$t('task.quickAdd')"
      :disabled="isSubmitting"
      @keydown.enter="onSubmit"
    />
    <button
      class="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600"
      :disabled="!title.trim() || isSubmitting"
      @click="onSubmit"
    >
      <Plus v-if="!isSubmitting" :size="16" />
      <span v-else class="animate-spin">⟳</span>
      <span v-if="isSubmitting">{{ $t('common.saving') }}</span>
      <span v-else>{{ $t('task.add') }}</span>
    </button>
  </div>
</template>
