<script setup lang="ts">
import { Loader2, FileText, X } from 'lucide-vue-next'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import type { GitRepository } from '@/types'

const props = defineProps<{
  selectedRepo: GitRepository | null
  readmeContent: string
  isLoadingReadme: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function close() {
  emit('close')
}
</script>

<template>
  <aside
    v-if="selectedRepo"
    class="w-96 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-auto"
  >
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <FileText class="w-5 h-5 text-gray-500" />
          <span class="font-medium text-gray-900 dark:text-white"> README </span>
        </div>
        <button
          class="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          @click="close"
        >
          <X class="w-5 h-5 text-gray-500" />
        </button>
      </div>
      <p class="text-sm text-gray-500 mt-1">
        {{ selectedRepo.name }}
      </p>
    </div>

    <div class="p-4">
      <div v-if="isLoadingReadme" class="flex items-center justify-center py-8">
        <Loader2 class="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
      <div v-else-if="readmeContent" class="prose dark:prose-invert max-w-none">
        <MarkdownRenderer :content="readmeContent" :base-path="selectedRepo?.path" />
      </div>
      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
        <FileText class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No README found</p>
      </div>
    </div>
  </aside>
</template>
