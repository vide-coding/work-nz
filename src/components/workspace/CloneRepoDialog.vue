<script setup lang="ts">
const props = defineProps<{
  cloneUrl: string
  cloneTargetDir: string
  cloneRepoName: string
  isCloning: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:cloneUrl': [value: string]
  'update:cloneTargetDir': [value: string]
  'update:cloneRepoName': [value: string]
  close: []
  confirm: []
}>()

function close() {
  emit('close')
}

function confirm() {
  emit('confirm')
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="close">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
      <div class="p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {{ $t('workspace.cloneRepo') }}
        </h3>

        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('workspace.repoUrl') }}
            </label>
            <input
              :value="cloneUrl"
              type="text"
              class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder="https://github.com/..."
              @input="emit('update:cloneUrl', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('workspace.targetDir') }}
            </label>
            <input
              :value="cloneTargetDir"
              type="text"
              class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              placeholder="my-repo"
              @input="emit('update:cloneTargetDir', ($event.target as HTMLInputElement).value)"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {{ $t('workspace.repoName') }}
            </label>
            <input
              :value="cloneRepoName"
              type="text"
              class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              :placeholder="cloneTargetDir || $t('workspace.repoNamePlaceholder')"
              @input="emit('update:cloneRepoName', ($event.target as HTMLInputElement).value)"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {{ $t('workspace.repoNameHint') }}
            </p>
          </div>

          <div
            v-if="error"
            class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p class="text-sm text-red-600 dark:text-red-400">
              {{ error }}
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
          :disabled="!cloneUrl.trim() || !cloneTargetDir.trim() || isCloning"
        >
          {{ isCloning ? $t('common.cloning') : $t('workspace.clone') }}
        </button>
      </div>
    </div>
  </div>
</template>
