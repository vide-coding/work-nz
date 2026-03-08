<script setup lang="ts">
import { ref, watch } from 'vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import type { WorkspaceInfo } from '@/types'

const props = defineProps<{
  modelValue: boolean
  workspace: WorkspaceInfo | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [alias: string | undefined]
}>()

const aliasInput = ref('')

// Reset alias input when dialog opens
watch(
  () => props.modelValue,
  (open) => {
    if (open && props.workspace) {
      aliasInput.value = props.workspace.alias || ''
    }
  },
  { immediate: true }
)

function handleSave() {
  const alias = aliasInput.value.trim() || undefined
  emit('save', alias)
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('update:modelValue', false)
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    title="$t('workspace.rename')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ $t('workspace.aliasPlaceholder') }}
        </label>
        <input
          v-model="aliasInput"
          type="text"
          :placeholder="$t('workspace.aliasPlaceholder')"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          @keyup.enter="handleSave"
        />
        <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{{ $t('workspace.aliasHint') }}</p>
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
