<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'

const { t } = useI18n()

const props = defineProps<{
  visible: boolean
  statusName?: string
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
  const t = title.value.trim()
  if (!t) return
  emit('confirm', t)
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
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="space-y-3">
      <p v-if="statusName" class="text-sm text-gray-500">
        {{ t('task.addToColumn') }}: <span class="font-medium text-gray-700">{{ statusName }}</span>
      </p>
      <input
        v-model="title"
        class="w-full px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-lg transition-colors focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
        :placeholder="t('task.titlePlaceholder')"
        @keydown.enter="handleConfirm"
        @keydown.esc="handleCancel"
        autofocus
      />
    </div>

    <template #footer>
      <button
        class="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
        @click="handleCancel"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        class="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!title.trim()"
        @click="handleConfirm"
      >
        {{ t('task.add') }}
      </button>
    </template>
  </BaseDialog>
</template>
