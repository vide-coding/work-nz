<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import type { Project } from '@/types'

const props = defineProps<{
  modelValue: boolean
  project: Project | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [name: string, description: string]
}>()

const nameInput = ref('')
const descriptionInput = ref('')

// Reset inputs when dialog opens
watch(
  () => props.modelValue,
  (open) => {
    if (open && props.project) {
      nameInput.value = props.project.name
      descriptionInput.value = props.project.description || ''
    }
  },
  { immediate: true }
)

function handleSave() {
  emit('save', nameInput.value.trim(), descriptionInput.value.trim())
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    :title="$t('projectEdit.title')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('projectEdit.name') }}
        </label>
        <input
          v-model="nameInput"
          type="text"
          :placeholder="$t('projectEdit.namePlaceholder')"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @keyup.enter="handleSave"
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('projectEdit.description') }}
        </label>
        <textarea
          v-model="descriptionInput"
          :placeholder="$t('projectEdit.descriptionPlaceholder')"
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
    </div>

    <template #footer>
      <button
        class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        @click="handleCancel"
      >
        {{ $t('common.cancel') }}
      </button>
      <button
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
        @click="handleSave"
      >
        {{ $t('common.save') }}
      </button>
    </template>
  </BaseDialog>
</template>
