<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ArrowLeft,
  FolderPlus,
  FilePlus,
  Grid,
  List,
  Loader2,
  Folder,
  File,
  Image as ImageIcon,
  FileCode,
  FolderOpen,
  Trash2,
  Pencil,
  ExternalLink,
  X,
} from 'lucide-vue-next'
import type { Directory, FileNode, PreviewKind } from '@/types'
import { fsApi, previewApi } from '@/composables/useApi'
import CreateFolderDialog from '@/components/workspace/CreateFolderDialog.vue'
import CreateFileDialog from './CreateFileDialog.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import FilePreview from '@/components/workspace/FilePreview.vue'

const { t } = useI18n()

interface Props {
  directory: Directory
  /** The project root path - required for file operations */
  projectPath: string
}

const props = defineProps<Props>()

// Helper: get full absolute path for a file/folder
// relativePath is relative to the current directory (after normalization)
function getFullPath(relativePath: string): string {
  if (props.directory.relativePath) {
    const base = props.projectPath + '/' + props.directory.relativePath
    if (currentPath.value) {
      return base + '/' + currentPath.value + '/' + relativePath
    }
    return base + '/' + relativePath
  }
  // No directory.relativePath, use project root directly
  if (currentPath.value) {
    return props.projectPath + '/' + currentPath.value + '/' + relativePath
  }
  return props.projectPath + '/' + relativePath
}

// State
const fileTree = ref<FileNode[]>([])
const currentPath = ref('')
const isLoadingTree = ref(false)
const error = ref('')

// View mode
const viewMode = ref<'grid' | 'list'>('grid')

// Preview state
const previewFile = ref<FileNode | null>(null)
const previewContent = ref('')
const previewKind = ref<PreviewKind | null>(null)
const isLoadingPreview = ref(false)

// Dialog states
const showCreateFolderDialog = ref(false)
const showCreateFileDialog = ref(false)
const newFolderName = ref('')
const newFileName = ref('')

// Rename state
const renamingNode = ref<FileNode | null>(null)
const renameValue = ref('')

// Delete confirmation
const showDeleteDialog = ref(false)
const deleteTarget = ref<FileNode | null>(null)

// Context menu
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuTarget = ref<FileNode | null>(null)

// Drag and drop
const isDraggingOver = ref(false)

// Computed: current directory path
const currentDirPath = computed(() => {
  if (!props.directory.relativePath) return ''
  return props.directory.relativePath + (currentPath.value ? '/' + currentPath.value : '')
})

// File count for current directory
const fileCount = computed(() => {
  const count = sortedFiles.value.length
  return count
})

// Normalize node.path to be relative to MODULE root, not project root.
// The API returns paths relative to the project root, so we strip the
// currentDirPath prefix to get module-relative paths.
function normalizeNodePath(node: FileNode, prefix: string): FileNode {
  let normalizedPath: string
  if (!prefix) {
    normalizedPath = node.path
  } else {
    const prefixWithSlash = prefix + '/'
    normalizedPath = node.path.startsWith(prefixWithSlash)
      ? node.path.substring(prefixWithSlash.length)
      : node.path
  }
  return {
    ...node,
    path: normalizedPath,
    children: node.children?.map((child) => normalizeNodePath(child, prefix)),
  }
}

// Sort files: folders first, then alphabetically
const sortedFiles = computed(() => {
  return [...fileTree.value].sort((a, b) => {
    if (a.kind === 'dir' && b.kind !== 'dir') return -1
    if (a.kind !== 'dir' && b.kind === 'dir') return 1
    return a.name.localeCompare(b.name)
  })
})

// Get file icon
function getFileIcon(node: FileNode) {
  if (node.kind === 'dir') return Folder
  const ext = node.name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return ImageIcon
  if (['md', 'txt', 'json', 'js', 'ts', 'vue', 'css', 'html', 'py', 'rs'].includes(ext || ''))
    return FileCode
  return File
}

// Format file size
function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === 0) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

// Format date
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    return '—'
  }
}

// Load file tree
async function loadFileTree() {
  if (!props.directory.projectId) return

  isLoadingTree.value = true
  error.value = ''

  try {
    const tree = await fsApi.tree(props.directory.projectId, currentDirPath.value)
    // Normalize paths to be relative to module root (not project root)
    fileTree.value = (tree.children || []).map((child) =>
      normalizeNodePath(child, currentDirPath.value)
    )
  } catch (e: any) {
    error.value = e.message || 'Failed to load files'
    fileTree.value = []
  } finally {
    isLoadingTree.value = false
  }
}

