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
  <div class="file-module" @click="handleClickOutside">
    <!-- Toolbar -->
    <div class="file-module__toolbar">
      <div class="file-module__toolbar-left">
        <!-- Back button -->
        <button
          v-if="currentPath"
          class="file-module__btn-icon"
          @click="navigateToParent"
          :title="$t('common.back')"
        >
          <ArrowLeft class="w-4 h-4" />
        </button>

        <!-- Current path -->
        <span v-if="currentDirPath" class="file-module__path">
          {{ currentDirPath }}
        </span>
      </div>

      <div class="file-module__toolbar-right">
        <!-- New File button -->
        <button
          class="file-module__btn-icon"
          @click="showCreateFileDialog = true"
          :title="$t('file.newFile')"
        >
          <FilePlus class="w-4 h-4" />
        </button>

        <!-- New Folder button -->
        <button
          class="file-module__btn-icon"
          @click="showCreateFolderDialog = true"
          :title="$t('workspace.newFolder')"
        >
          <FolderPlus class="w-4 h-4" />
        </button>

        <!-- View mode toggle -->
        <div class="file-module__view-toggle">
          <button
            class="file-module__view-btn"
            :class="{ 'file-module__view-btn--active': viewMode === 'grid' }"
            @click="viewMode = 'grid'"
          >
            <Grid class="w-4 h-4" />
          </button>
          <button
            class="file-module__view-btn"
            :class="{ 'file-module__view-btn--active': viewMode === 'list' }"
            @click="viewMode = 'list'"
          >
            <List class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="file-module__main">
      <!-- File Browser -->
      <div
        class="file-module__content"
        :class="{ 'file-module__content--drag-over': isDraggingOver }"
        @dragover="handleDragOver"
        @dragleave="handleDragLeave"
        @drop="handleDrop"
      >
        <!-- Loading state -->
        <div v-if="isLoadingTree" class="file-module__loading">
          <Loader2 class="w-8 h-8 animate-spin" />
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="file-module__error">
          {{ error }}
        </div>

        <!-- Empty state -->
        <div v-else-if="sortedFiles.length === 0" class="file-module__empty">
          <Folder class="w-16 h-16 opacity-50" />
          <p>{{ $t('workspace.emptyDirectory') }}</p>
          <div class="file-module__empty-actions">
            <button class="file-module__btn-primary" @click="showCreateFileDialog = true">
              <FilePlus class="w-4 h-4" />
              {{ $t('file.newFile') }}
            </button>
            <button class="file-module__btn-primary" @click="showCreateFolderDialog = true">
              <FolderPlus class="w-4 h-4" />
              {{ $t('workspace.createFolder') }}
            </button>
          </div>
        </div>

        <!-- Grid View -->
        <div v-else-if="viewMode === 'grid'" class="file-module__grid">
          <div
            v-for="node in sortedFiles"
            :key="node.path"
            class="file-module__grid-item"
            :class="{
              'file-module__grid-item--renaming': renamingNode?.path === node.path,
              'file-module__grid-item--selected':
                previewFile?.path === node.path && node.kind === 'file',
            }"
            @click="handleSingleClick(node)"
            @dblclick.stop="handleDoubleClick(node)"
            @contextmenu="showMenu($event, node)"
          >
            <!-- Rename input -->
            <input
              v-if="renamingNode?.path === node.path"
              v-model="renameValue"
              class="file-module__rename-input"
              @keyup.enter="confirmRename"
              @keyup.escape="cancelRename"
              @blur="confirmRename"
              @click.stop
              autofocus
            />
            <template v-else>
              <component :is="getFileIcon(node)" class="file-module__icon" />
              <span class="file-module__name">{{ node.name }}</span>
            </template>
          </div>
        </div>

        <!-- List View -->
        <div v-else class="file-module__list">
          <!-- Header -->
          <div class="file-module__list-header">
            <span class="file-module__list-col-name">{{ $t('file.name') }}</span>
            <span class="file-module__list-col-size">{{ $t('file.size') }}</span>
            <span class="file-module__list-col-date">{{ $t('file.modified') }}</span>
          </div>
          <!-- Items -->
          <div
            v-for="node in sortedFiles"
            :key="node.path"
            class="file-module__list-item"
            :class="{
              'file-module__list-item--renaming': renamingNode?.path === node.path,
              'file-module__list-item--selected':
                previewFile?.path === node.path && node.kind === 'file',
            }"
            @click="handleSingleClick(node)"
            @dblclick.stop="handleDoubleClick(node)"
            @contextmenu="showMenu($event, node)"
          >
            <!-- Rename input -->
            <template v-if="renamingNode?.path === node.path">
              <component :is="getFileIcon(node)" class="file-module__list-icon" />
              <input
                v-model="renameValue"
                class="file-module__rename-input"
                @keyup.enter="confirmRename"
                @keyup.escape="cancelRename"
                @blur="confirmRename"
                @click.stop
                autofocus
              />
              <span class="file-module__list-col-size">—</span>
              <span class="file-module__list-col-date">—</span>
            </template>
            <template v-else>
              <div class="file-module__list-item-main">
                <component :is="getFileIcon(node)" class="file-module__list-icon" />
                <span class="file-module__list-name">{{ node.name }}</span>
              </div>
              <span class="file-module__list-col-size">
                {{ node.kind === 'dir' ? '—' : formatFileSize((node as any).size) }}
              </span>
              <span class="file-module__list-col-date">
                {{ formatDate((node as any).modifiedAt) }}
              </span>
            </template>
          </div>
        </div>

        <!-- Drag over indicator -->
        <div v-if="isDraggingOver" class="file-module__drop-overlay">
          <div class="file-module__drop-content">
            <FilePlus class="w-12 h-12" />
            <p>{{ $t('file.dropToImport') }}</p>
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
    <div v-if="!isLoadingTree && sortedFiles.length > 0" class="file-module__footer">
      <span>{{ fileCount }} {{ $t('file.itemCount') }}</span>
    </div>

    <!-- Context Menu -->
    <div
      v-if="showContextMenu"
      class="file-module__context-menu"
      :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      @click.stop
    >
      <template v-if="contextMenuTarget?.kind === 'dir'">
        <button class="file-module__context-item" @click="openInExplorer(contextMenuTarget!)">
          <FolderOpen class="w-4 h-4" />
          {{ $t('file.openInExplorer') }}
        </button>
      </template>
      <template v-else>
        <button class="file-module__context-item" @click="openFile(contextMenuTarget!)">
          <ExternalLink class="w-4 h-4" />
          {{ $t('file.open') }}
        </button>
      </template>
      <button class="file-module__context-item" @click="startRename(contextMenuTarget!)">
        <Pencil class="w-4 h-4" />
        {{ $t('common.edit') }}
      </button>
      <button
        class="file-module__context-item file-module__context-item--danger"
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
      <div class="file-module__delete-content">
        <p>
          {{ $t('file.deleteConfirm') }}
          <strong>{{ deleteTarget?.name }}</strong
          >?
        </p>
        <p v-if="deleteTarget?.kind === 'dir'" class="file-module__delete-warning">
          {{ $t('file.deleteFolderWarning') }}
        </p>
      </div>
      <div class="file-module__delete-actions">
        <button class="file-module__btn-secondary" @click="showDeleteDialog = false">
          {{ $t('common.cancel') }}
        </button>
        <button class="file-module__btn-danger" @click="handleDelete">
          {{ $t('common.delete') }}
        </button>
      </div>
    </BaseDialog>
  </div>
