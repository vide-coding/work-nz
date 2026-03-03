<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseDialog from '@/components/common/BaseDialog.vue'

const props = defineProps<{
  modelValue: boolean
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  create: [name: string, description: string]
}>()

const nameInput = ref('')
const descriptionInput = ref('')

// Reset inputs when dialog opens
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      nameInput.value = ''
      descriptionInput.value = ''
    }
  },
  { immediate: true }
)

function handleCreate() {
  emit('create', nameInput.value.trim(), descriptionInput.value.trim())
}

function handleCancel() {
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    title="创建新项目"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          项目名称
        </label>
        <input
          v-model="nameInput"
          type="text"
          placeholder="输入项目名称"
          class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          @keyup.enter="handleCreate"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          描述
        </label>
        <textarea
          v-model="descriptionInput"
          rows="3"
          placeholder="输入项目描述（可选）"
          class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
        ></textarea>
      </div>

      <div
        v-if="error"
        class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
      >
        <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      </div>
    </div>

    <template #footer>
      <button
        class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        @click="handleCancel"
      >
        取消
      </button>
      <button
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
        :disabled="!nameInput.trim() || loading"
        @click="handleCreate"
      >
        {{ loading ? '创建中...' : '创建' }}
      </button>
    </template>
  </BaseDialog>
</template>