// Navigate to parent folder
function navigateToParent() {
  if (!currentPath.value) return
  const parts = currentPath.value.split('/')
  parts.pop()
  currentPath.value = parts.join('/')
}

// Navigate into folder
function navigateIntoFolder(node: FileNode) {
  if (node.kind !== 'dir') return
  currentPath.value = node.path
  // Clear preview when navigating
  previewFile.value = null
}

// Open file with system default app
async function openFile(node: FileNode) {
  if (node.kind !== 'file') return
  try {
    const fullPath = getFullPath(node.path)
    await fsApi.openExternal(fullPath)
  } catch (e) {
    console.error('Failed to open file:', e)
  }
}

// Open folder in file explorer
async function openInExplorer(node: FileNode) {
  if (node.kind !== 'dir') return
  try {
    const fullPath = getFullPath(node.path)
    await fsApi.openExternal(fullPath)
  } catch (e) {
    console.error('Failed to open in explorer:', e)
  }
}

// Single click - preview file
async function handleSingleClick(node: FileNode) {
  if (node.kind === 'dir') return
  previewFile.value = node
}

// Load preview content
async function loadPreviewContent(node: FileNode) {
  if (node.kind !== 'file') {
    previewContent.value = ''
    previewKind.value = null
    return
  }

  isLoadingPreview.value = true
  try {
    const fullPath = getFullPath(node.path)

    // Detect preview kind
    try {
      const kindResult = await previewApi.detect(fullPath)
      previewKind.value = kindResult.kind
    } catch {
      previewKind.value = null
    }

    // Load content for text-based previews
    if (previewKind.value === 'markdown' || previewKind.value === 'text') {
      try {
        const result = await fsApi.readText(fullPath)
        previewContent.value = result.content
      } catch {
        previewContent.value = ''
      }
    } else {
      previewContent.value = ''
    }
  } catch (e) {
    console.error('Failed to load preview:', e)
    previewContent.value = ''
    previewKind.value = null
  } finally {
    isLoadingPreview.value = false
  }
}

// Watch preview file changes
watch(previewFile, (newFile) => {
  if (newFile) {
    loadPreviewContent(newFile)
  } else {
    previewContent.value = ''
    previewKind.value = null
  }
})

// Close preview
function closePreview() {
  previewFile.value = null
}

// Create folder
async function handleCreateFolder() {
  if (!props.directory.projectId || !newFolderName.value.trim()) return

  const folderPath = currentDirPath.value
    ? currentDirPath.value + '/' + newFolderName.value.trim()
    : newFolderName.value.trim()

  try {
    await fsApi.createDir(props.directory.projectId, folderPath)
    showCreateFolderDialog.value = false
    newFolderName.value = ''
    await loadFileTree()
  } catch (e: any) {
    error.value = e.message || 'Failed to create folder'
  }
}

// Create file
async function handleCreateFile() {
  if (!props.directory.projectId || !newFileName.value.trim()) return

  const filePath = currentDirPath.value
    ? currentDirPath.value + '/' + newFileName.value.trim()
    : newFileName.value.trim()

  try {
    await fsApi.createFile(props.directory.projectId, filePath)
    showCreateFileDialog.value = false
    newFileName.value = ''
    await loadFileTree()
  } catch (e: any) {
    error.value = e.message || 'Failed to create file'
  }
}

// Start rename
function startRename(node: FileNode) {
  renamingNode.value = node
  renameValue.value = node.name
  showContextMenu.value = false
}

// Confirm rename
async function confirmRename() {
  if (!renamingNode.value || !renameValue.value.trim()) {
    renamingNode.value = null
    return
  }

  const oldPath = getFullPath(renamingNode.value.path)
  const newPath = currentDirPath.value
    ? props.projectPath + '/' + currentDirPath.value + '/' + renameValue.value.trim()
    : props.projectPath + '/' + renameValue.value.trim()

  try {
    await fsApi.rename(oldPath, newPath)
    renamingNode.value = null
    renameValue.value = ''
    await loadFileTree()
  } catch (e: any) {
    error.value = e.message || 'Failed to rename'
  }
}

// Cancel rename
function cancelRename() {
  renamingNode.value = null
  renameValue.value = ''
}

// Show delete confirmation
function showDeleteConfirm(node: FileNode) {
  deleteTarget.value = node
  showDeleteDialog.value = true
  showContextMenu.value = false
}