</template>

<style scoped>
.file-module {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.file-module__toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: rgb(255 255 255);
  border-bottom: 1px solid rgb(229 231 239);
}

:deep(.dark) .file-module__toolbar {
  background-color: rgb(31 41 55);
  border-bottom-color: rgb(55 65 81);
}

.file-module__toolbar-left,
.file-module__toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-module__path {
  font-size: 13px;
  color: rgb(107 114 128);
  font-family: monospace;
}

:deep(.dark) .file-module__path {
  color: rgb(156 163 175);
}

.file-module__btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: rgb(107 114 128);
  transition: all 0.2s;
}

.file-module__btn-icon:hover {
  background-color: rgb(243 244 246);
  color: rgb(17 24 39);
}

:deep(.dark) .file-module__btn-icon:hover {
  background-color: rgb(55 65 81);
  color: rgb(249 250 251);
}

.file-module__view-toggle {
  display: flex;
  background-color: rgb(243 244 246);
  border-radius: 6px;
  padding: 2px;
}

:deep(.dark) .file-module__view-toggle {
  background-color: rgb(55 65 81);
}

.file-module__view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: rgb(107 114 128);
  transition: all 0.2s;
}

.file-module__view-btn--active {
  background-color: rgb(255 255 255);
  color: rgb(17 24 39);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

:deep(.dark) .file-module__view-btn--active {
  background-color: rgb(75 85 99);
  color: rgb(249 250 251);
}

.file-module__main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.file-module__content {
  flex: 1;
  overflow: auto;
  padding: 16px;
  position: relative;
}

.file-module__content--drag-over {
  background-color: rgb(239 246 255);
}

:deep(.dark) .file-module__content--drag-over {
  background-color: rgb(30 58 95);
}

.file-module__loading,
.file-module__error,
.file-module__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgb(107 114 128);
}

.file-module__error {
  color: rgb(220 38 38);
}

.file-module__empty p {
  margin-top: 12px;
  font-size: 15px;
}

.file-module__empty-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.file-module__btn-primary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: rgb(79 70 229);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-module__btn-primary:hover {
  background-color: rgb(67 56 202);
}

.file-module__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.file-module__grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-module__grid-item:hover {
  background-color: rgb(243 244 246);
}

.file-module__grid-item--selected {
  background-color: rgb(238 242 255);
}

:deep(.dark) .file-module__grid-item:hover {
  background-color: rgb(55 65 81);
}

:deep(.dark) .file-module__grid-item--selected {
  background-color: rgb(67 56 202);
}

.file-module__icon {
  width: 48px;
  height: 48px;
  color: rgb(156 163 175);
  margin-bottom: 8px;
}

