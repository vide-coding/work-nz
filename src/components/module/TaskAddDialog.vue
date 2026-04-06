<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  statusKey?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [title: string]
}>()

const title = ref('')

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      title.value = ''
    }
  }
)

function handleConfirm() {
  const trimmed = title.value.trim()
  if (!trimmed) return
  emit('confirm', trimmed)
  emit('update:visible', false)
}

function handleCancel() {
  emit('update:visible', false)
}
</script>

<template>
  <BaseDialog
    :model-value="visible"
    :title="t('task.addTask')"
    width="max-w-sm"
    :show-close="false"
    @update:modelValue="emit('update:visible', $event)"
  >
    <div class="space-y-3">
      <p v-if="statusKey" class="text-sm text-gray-500 dark:text-gray-400">
        {{ t('task.addToColumn') }}: <span class="font-medium text-gray-700 dark:text-gray-300">{{ statusKey }}</span>
      </p>
      <input
        v-model="title"
        class="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors focus:outline-none focus:border-indigo-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        :placeholder="$t('task.titlePlaceholder')"
        @keydown.enter="handleConfirm"
        @keydown.esc="handleCancel"
        autofocus
      />
    </div>

    <template #footer>
      <button
        class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors cursor-pointer border-none bg-transparent"
        @click="handleCancel"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-500 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors cursor-pointer border-none disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!title.trim()"
        @click="handleConfirm"
      >
        {{ t('task.add') }}
      </button>
    </template>
  </BaseDialog>
</template>
