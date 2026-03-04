<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ArrowLeft,
  FolderPlus,
  Grid,
  List,
  Loader2,
  Folder,
  File,
  Image as ImageIcon,
  FileCode,
} from 'lucide-vue-next'
import FilePreview from './FilePreview.vue'
import CreateFolderDialog from './CreateFolderDialog.vue'
import type { FileNode } from '@/types'
import type { PreviewKind, ProjectDirectory, DirectoryType } from '@/types'

const props = defineProps<{
  currentDirPath: string
  fileTree: FileNode[]
  viewMode: 'grid' | 'list'
  selectedFile: FileNode | null
  fileContent: string
  previewKind: PreviewKind | null
  isLoadingTree: boolean
  isLoadingPreview: boolean
  boundDirs: ProjectDirectory[]
  dirTypes: DirectoryType[]
  currentNav: string
  newFolderName: string
  isCreatingFolder: boolean
}>()

const emit = defineEmits<{
  navigateToParent: []
  selectFile: [node: FileNode]
  createFolder: []
  updateViewMode: [mode: 'grid' | 'list']
  bindDirectory: []
  updateNewFolderName: [value: string]
  closeCreateFolderDialog: []
  confirmCreateFolder: []
}>()

const currentDirType = computed(() => {
  return props.dirTypes.find((t) => t.id === props.currentNav || t.kind === props.currentNav)
})

function navigateToParent() {
  emit('navigateToParent')
}

function selectFile(node: FileNode) {
  emit('selectFile', node)
}

function setViewMode(mode: 'grid' | 'list') {
  emit('updateViewMode', mode)
}

function bindDirectory() {
  emit('bindDirectory')
}

function openCreateFolderDialog() {
  emit('confirmCreateFolder') // This triggers the dialog to show via parent
}

function updateNewFolderName(value: string) {
  emit('updateNewFolderName', value)
}

function closeCreateFolderDialog() {
  emit('closeCreateFolderDialog')
}

function confirmCreateFolder() {
  emit('confirmCreateFolder')
}

function getFileIcon(node: FileNode) {
  if (node.kind === 'dir') return Folder
  const ext = node.name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return ImageIcon
  if (['md', 'txt', 'json', 'js', 'ts', 'vue', 'css', 'html'].includes(ext || '')) return FileCode
  return File
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Toolbar -->
    <div
      class="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
    >
      <div class="flex items-center gap-4">
        <!-- Bind directory if not bound -->
        <button
          v-if="boundDirs.length === 0"
          class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          @click="bindDirectory"
        >
          <FolderPlus class="w-4 h-4" />
          {{ $t('workspace.bindDirectory') }}
        </button>

        <!-- Current path -->
        <div v-if="currentDirPath" class="flex items-center gap-2">
          <button
            class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="navigateToParent"
          >
            <ArrowLeft class="w-4 h-4 text-gray-500" />
          </button>
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ currentDirPath }}</span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          @click="openCreateFolderDialog"
          :title="$t('workspace.newFolder')"
        >
          <FolderPlus class="w-5 h-5" />
        </button>
        <div class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            class="p-1.5 rounded-md transition-colors"
            :class="viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''"
            @click="setViewMode('grid')"
          >
            <Grid class="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
          <button
            class="p-1.5 rounded-md transition-colors"
            :class="viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''"
            @click="setViewMode('list')"
          >
            <List class="w-4 h-4 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </div>
    </div>

    <!-- File Browser -->
    <div class="flex-1 flex overflow-hidden">
      <!-- File List -->
      <div class="flex-1 overflow-auto p-6">
        <div v-if="isLoadingTree" class="flex items-center justify-center h-full">
          <Loader2 class="w-8 h-8 text-indigo-600 animate-spin" />
        </div>

        <div
          v-else-if="fileTree.length === 0"
          class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400"
        >
          <Folder class="w-16 h-16 mb-4 opacity-50" />
          <p class="text-lg">{{ $t('workspace.emptyDirectory') }}</p>
          <button
            class="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            @click="openCreateFolderDialog"
          >
            <FolderPlus class="w-4 h-4" />
            {{ $t('workspace.createFolder') }}
          </button>
        </div>

        <!-- Grid View -->
        <div v-else-if="viewMode === 'grid'" class="grid grid-cols-4 gap-4">
          <div
            v-for="node in fileTree"
            :key="node.path"
            class="flex flex-col items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer transition-colors"
            @click="selectFile(node)"
          >
            <component :is="getFileIcon(node)" class="w-12 h-12 text-gray-400 mb-2" />
            <span class="text-sm text-gray-900 dark:text-white text-center truncate w-full">{{
              node.name
            }}</span>
          </div>
        </div>

        <!-- List View -->
        <div v-else class="space-y-1">
          <div
            v-for="node in fileTree"
            :key="node.path"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
            @click="selectFile(node)"
          >
            <component :is="getFileIcon(node)" class="w-5 h-5 text-gray-400" />
            <span class="text-sm text-gray-900 dark:text-white flex-1">{{ node.name }}</span>
            <span class="text-xs text-gray-500">{{
              node.kind === 'dir' ? $t('workspace.folder') : $t('workspace.file')
            }}</span>
          </div>
        </div>
      </div>

      <!-- Preview Panel -->
      <FilePreview
        :selected-file="selectedFile"
        :file-content="fileContent"
        :preview-kind="previewKind"
        :is-loading-preview="isLoadingPreview"
        :current-dir-path="currentDirPath"
      />
    </div>

    <!-- Create Folder Dialog -->
    <CreateFolderDialog
      v-if="isCreatingFolder"
      :new-folder-name="newFolderName"
      @update:new-folder-name="updateNewFolderName"
      @close="closeCreateFolderDialog"
      @confirm="confirmCreateFolder"
    />
  </div>
</template>