.file-module__name {
  font-size: 13px;
  color: rgb(17 24 39);
  text-align: center;
  word-break: break-word;
}

:deep(.dark) .file-module__name {
  color: rgb(249 250 251);
}

.file-module__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-module__list-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: rgb(107 114 128);
  border-bottom: 1px solid rgb(229 231 239);
  margin-bottom: 4px;
}

:deep(.dark) .file-module__list-header {
  color: rgb(156 163 175);
  border-bottom-color: rgb(55 65 81);
}

.file-module__list-col-name {
  flex: 1;
}

.file-module__list-col-size {
  width: 80px;
  text-align: right;
  flex-shrink: 0;
}

.file-module__list-col-date {
  width: 100px;
  text-align: right;
  flex-shrink: 0;
}

.file-module__list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-module__list-item:hover {
  background-color: rgb(243 244 246);
}

.file-module__list-item--selected {
  background-color: rgb(238 242 255);
}

:deep(.dark) .file-module__list-item:hover {
  background-color: rgb(55 65 81);
}

:deep(.dark) .file-module__list-item--selected {
  background-color: rgb(67 56 202);
}

.file-module__list-item-main {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.file-module__list-icon {
  width: 20px;
  height: 20px;
  color: rgb(156 163 175);
  flex-shrink: 0;
}

.file-module__list-name {
  font-size: 14px;
  color: rgb(17 24 39);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.dark) .file-module__list-name {
  color: rgb(249 250 251);
}

.file-module__list-item .file-module__list-col-size,
.file-module__list-item .file-module__list-col-date {
  font-size: 13px;
  color: rgb(107 114 128);
}

:deep(.dark) .file-module__list-item .file-module__list-col-size,
:deep(.dark) .file-module__list-item .file-module__list-col-date {
  color: rgb(156 163 175);
}

.file-module__rename-input {
  flex: 1;
  padding: 4px 8px;
  border: 2px solid rgb(79 70 229);
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  background-color: rgb(255 255 255);
  color: rgb(17 24 39);
}

:deep(.dark) .file-module__rename-input {
  background-color: rgb(31 41 55);
  color: rgb(249 250 251);
}

.file-module__drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(79, 70, 229, 0.1);
  border: 2px dashed rgb(79 70 229);
  border-radius: 8px;
  pointer-events: none;
}

.file-module__drop-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgb(79 70 229);
}

.file-module__drop-content p {
  font-size: 15px;
  font-weight: 500;
}

.file-module__footer {
  display: flex;
  justify-content: flex-end;
  padding: 8px 16px;
  background-color: rgb(255 255 255);
  border-top: 1px solid rgb(229 231 239);
  font-size: 13px;
  color: rgb(107 114 128);
}

:deep(.dark) .file-module__footer {
  background-color: rgb(31 41 55);
  border-top-color: rgb(55 65 81);
  color: rgb(156 163 175);
}

.file-module__context-menu {
  position: fixed;
  background-color: rgb(255 255 255);
  border: 1px solid rgb(229 231 239);
  border-radius: 8px;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  padding: 4px;
  z-index: 1000;
  min-width: 160px;
}

:deep(.dark) .file-module__context-menu {
  background-color: rgb(31 41 55);
  border-color: rgb(55 65 81);
}

.file-module__context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 4px;
  font-size: 13px;
  color: rgb(17 24 39);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s;
}

.file-module__context-item:hover {
  background-color: rgb(243 244 246);
}

:deep(.dark) .file-module__context-item {
  color: rgb(249 250 251);
}

:deep(.dark) .file-module__context-item:hover {
  background-color: rgb(55 65 81);
}

.file-module__context-item--danger {
  color: rgb(220 38 38);
}

.file-module__context-item--danger:hover {
  background-color: rgb(254 242 242);
}

:deep(.dark) .file-module__context-item--danger:hover {
  background-color: rgb(127 29 29);
}

.file-module__delete-content {
  padding: 16px;
}

.file-module__delete-content p {
  color: rgb(17 24 39);
  margin: 0;
}

:deep(.dark) .file-module__delete-content p {
  color: rgb(249 250 251);
}

.file-module__delete-warning {
  margin-top: 8px;
  font-size: 13px;
  color: rgb(220 38 38);
}

.file-module__delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgb(229 231 239);
}

:deep(.dark) .file-module__delete-actions {
  border-top-color: rgb(55 65 81);
}

.file-module__btn-secondary {
  padding: 8px 16px;
  background-color: rgb(243 244 246);
  color: rgb(17 24 39);
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-module__btn-secondary:hover {
  background-color: rgb(229 231 239);
}

:deep(.dark) .file-module__btn-secondary {
  background-color: rgb(55 65 81);
  color: rgb(249 250 251);
}

:deep(.dark) .file-module__btn-secondary:hover {
  background-color: rgb(75 85 99);
}

.file-module__btn-danger {
  padding: 8px 16px;
  background-color: rgb(220 38 38);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.file-module__btn-danger:hover {
  background-color: rgb(185 28 28);
}
</style>
