<script setup lang="ts">
const props = defineProps<{
  newFolderName: string
}>()

const emit = defineEmits<{
  'update:newFolderName': [value: string]
  close: []
  confirm: []
}>()

function close() {
  emit('close')
}

function confirm() {
  emit('confirm')
}

function handleKeyup(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    confirm()
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="close">
    <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4">
      <div class="p-6">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {{ $t('workspace.createFolder') }}
        </h3>
        <input
          :value="newFolderName"
          type="text"
          class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
          :placeholder="$t('workspace.folderName')"
          @input="emit('update:newFolderName', ($event.target as HTMLInputElement).value)"
          @keyup="handleKeyup"
        />
      </div>
      <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-xl">
        <button
          class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          @click="close"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          @click="confirm"
          :disabled="!newFolderName.trim()"
        >
          {{ $t('common.create') }}
        </button>
      </div>
    </div>
  </div>
</template>
