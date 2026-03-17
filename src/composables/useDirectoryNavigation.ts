import { ref, computed } from 'vue'
import { directoryApi, moduleApi } from './useApi'
import { moduleRegistry } from './useModuleRegistry'
import type { Directory, Module, ModuleCapability } from '@/types'

/**
 * Navigation item for directory-based navigation
 */
export interface DirectoryNavItem {
  id: string
  name: string
  icon?: string
  moduleId?: string
  moduleName?: string
  directoryCount: number
  hasChildren: boolean
}

/**
 * Composable for directory-based navigation
 */
export function useDirectoryNavigation(projectId: string) {
  const directories = ref<Directory[]>([])
  const modules = ref<Module[]>([])
  const currentDirectoryId = ref<string | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Load directories for the project
  async function loadDirectories() {
    loading.value = true
    error.value = null
    try {
      directories.value = await directoryApi.list(projectId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load directories'
    } finally {
      loading.value = false
    }
  }

  // Load available modules
  async function loadModules() {
    try {
      modules.value = await moduleApi.list()
    } catch (e) {
      console.error('Failed to load modules:', e)
    }
  }

  // Get module for a directory
  function getDirectoryModule(directory: Directory): Module | undefined {
    if (!directory.moduleId) return undefined
    return moduleRegistry.get(directory.moduleId)
  }

  // Get module capabilities for a directory
  function getDirectoryCapabilities(directory: Directory): ModuleCapability[] {
    return getDirectoryCapabilitiesFromModule(directory)
  }

  function getDirectoryCapabilitiesFromModule(directory: Directory): ModuleCapability[] {
    if (!directory.moduleId) return []
    const module = moduleRegistry.get(directory.moduleId)
    return module?.capabilities ?? []
  }

  // Navigation items computed from directories
  const navItems = computed((): DirectoryNavItem[] => {
    const items: DirectoryNavItem[] = []

    // Group directories by their module
    const moduleGroups = new Map<string, Directory[]>()

    for (const dir of directories.value) {
      const moduleId = dir.moduleId || 'no-module'
      if (!moduleGroups.has(moduleId)) {
        moduleGroups.set(moduleId, [])
      }
      moduleGroups.get(moduleId)!.push(dir)
    }

    // Add intro item first
    items.push({
      id: 'intro',
      name: 'Overview',
      icon: 'home',
      directoryCount: 0,
      hasChildren: false,
    })

    // Add items for each module group
    for (const [moduleId, dirs] of moduleGroups) {
      if (moduleId === 'no-module') {
        // Directories without modules - group them together
        items.push({
          id: 'unbound',
          name: 'Other',
          icon: 'folder',
          directoryCount: dirs.length,
          hasChildren: dirs.length > 0,
        })
      } else {
        const module = moduleRegistry.get(moduleId)
        if (module) {
          items.push({
            id: `module-${moduleId}`,
            name: module.name,
            icon: module.icon,
            moduleId,
            moduleName: module.name,
            directoryCount: dirs.length,
            hasChildren: dirs.length > 0,
          })
        }
      }
    }

    return items
  })

  // Get directories for a specific navigation item
  function getDirectoriesForNav(navId: string): Directory[] {
    if (navId === 'intro') return []
    if (navId === 'unbound') {
      return directories.value.filter((d) => !d.moduleId)
    }
    if (navId.startsWith('module-')) {
      const moduleId = navId.replace('module-', '')
      return directories.value.filter((d) => d.moduleId === moduleId)
    }
    return []
  }

  // Get current directory
  const currentDirectory = computed(() => {
    if (!currentDirectoryId.value) return null
    return directories.value.find((d) => d.id === currentDirectoryId.value) || null
  })

  // Get current module
  const currentModule = computed(() => {
    if (!currentDirectory.value?.moduleId) return null
    return moduleRegistry.get(currentDirectory.value.moduleId) || null
  })

  // Select a directory
  function selectDirectory(directoryId: string | null) {
    currentDirectoryId.value = directoryId
  }

  // Create a new directory
  async function createDirectory(input: {
    name: string
    relativePath: string
    moduleId?: string
    moduleConfig?: Record<string, unknown>
  }): Promise<Directory | null> {
    loading.value = true
    error.value = null
    try {
      const dir = await directoryApi.create(projectId, input)
      directories.value.push(dir)
      return dir
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create directory'
      return null
    } finally {
      loading.value = false
    }
  }

  // Update a directory
  async function updateDirectory(
    id: string,
    patch: { name?: string; moduleId?: string; moduleConfig?: Record<string, unknown> }
  ): Promise<Directory | null> {
    loading.value = true
    error.value = null
    try {
      const updated = await directoryApi.update(id, patch)
      const index = directories.value.findIndex((d) => d.id === id)
      if (index !== -1) {
        directories.value[index] = updated
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update directory'
      return null
    } finally {
      loading.value = false
    }
  }

  // Delete a directory
  async function deleteDirectory(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await directoryApi.delete(id)
      directories.value = directories.value.filter((d) => d.id !== id)
      if (currentDirectoryId.value === id) {
        currentDirectoryId.value = null
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete directory'
      return false
    } finally {
      loading.value = false
    }
  }

  // Enable module on a directory
  async function enableModule(
    directoryId: string,
    moduleId: string,
    config?: Record<string, unknown>
  ): Promise<Directory | null> {
    loading.value = true
    error.value = null
    try {
      const updated = await directoryApi.enableModule(directoryId, moduleId, config)
      const index = directories.value.findIndex((d) => d.id === directoryId)
      if (index !== -1) {
        directories.value[index] = updated
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to enable module'
      return null
    } finally {
      loading.value = false
    }
  }

  // Disable module on a directory
  async function disableModule(directoryId: string): Promise<Directory | null> {
    loading.value = true
    error.value = null
    try {
      const updated = await directoryApi.disableModule(directoryId)
      const index = directories.value.findIndex((d) => d.id === directoryId)
      if (index !== -1) {
        directories.value[index] = updated
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to disable module'
      return null
    } finally {
      loading.value = false
    }
  }

  // Reorder directories with timeout
  async function reorderDirectories(orderedIds: string[]): Promise<boolean> {
    // 不设置 loading 状态，避免显示 loading 提示
    error.value = null
    try {
      // Create a promise that rejects after timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 5000)
      })

      await Promise.race([directoryApi.reorder(projectId, orderedIds), timeoutPromise])

      // 更新本地目录顺序，不刷新列表
      const reorderedDirs: Directory[] = []
      for (const id of orderedIds) {
        const dir = directories.value.find((d) => d.id === id)
        if (dir) {
          reorderedDirs.push(dir)
        }
      }
      directories.value = reorderedDirs

      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to reorder directories'
      console.error('Reorder failed:', e)
      return false
    }
  }

  // Check if directory has capability
  function hasCapability(directoryId: string, capability: ModuleCapability): boolean {
    const dir = directories.value.find((d) => d.id === directoryId)
    if (!dir?.moduleId) return false
    return moduleRegistry.hasCapability(dir.moduleId, capability)
  }

  return {
    // State
    directories,
    modules,
    currentDirectoryId,
    loading,
    error,

    // Computed
    navItems,
    currentDirectory,
    currentModule,

    // Methods
    loadDirectories,
    loadModules,
    getDirectoryModule,
    getDirectoryCapabilities,
    getDirectoriesForNav,
    selectDirectory,
    createDirectory,
    updateDirectory,
    deleteDirectory,
    reorderDirectories,
    enableModule,
    disableModule,
    hasCapability,
  }
}
