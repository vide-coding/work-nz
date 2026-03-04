<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import type { FileNode } from '@/types'
import type { PreviewKind } from '@/types'

const props = defineProps<{
  selectedFile: FileNode | null
  fileContent: string
  previewKind: PreviewKind | null
  isLoadingPreview: boolean
  currentDirPath: string
}>()
</script>

<template>
  <aside
    v-if="selectedFile"
    class="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-auto"
  >
    <div class="p-4">
      <div class="flex items-center gap-3 mb-4">
        <component :is="getFileIcon(selectedFile)" class="w-8 h-8 text-gray-400" />
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-900 dark:text-white truncate">
            {{ selectedFile.name }}
          </p>
          <p class="text-xs text-gray-500">
            {{ selectedFile.kind === 'dir' ? $t('workspace.folder') : $t('workspace.file') }}
          </p>
        </div>
      </div>

      <!-- Preview Content -->
      <div v-if="isLoadingPreview" class="flex items-center justify-center py-8">
        <Loader2 class="w-6 h-6 text-indigo-600 animate-spin" />
      </div>

      <div v-else-if="previewKind === 'image'" class="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
        <p class="text-sm text-gray-500 text-center">
          {{ $t('workspace.imagePreview') }}
        </p>
      </div>

      <!-- Markdown Preview -->
      <div v-else-if="previewKind === 'markdown'" class="prose dark:prose-invert max-w-none">
        <MarkdownRenderer :content="fileContent" :base-path="currentDirPath" />
      </div>

      <!-- Text Preview -->
      <div v-else-if="previewKind === 'text'" class="prose dark:prose-invert max-w-none">
        <pre
          class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96"
          >{{ fileContent }}</pre
        >
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>{{ $t('workspace.noPreview') }}</p>
      </div>
    </div>
  </aside>
</template>

<script lang="ts">
import { Folder, File, Image as ImageIcon, FileCode } from 'lucide-vue-next'

function getFileIcon(node: FileNode) {
  if (node.kind === 'dir') return Folder
  const ext = node.name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return ImageIcon
  if (['md', 'txt', 'json', 'js', 'ts', 'vue', 'css', 'html'].includes(ext || '')) return FileCode
  return File
}
</script>
