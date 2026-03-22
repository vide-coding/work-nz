<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { BUILTIN_MODULES } from '@/composables/useModuleRegistry'
import { GitBranch, CheckSquare, Files } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [data: { name: string; moduleId: string }]
}>()

const name = ref('')
const selectedModuleId = ref('builtin:git')

const isValid = computed(() => name.value.trim().length > 0)

function handleClose() {
  emit('update:modelValue', false)
}

function handleConfirm() {
  if (!isValid.value) return

  emit('confirm', {
    name: name.value.trim(),
    moduleId: selectedModuleId.value,
  })

  // Reset form
  name.value = ''
  selectedModuleId.value = 'builtin:git'
}

function handleKeyup(event: KeyboardEvent) {
  if (event.key === 'Enter' && isValid.value) {
    handleConfirm()
  }
}

// Get module info for display
const modules = computed(() => {
  return BUILTIN_MODULES.map((mod) => ({
    id: mod.id,
    key: mod.key,
    name: mod.name,
    description: mod.description,
    icon: getModuleIcon(mod.key),
  }))
})

function getModuleIcon(key: string) {
  switch (key) {
    case 'git':
      return GitBranch
    case 'task':
      return CheckSquare
    case 'file':
      return Files
    default:
      return Files
  }
}
</script>

<template>
  <BaseDialog
    :model-value="modelValue"
    :title="t('workspace.createDirectory')"
    width="max-w-md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <!-- Directory Name -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {{ t('workspace.directoryName') }}
        </label>
        <input
          v-model="name"
          type="text"
          class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          :placeholder="t('workspace.directoryNamePlaceholder')"
          @keyup="handleKeyup"
          autofocus
        />
      </div>

      <!-- Module Type Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {{ t('workspace.moduleType') }}
        </label>
        <div class="space-y-2">
          <label
            v-for="mod in modules"
            :key="mod.id"
            class="flex items-start p-3 rounded-lg border cursor-pointer transition-colors"
            :class="[
              selectedModuleId === mod.id
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
            ]"
          >
            <input
              v-model="selectedModuleId"
              type="radio"
              :value="mod.id"
              class="mt-0.5 w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
            />
            <div class="ml-3">
              <div class="flex items-center gap-2">
                <component :is="mod.icon" class="w-4 h-4 text-gray-500" />
                <span class="font-medium text-gray-900 dark:text-white">{{ mod.name }}</span>
              </div>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {{ mod.description }}
              </p>
            </div>
          </label>
        </div>
      </div>
    </div>

    <template #footer>
      <button
        class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        @click="handleClose"
      >
        {{ t('common.cancel') }}
      </button>
      <button
        class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!isValid"
        @click="handleConfirm"
      >
        {{ t('common.create') }}
      </button>
    </template>
  </BaseDialog>
</template>