// Delete file/folder
async function handleDelete() {
  if (!deleteTarget.value) return

  const fullPath = getFullPath(deleteTarget.value.path)
  const deletedPath = deleteTarget.value.path

  try {
    await fsApi.delete(fullPath)
    showDeleteDialog.value = false
    deleteTarget.value = null
    // Clear preview if deleted file was being previewed
    if (previewFile.value?.path === deletedPath) {
      previewFile.value = null
    }
    await loadFileTree()
  } catch (e: any) {
    error.value = e.message || 'Failed to delete'
  }
}

// Context menu
function showMenu(event: MouseEvent, node: FileNode) {
  event.preventDefault()
  contextMenuTarget.value = node
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  showContextMenu.value = true
}

function closeContextMenu() {
  showContextMenu.value = false
  contextMenuTarget.value = null
}

// Click outside to close context menu
function handleClickOutside() {
  if (showContextMenu.value) {
    closeContextMenu()
  }
}

// Drag and drop handlers
function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDraggingOver.value = true
}

function handleDragLeave() {
  isDraggingOver.value = false
}

async function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDraggingOver.value = false

  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    // In Tauri, we need to handle file paths from drag and drop
    // The file.path property contains the absolute path
    const sourcePath = (file as any).path || file.name

    if (sourcePath && sourcePath !== file.name) {
      const targetPath =
        (currentDirPath.value
          ? props.directory.projectId + '/' + currentDirPath.value + '/'
          : props.directory.projectId + '/') + file.name

      try {
        await fsApi.copyFile(sourcePath, targetPath, false)
      } catch (e: any) {
        if (e.message?.includes('目标文件已存在')) {
          // File exists, try with overwrite
          try {
            await fsApi.copyFile(sourcePath, targetPath, true)
          } catch (e2) {
            console.error('Failed to copy file (overwrite):', e2)
          }
        } else {
          console.error('Failed to copy file:', e)
        }
      }
    }
  }

  await loadFileTree()
}

// Double click handler - opens file or navigates into folder
function handleDoubleClick(node: FileNode) {
  if (node.kind === 'dir') {
    navigateIntoFolder(node)
  } else {
    openFile(node)
  }
}

// Load on mount
onMounted(() => {
  loadFileTree()
})

