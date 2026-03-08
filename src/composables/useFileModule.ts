import { ref, computed } from 'vue'
import { fsApi, previewApi } from './useApi'
import { directoryHasCapability } from './useModuleRegistry'
import type { Directory, FileNode, PreviewKind } from '@/types'

/**
 * File entry with metadata
 */
export interface FileEntry {
  path: string
  name: string
  kind: 'file' | 'dir'
  size?: number
  modifiedAt?: string
  extension?: string
}

/**
 * View mode for file listing
 */
export type ViewMode = 'list' | 'grid'

/**
 * Sort field for file listing
 */
export type SortField = 'name' | 'size' | 'date'

/**
 * File module configuration
 */
export interface FileModuleConfig {
  defaultViewMode: ViewMode
  showHiddenFiles: boolean
  defaultSortOrder: SortField
  fileTypeFilters: string[]
}

/**
 * Composable for File module operations on a directory
 */
export function useFileModule(directory: Directory) {
  const files = ref<FileEntry[]>([])
  const currentPath = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)
  const viewMode = ref<ViewMode>('list')
  const sortField = ref<SortField>('name')
  const sortDirection = ref<'asc' | 'desc'>('asc')
  const searchQuery = ref('')
  const expandedDirs = ref<Set<string>>(new Set())
  const selectedFile = ref<string | null>(null)

  // Get module config
  const moduleConfig = computed(() => directory.moduleConfig as FileModuleConfig | undefined)

  // Check if directory has file capabilities
  const hasFileCapability = computed(() => directoryHasCapability(directory, 'file.browse'))

  // Check if directory has file read capability
  const hasReadCapability = computed(() => directoryHasCapability(directory, 'file.read'))

  // Check if directory has file preview capability
  const hasPreviewCapability = computed(() => directoryHasCapability(directory, 'file.preview'))

  // Check if directory has file search capability
  const hasSearchCapability = computed(() => directoryHasCapability(directory, 'file.search'))

  // Filter to show/hide hidden files
  const showHiddenFiles = computed(() => moduleConfig.value?.showHiddenFiles ?? false)

  // File type filters
  const fileTypeFilters = computed(() => moduleConfig.value?.fileTypeFilters ?? [])

  // Filtered and sorted files
  const filteredFiles = computed(() => {
    let result = [...files.value]

    // Filter hidden files
    if (!showHiddenFiles.value) {
      result = result.filter((f) => !f.name.startsWith('.'))
    }

    // Filter by file type
    if (fileTypeFilters.value.length > 0) {
      result = result.filter((f) => {
        if (f.kind === 'dir') return true
        if (!f.extension) return true
        return fileTypeFilters.value.includes(f.extension)
      })
    }

    // Filter by search query
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter((f) => f.name.toLowerCase().includes(query))
    }

    // Sort
    result.sort((a, b) => {
      // Directories first
      if (a.kind !== b.kind) {
        return a.kind === 'dir' ? -1 : 1
      }

      let comparison = 0
      switch (sortField.value) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = (a.size || 0) - (b.size || 0)
          break
        case 'date':
          comparison = (a.modifiedAt || '').localeCompare(b.modifiedAt || '')
          break
      }
      return sortDirection.value === 'asc' ? comparison : -comparison
    })

    return result
  })

  // Breadcrumb path segments
  const breadcrumbs = computed(() => {
    if (!currentPath.value) return []
    const segments = currentPath.value.split('/').filter(Boolean)
    return segments.map((segment, index) => ({
      name: segment,
      path: segments.slice(0, index + 1).join('/'),
    }))
  })

  // Load files for the directory
  async function loadFiles(path: string = '') {
    if (!hasFileCapability.value) {
      error.value = 'File module not enabled for this directory'
      return
    }

    loading.value = true
    error.value = null
    currentPath.value = path

    try {
      // TODO: Replace with actual API call when backend implements directory-specific file listing
      // For now, we'll simulate with the project-level tree API
      const tree = await fsApi.tree(directory.projectId, path)
      files.value = flattenTree(tree, path)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load files'
    } finally {
      loading.value = false
    }
  }

  // Flatten tree to file entries
  function flattenTree(node: FileNode, basePath: string): FileEntry[] {
    const result: FileEntry[] = []
    const fullPath = basePath ? `${basePath}/${node.name}` : node.name

    if (node.kind === 'dir') {
      result.push({
        path: fullPath,
        name: node.name,
        kind: 'dir',
      })
      if (node.children) {
        for (const child of node.children) {
          result.push(...flattenTree(child, fullPath))
        }
      }
    } else {
      result.push({
        path: fullPath,
        name: node.name,
        kind: 'file',
        extension: node.name.includes('.') ? node.name.split('.').pop() : undefined,
      })
    }

    return result
  }

  // Navigate to a path
  async function navigateTo(path: string) {
    await loadFiles(path)
  }

  // Navigate to parent directory
  async function navigateUp() {
    const segments = currentPath.value.split('/').filter(Boolean)
    segments.pop()
    await loadFiles(segments.join('/'))
  }

  // Toggle directory expansion
  function toggleDir(path: string) {
    if (expandedDirs.value.has(path)) {
      expandedDirs.value.delete(path)
    } else {
      expandedDirs.value.add(path)
    }
  }

  // Check if directory is expanded
  function isDirExpanded(path: string): boolean {
    return expandedDirs.value.has(path)
  }

  // Select a file
  function selectFile(path: string | null) {
    selectedFile.value = path
  }

  // Set view mode
  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
  }

  // Set sort field
  function setSort(field: SortField) {
    if (sortField.value === field) {
      // Toggle direction if same field
      sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDirection.value = 'asc'
    }
  }

  // Set search query
  function setSearch(query: string) {
    searchQuery.value = query
  }

  // Clear search
  function clearSearch() {
    searchQuery.value = ''
  }

  // Create a new directory
  async function createDirectory(name: string): Promise<boolean> {
    if (!directoryHasCapability(directory, 'file.create')) {
      error.value = 'File creation not enabled for this directory'
      return false
    }

    loading.value = true
    error.value = null
    try {
      const fullPath = directory.relativePath
        ? `${directory.relativePath}/${currentPath.value}/${name}`
        : `${currentPath.value}/${name}`

      const result = await fsApi.createDir(fullPath)
      if (result.ok) {
        await loadFiles(currentPath.value)
        return true
      }
      error.value = result.message || 'Failed to create directory'
      return false
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create directory'
      return false
    } finally {
      loading.value = false
    }
  }

  // Delete a file or directory
  async function deleteFile(path: string): Promise<boolean> {
    const capability = path.endsWith('/') ? 'file.delete' : 'file.delete'
    if (!directoryHasCapability(directory, capability)) {
      error.value = 'File deletion not enabled for this directory'
      return false
    }

    loading.value = true
    error.value = null
    try {
      const fullPath = directory.relativePath ? `${directory.relativePath}/${path}` : path

      const result = await fsApi.delete(fullPath)
      if (result.ok) {
        await loadFiles(currentPath.value)
        return true
      }
      error.value = result.message || 'Failed to delete'
      return false
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete'
      return false
    } finally {
      loading.value = false
    }
  }

  // Rename a file or directory
  async function renameFile(oldPath: string, newName: string): Promise<boolean> {
    if (!directoryHasCapability(directory, 'file.rename')) {
      error.value = 'File rename not enabled for this directory'
      return false
    }

    loading.value = true
    error.value = null
    try {
      const basePath = directory.relativePath || ''
      const oldFullPath = basePath ? `${basePath}/${oldPath}` : oldPath

      // Construct new path
      const pathParts = oldPath.split('/')
      pathParts[pathParts.length - 1] = newName
      const newPath = pathParts.join('/')
      const newFullPath = basePath ? `${basePath}/${newPath}` : newPath

      const result = await fsApi.rename(oldFullPath, newFullPath)
      if (result.ok) {
        await loadFiles(currentPath.value)
        return true
      }
      error.value = result.message || 'Failed to rename'
      return false
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to rename'
      return false
    } finally {
      loading.value = false
    }
  }

  // Get file preview kind
  async function getPreviewKind(path: string): Promise<PreviewKind | null> {
    if (!hasPreviewCapability.value) {
      return null
    }

    try {
      const fullPath = directory.relativePath ? `${directory.relativePath}/${path}` : path

      const result = await previewApi.detect(fullPath)
      return result.kind
    } catch {
      return null
    }
  }

  // Read file content
  async function readFileContent(path: string): Promise<string | null> {
    if (!hasReadCapability.value) {
      error.value = 'File read not enabled for this directory'
      return null
    }

    loading.value = true
    error.value = null
    try {
      const fullPath = directory.relativePath ? `${directory.relativePath}/${path}` : path

      const result = await fsApi.readText(fullPath)
      return result.content
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to read file'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    files: filteredFiles,
    allFiles: files,
    currentPath,
    loading,
    error,
    viewMode,
    sortField,
    sortDirection,
    searchQuery,
    selectedFile,

    // Computed
    hasFileCapability,
    hasReadCapability,
    hasPreviewCapability,
    hasSearchCapability,
    showHiddenFiles,
    fileTypeFilters,
    breadcrumbs,

    // Actions
    loadFiles,
    navigateTo,
    navigateUp,
    toggleDir,
    isDirExpanded,
    selectFile,
    setViewMode,
    setSort,
    setSearch,
    clearSearch,
    createDirectory,
    deleteFile,
    renameFile,
    getPreviewKind,
    readFileContent,
  }
}
