<script setup lang="ts">
import { ref, watch } from 'vue'
import type { GitRepository } from '@/types'

const props = defineProps<{
  repo: GitRepository | null
  editRepoName: string
  editRepoDescription: string
  isUpdating: boolean
}>()

const emit = defineEmits<{
  'update:editRepoName': [value: string]
  'update:editRepoDescription': [value: string]
  close: []
  confirm: []
}>()

// Local error state for this dialog only
const localError = ref('')

// Watch for repo changes and clear error when dialog opens
watch(
  () => props.repo,
  () => {
    if (props.repo) {
      localError.value = ''
    }
  }
)

function close() {
  localError.value = ''
  emit('close')
}

function confirm() {
  emit('confirm')
}

defineExpose({
  setLocalError,
  clearLocalError,
})

function setLocalError(error: string) {
  localError.value = error
}

function clearLocalError() {
  localError.value = ''
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="close">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
      <div class="p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {{ $t('workspace.editRepo') }}
        </h3>

        <div class="space-y-4">
          <!-- Git URL (Read-only) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('workspace.repoUrl') }}
            </label>
            <input
              :value="repo?.remoteUrl || '-'"
              type="text"
              readonly
              class="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('workspace.repoName') }}
            </label>
            <input
              :value="editRepoName"
              type="text"
              class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              :placeholder="$t('workspace.repoNamePlaceholder')"
              @input="emit('update:editRepoName', ($event.target as HTMLInputElement).value)"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ $t('workspace.repoNameEditHint') }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('workspace.description') }}
            </label>
            <textarea
              :value="editRepoDescription"
              rows="3"
              class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
              :placeholder="$t('workspace.descriptionPlaceholder')"
              @input="
                emit('update:editRepoDescription', ($event.target as HTMLTextAreaElement).value)
              "
            ></textarea>
          </div>

          <div
            v-if="localError"
            class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p class="text-sm text-red-600 dark:text-red-400">
              {{ localError }}
            </p>
          </div>
        </div>
      </div>

      <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-xl">
        <button
          class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          @click="close"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
          @click="confirm"
          :disabled="isUpdating"
        >
          {{ $t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>