// Reload when directory or path changes
watch([() => props.directory.id, () => currentPath.value], () => {
  loadFileTree()
})
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden" @click="handleClickOutside">
    <!-- Toolbar -->
    <div class="flex justify-between items-center px-4 py-3 bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div class="flex items-center gap-2">
        <!-- Back button -->
        <button
          v-if="currentPath"
          class="flex items-center justify-center w-8 h-8 text-gray-500 bg-transparent border-none rounded-md cursor-pointer transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          @click="navigateToParent"
          :title="$t('common.back')"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>

        <!-- Current path -->
        <span v-if="currentDirPath" class="text-[13px] text-gray-500 font-mono dark:text-gray-400">
          {{ currentDirPath }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <!-- New File button -->
        <button
          class="flex items-center justify-center w-8 h-8 text-gray-500 bg-transparent border-none rounded-md cursor-pointer transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          @click="showCreateFileDialog = true"
          :title="$t('file.newFile')"
        >
          <FilePlus class="w-4 h-4" />
        </button>

        <!-- New Folder button -->
        <button
          class="flex items-center justify-center w-8 h-8 text-gray-500 bg-transparent border-none rounded-md cursor-pointer transition-all hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-100"
          @click="showCreateFolderDialog = true"
          :title="$t('workspace.newFolder')"
        >
          <FolderPlus class="w-4 h-4" />
        </button>

        <!-- View mode toggle -->
        <div class="flex bg-gray-100 rounded-md p-0.5 dark:bg-gray-700">
          <button
            class="flex items-center justify-center w-7 h-7 border-none rounded cursor-pointer transition-all"
            :class="viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white' : 'text-gray-500 bg-transparent'"
            @click="viewMode = 'grid'"
          >
            <Grid class="w-4 h-4" />
          </button>
          <button
            class="flex items-center justify-center w-7 h-7 border-none rounded cursor-pointer transition-all"
            :class="viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white' : 'text-gray-500 bg-transparent'"
            @click="viewMode = 'list'"
          >
            <List class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- File Browser -->
      <div
        class="flex-1 overflow-auto p-4 relative"
        :class="{ 'bg-blue-50 dark:bg-blue-950': isDraggingOver }"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <!-- Loading state -->
        <div v-if="isLoadingTree" class="flex items-center justify-center h-full">
          <Loader2 class="w-8 h-8 animate-spin" />
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="flex items-center justify-center h-full text-red-500">
          {{ error }}
        </div>

        <!-- Empty state -->
        <div v-else-if="sortedFiles.length === 0" class="flex flex-col items-center justify-center h-full text-gray-500">
          <Folder class="w-16 h-16 opacity-50" />
          <p class="mt-3 text-[15px]">{{ $t('workspace.emptyDirectory') }}</p>
          <div class="flex gap-3 mt-4">
            <button class="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-indigo-600 border-none rounded-lg cursor-pointer transition-colors hover:bg-indigo-700" @click="showCreateFileDialog = true">
              <FilePlus class="w-4 h-4" />
              {{ $t('file.newFile') }}
            </button>
            <button class="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-white bg-indigo-600 border-none rounded-lg cursor-pointer transition-colors hover:bg-indigo-700" @click="showCreateFolderDialog = true">
              <FolderPlus class="w-4 h-4" />
              {{ $t('workspace.createFolder') }}
            </button>
          </div>
        </div>

        <!-- Grid View -->
        <div v-else-if="viewMode === 'grid'" class="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
          <div
            v-for="node in sortedFiles"
            :key="node.path"
            class="flex flex-col items-center p-4 rounded-lg cursor-pointer transition-colors"
            :class="{
              'bg-indigo-100 dark:bg-indigo-900': renamingNode?.path === node.path,
              'bg-blue-50 dark:bg-indigo-900/50': previewFile?.path === node.path && node.kind === 'file',
              'hover:bg-gray-100 dark:hover:bg-gray-700': !(previewFile?.path === node.path && node.kind === 'file') && renamingNode?.path !== node.path,
            }"
            @click="handleSingleClick(node)"
            @dblclick.stop="handleDoubleClick(node)"
            @contextmenu="showMenu($event, node)"
          >
            <!-- Rename input -->
            <input
              v-if="renamingNode?.path === node.path"
              v-model="renameValue"
              class="flex-1 px-1 py-0.5 text-sm border-2 border-indigo-500 rounded outline-none bg-white dark:bg-gray-800 dark:text-white"
              @keyup.enter="confirmRename"
              @keyup.escape="cancelRename"
              @blur="confirmRename"
              @click.stop
              autofocus
            />
            <template v-else>
              <component :is="getFileIcon(node)" class="w-12 h-12 text-gray-400 mb-2" />
              <span class="text-[13px] text-gray-900 text-center break-words dark:text-gray-100">{{ node.name }}</span>
            </template>
          </div>
        </div>

        <!-- List View -->
        <div v-else class="flex flex-col gap-1">
          <!-- Header -->
          <div class="flex items-center gap-3 px-3 py-2 text-[12px] font-medium text-gray-500 border-b border-gray-200 mb-1 dark:text-gray-400 dark:border-gray-700">
            <span class="flex-1">{{ $t('file.name') }}</span>
            <span class="w-20 text-right">{{ $t('file.size') }}</span>
            <span class="w-24 text-right">{{ $t('file.modified') }}</span>
          </div>
          <!-- Items -->
          <div
            v-for="node in sortedFiles"
            :key="node.path"
            class="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors"
            :class="{
              'bg-indigo-100 dark:bg-indigo-900': renamingNode?.path === node.path,
              'bg-blue-50 dark:bg-indigo-900/50': previewFile?.path === node.path && node.kind === 'file',
              'hover:bg-gray-100 dark:hover:bg-gray-700': !(previewFile?.path === node.path && node.kind === 'file') && renamingNode?.path !== node.path,
            }"
            @click="handleSingleClick(node)"
            @dblclick.stop="handleDoubleClick(node)"
            @contextmenu="showMenu($event, node)"
          >
            <!-- Rename input -->
            <template v-if="renamingNode?.path === node.path">
              <component :is="getFileIcon(node)" class="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                v-model="renameValue"
                class="flex-1 px-1 py-0.5 text-sm border-2 border-indigo-500 rounded outline-none bg-white dark:bg-gray-800 dark:text-white"
                @keyup.enter="confirmRename"
                @keyup.escape="cancelRename"
                @blur="confirmRename"
                @click.stop
                autofocus
              />
              <span class="w-20 text-right text-[13px] text-gray-400">—</span>
              <span class="w-24 text-right text-[13px] text-gray-400">—</span>
            </template>
            <template v-else>
              <div class="flex-1 flex items-center gap-3 min-w-0">
                <component :is="getFileIcon(node)" class="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span class="text-sm text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap dark:text-gray-100">{{ node.name }}</span>
              </div>
              <span class="w-20 text-right text-[13px] text-gray-500 dark:text-gray-400">
                {{ node.kind === 'dir' ? '—' : formatFileSize((node as any).size) }}
              </span>
              <span class="w-24 text-right text-[13px] text-gray-500 dark:text-gray-400">
                {{ formatDate((node as any).modifiedAt) }}
              </span>
            </template>
          </div>
        </div>

        <!-- Drag over indicator -->
        <div v-if="isDraggingOver" class="absolute inset-0 flex items-center justify-center bg-indigo-500/10 border-2 border-dashed border-indigo-500 rounded-lg pointer-events-none">
          <div class="flex flex-col items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <FilePlus class="w-12 h-12" />
            <p class="text-[15px] font-medium">{{ $t('file.dropToImport') }}</p>
          </div>
        </div>
      </div>

      <!-- Preview Panel -->
      <FilePreview
        v-if="previewFile"
        :selected-file="previewFile"
        :file-content="previewContent"
        :preview-kind="previewKind"
        :is-loading-preview="isLoadingPreview"
        :current-dir-path="currentDirPath"
        @close="closePreview"
      />
    </div>

    <!-- Footer with file count -->
    <div v-if="!isLoadingTree && sortedFiles.length > 0" class="flex justify-end px-4 py-2 bg-white border-t border-gray-200 text-[13px] text-gray-500 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
      <span>{{ fileCount }} {{ $t('file.itemCount') }}</span>
    </div>

    <!-- Context Menu -->
    <div
      v-if="showContextMenu"
      class="fixed bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-[1000] min-w-[160px] dark:bg-gray-800 dark:border-gray-700"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
    >
      <template v-if="contextMenuTarget?.kind === 'dir'">
        <button class="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-gray-900 bg-transparent border-none rounded cursor-pointer transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700" @click="openInExplorer(contextMenuTarget!)">
          <FolderOpen class="w-4 h-4" />
          {{ $t('file.openInExplorer') }}
        </button>
      </template>
      <template v-else>
        <button class="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-gray-900 bg-transparent border-none rounded cursor-pointer transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700" @click="openFile(contextMenuTarget!)">
          <ExternalLink class="w-4 h-4" />
          {{ $t('file.open') }}
        </button>
      </template>
      <button class="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-gray-900 bg-transparent border-none rounded cursor-pointer transition-colors hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700" @click="startRename(contextMenuTarget!)">
        <Pencil class="w-4 h-4" />
        {{ $t('common.edit') }}
      </button>
      <button
        class="flex items-center gap-2 w-full px-3 py-2 text-[13px] text-red-600 bg-transparent border-none rounded cursor-pointer transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900"
        @click="showDeleteConfirm(contextMenuTarget!)"
      >
        <Trash2 class="w-4 h-4" />
        {{ $t('common.delete') }}
      </button>
    </div>

    <!-- Create Folder Dialog -->
    <CreateFolderDialog
      v-if="showCreateFolderDialog"
      :new-folder-name="newFolderName"
      @update:newFolderName="newFolderName = $event"
      @close="showCreateFolderDialog = false"
      @confirm="handleCreateFolder"
    />

    <!-- Create File Dialog -->
    <CreateFileDialog
      v-if="showCreateFileDialog"
      :new-file-name="newFileName"
      @update:newFileName="newFileName = $event"
      @close="showCreateFileDialog = false"
      @confirm="handleCreateFile"
    />

    <!-- Delete Confirmation Dialog -->
    <BaseDialog
      v-model="showDeleteDialog"
      :title="$t('common.delete')"
      @close="showDeleteDialog = false"
    >
      <div class="p-4">
        <p class="text-gray-900 dark:text-gray-100 m-0">
          {{ $t('file.deleteConfirm') }}
          <strong>{{ deleteTarget?.name }}</strong
          >?
        </p>
        <p v-if="deleteTarget?.kind === 'dir'" class="mt-2 text-[13px] text-red-500">
          {{ $t('file.deleteFolderWarning') }}
        </p>
      </div>
      <div class="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <button class="px-4 py-2 text-[13px] text-gray-700 bg-gray-100 border-none rounded-md cursor-pointer transition-colors hover:bg-gray-200 dark:text-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600" @click="showDeleteDialog = false">
          {{ $t('common.cancel') }}
        </button>
        <button class="px-4 py-2 text-[13px] font-medium text-white bg-red-500 border-none rounded-md cursor-pointer transition-colors hover:bg-red-600" @click="handleDelete">
          {{ $t('common.delete') }}
        </button>
      </div>
    </BaseDialog>
  </div>
</template>
