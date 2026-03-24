<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from './BaseDialog.vue'
import { AlertTriangle, FileCode, Globe, FolderOpen } from 'lucide-vue-next'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 对话框标题 */
    title?: string
    /** 文件类型：code | link | directory */
    fileType?: 'code' | 'link' | 'directory'
    /** 危险操作提示 */
    dangerous?: boolean
  }>(),
  {
    title: '',
    fileType: 'link',
    dangerous: false,
  }
)

// 根据 fileType 获取消息
const message = computed(() => {
  switch (props.fileType) {
    case 'code':
      return t('dialog.openCodeFile')
    case 'directory':
      return t('dialog.openDirectory')
    default:
      return t('dialog.openFile')
  }
})

// 标题
const dialogTitle = computed(() => props.title || t('dialog.confirmTitle'))

// 按钮文本
const confirmText = computed(() => t('common.confirm'))
const cancelText = computed(() => t('common.cancel'))

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

function handleConfirm() {
  emit('confirm')
  emit('update:modelValue', false)
}

function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

function getFileIcon() {
  switch (props.fileType) {
    case 'code':
      return FileCode
    case 'directory':
      return FolderOpen
    case 'link':
    default:
      return Globe
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    :title="dialogTitle"
    width="max-w-sm"
    :show-close="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="flex gap-4">
      <!-- Icon -->
      <div
        :class="[
          'flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center',
          dangerous
            ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
        ]"
      >
        <component :is="getFileIcon()" class="w-6 h-6" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <p class="text-gray-900 dark:text-white font-medium">{{ message }}</p>
        <p
          v-if="dangerous"
          class="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
        >
          <AlertTriangle class="w-4 h-4" />
          {{ t('dialog.undoWarning') }}
        </p>
      </div>
    </div>

    <template #footer>
      <button
        class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        @click="handleCancel"
      >
        {{ cancelText }}
      </button>
      <button
        :class="[
          'px-4 py-2 rounded-md transition-colors',
          dangerous
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-indigo-600 hover:bg-indigo-700 text-white',
        ]"
        @click="handleConfirm"
      >
        {{ confirmText }}
      </button>
    </template>
  </BaseDialog>
</template>
