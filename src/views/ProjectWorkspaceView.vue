<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import draggable from 'vuedraggable'
import { useLocale } from '@/locales/useLocale'
import {
  projectApi,
  gitApi,
  fsApi,
  dirTypeApi,
  ideApi,
  workspaceApi,
  previewApi,
} from '@/composables/useApi'
import { useDirectoryNavigation, type DirectoryNavItem } from '@/composables/useDirectoryNavigation'
import { moduleRegistry } from '@/composables/useModuleRegistry'
import type {
  Project,
  GitRepository,
  GitRepoStatus,
  FileNode,
  DirectoryType,
  ProjectDirectory,
  WorkspaceSettings,
  PreviewKind,
  WorkspaceInfo,
  Directory,
} from '@/types'
import {
  Home,
  Code,
  FileText,
  Image,
  Map,
  Folder,
  GitBranch,
  CheckSquare,
  Files,
  GripVertical,
} from 'lucide-vue-next'
import { debounce } from '@/composables/useDebounce'

// Components
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader.vue'
import WorkspaceSidebar from '@/components/workspace/WorkspaceSidebar.vue'
import ProjectIntro from '@/components/workspace/ProjectIntro.vue'
import CodeRepositories from '@/components/workspace/CodeRepositories.vue'
import FileBrowser from '@/components/workspace/FileBrowser.vue'
import ReadmePreview from '@/components/workspace/ReadmePreview.vue'
import ModuleContentArea from '@/components/module/ModuleContentArea.vue'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const route = useRoute()
const { locale, changeLocale } = useLocale()

// Type-safe theme mode for ThemeToggle (only used in template)
const themeMode = computed(() => {
  const mode = settings.value.themeMode
  return mode === 'custom' ? 'system' : mode
})

// Type-safe locale for LanguageSelector (only used in template)
const currentLocale = computed(() => locale.value as 'zh-CN' | 'en-US')

// === New Module System Only ===
const projectId = computed(() => props.id || (route.params.id as string))

// Initialize directory navigation with new module system
const {
  directories,
  navItems: moduleNavItems,
  currentDirectory,
  currentModule,
  loading: dirLoading,
  error: dirError,
  loadDirectories,
  createDirectory,
  selectDirectory,
  enableModule,
  disableModule,
  reorderDirectories,
} = useDirectoryNavigation(projectId.value)

// Get icon for module type
function getModuleIcon(moduleKey?: string) {
  switch (moduleKey) {
    case 'git':
      return GitBranch
    case 'task':
      return CheckSquare
    case 'file':
      return Files
    default:
      return Folder
  }
}

// Go to home page (ProjectIntro)
function goToHome() {
  selectDirectory(null)
}

// Show module-based directory list (always use new system)
const showModuleNav = computed(() => true)

// Navigation (legacy - kept for compatibility)
type NavItem = 'intro' | 'code' | 'docs' | 'ui_design' | 'project_planning' | string
const currentNav = ref<NavItem>('intro')

// State
const project = ref<Project | null>(null)
const settings = ref<WorkspaceSettings>({ themeMode: 'system' })
const loading = ref(false)
const error = ref('')
const isEditing = ref(false)
const editDescription = ref('')
const currentWorkspace = ref<WorkspaceInfo | null>(null)

// 获取工作区显示名称
const workspaceDisplayName = computed(() => {
  if (!currentWorkspace.value) return null
  return (
    currentWorkspace.value.alias ||
    currentWorkspace.value.path.split(/[\\/]/).pop() ||
    currentWorkspace.value.path
  )
})

// 更新窗口标题
async function updateWindowTitle(title: string | null) {
  try {
    const window = getCurrentWindow()
    if (title) {
      await window.setTitle(title)
    } else {
      await window.setTitle('Vibe Kanban')
    }
  } catch (e) {
    console.error('Failed to update window title:', e)
  }
}

// 监听当前工作区变化，更新窗口标题（避免使用 immediate 导致的初始化问题）
watch(workspaceDisplayName, (name) => {
  updateWindowTitle(name)
})

// Git repos
const repos = ref<GitRepository[]>([])
const repoStatuses = ref<Record<string, GitRepoStatus>>({})

// Repo README preview
const selectedRepo = ref<GitRepository | null>(null)
const readmeContent = ref('')
const isLoadingReadme = ref(false)

// Directory types
const dirTypes = ref<DirectoryType[]>([])
const projectDirs = ref<ProjectDirectory[]>([])

// File browser
const currentDirPath = ref('')
const fileTree = ref<FileNode[]>([])
const viewMode = ref<'grid' | 'list'>('grid')
const selectedFile = ref<FileNode | null>(null)
const fileContent = ref('')
const previewKind = ref<PreviewKind | null>(null)
const isLoadingTree = ref(false)
const isLoadingPreview = ref(false)

// Create folder dialog
const isCreatingFolder = ref(false)
const newFolderName = ref('')

// Clone dialog
const showCloneDialog = ref(false)
const isCloning = ref(false)
const cloneUrl = ref('')
const cloneTargetDir = ref('')
const cloneRepoName = ref('')

// Edit repo dialog
const showEditRepoDialog = ref(false)
const editingRepo = ref<GitRepository | null>(null)
const editRepoName = ref('')
const editRepoDescription = ref('')
const isUpdatingRepo = ref(false)

// Navigation items (legacy fallback)
const navItems = computed(() => {
  const items = [
    { id: 'intro', labelKey: 'workspace.projectIntro', icon: Home },
    { id: 'code', labelKey: 'workspace.code', icon: Code },
    { id: 'docs', labelKey: 'workspace.docs', icon: FileText },
    { id: 'ui_design', labelKey: 'workspace.uiDesign', icon: Image },
    { id: 'project_planning', labelKey: 'workspace.projectPlanning', icon: Map },
  ]

  // Add custom directory types
  const customTypes = dirTypes.value.filter((t) => t.kind === 'custom')
  customTypes.forEach((t) => {
    items.push({ id: t.id, labelKey: t.name, icon: Folder })
  })

  return items
})

// Methods
async function loadProject() {
  try {
    loading.value = true
    error.value = ''
    project.value = await projectApi.get(projectId.value)
    editDescription.value = project.value.description || ''
  } catch (e: any) {
    error.value = e.message || String(e)
  } finally {
    loading.value = false
  }
}

async function loadSettings() {
  try {
    settings.value = await workspaceApi.getSettings()
    applyTheme(settings.value.themeMode)
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
}

async function loadCurrentWorkspace() {
  try {
    currentWorkspace.value = await workspaceApi.getCurrent()
  } catch (e) {
    console.error('Failed to load current workspace:', e)
  }
}

async function loadDirTypes() {
  try {
    dirTypes.value = await dirTypeApi.list()
  } catch (e) {
    console.error('Failed to load directory types:', e)
  }
}

async function loadProjectDirs() {
  try {
    projectDirs.value = await dirTypeApi.listProjectDirs(projectId.value)
  } catch (e) {
    console.error('Failed to load project directories:', e)
  }
}

async function loadRepos() {
  try {
    // 进入代码仓库页时，自动扫描并同步不存在的目录
    await dirTypeApi.syncAuto(projectId.value)
    // 重新加载项目目录列表
    await loadProjectDirs()

    repos.value = await gitApi.repoList(projectId.value)
    // Load status for each repo in parallel
    const statuses: Record<string, GitRepoStatus> = {}
    await Promise.all(
      repos.value.map(async (repo) => {
        try {
          const status = await gitApi.repoStatusGet(repo.id)
          statuses[repo.id] = status
        } catch (e) {
          console.error('Failed to get repo status:', e)
        }
      })
    )
    repoStatuses.value = statuses
  } catch (e) {
    console.error('Failed to load repos:', e)
  }
}

// Auto extract repo name from URL when clone URL changes (debounced to avoid too many API calls)
const debouncedExtractRepoName = debounce(async (newUrl: string) => {
  if (newUrl && !cloneTargetDir.value) {
    try {
      const name = await gitApi.extractRepoName(newUrl)
      if (name) {
        cloneTargetDir.value = name
        // Also set repo name if empty
        if (!cloneRepoName.value) {
          cloneRepoName.value = name
        }
      }
    } catch (e) {
      console.error('Failed to extract repo name:', e)
    }
  }
}, 300)

watch(cloneUrl, (newUrl) => {
  if (newUrl) {
    debouncedExtractRepoName(newUrl)
  }
})

// Auto update repo name when target dir changes (if repo name is empty)
watch(cloneTargetDir, (newDir) => {
  if (newDir && !cloneRepoName.value) {
    cloneRepoName.value = newDir
  }
})

async function cloneRepo() {
  if (!cloneUrl.value.trim() || !cloneTargetDir.value.trim()) return

  try {
    isCloning.value = true
    error.value = ''
    const repo = await gitApi.repoClone(projectId.value, {
      remoteUrl: cloneUrl.value.trim(),
      targetDirName: cloneTargetDir.value.trim(),
      name: cloneRepoName.value.trim() || undefined,
    })
    repos.value.push(repo)
    cloneUrl.value = ''
    cloneTargetDir.value = ''
    cloneRepoName.value = ''
    showCloneDialog.value = false
  } catch (e: any) {
    error.value = e.message || String(e)
  } finally {
    isCloning.value = false
  }
}

// Local error state for edit repo dialog
const editRepoError = ref('')

async function updateRepo() {
  if (!editingRepo.value) return

  try {
    isUpdatingRepo.value = true
    editRepoError.value = ''
    const updated = await gitApi.repoUpdate(editingRepo.value.id, {
      name: editRepoName.value.trim() || undefined,
      description: editRepoDescription.value.trim() || undefined,
    })

    // Update in local list
    const index = repos.value.findIndex((r) => r.id === updated.id)
    if (index !== -1) {
      repos.value[index] = updated
    }

    showEditRepoDialog.value = false
    editingRepo.value = null
  } catch (e: any) {
    editRepoError.value = e.message || String(e)
  } finally {
    isUpdatingRepo.value = false
  }
}

// Load README for selected repo
async function loadRepoReadme(repo: GitRepository) {
  selectedRepo.value = repo
  readmeContent.value = ''
  isLoadingReadme.value = true

  try {
    // Try to read README.md from repo path
    const readmePath = repo.path + '/README.md'
    const result = await fsApi.readText(readmePath)
    readmeContent.value = result.content
    previewKind.value = 'markdown'
  } catch (e) {
    // Try lowercase readme.md
    try {
      const readmePath = repo.path + '/readme.md'
      const result = await fsApi.readText(readmePath)
      readmeContent.value = result.content
      previewKind.value = 'markdown'
    } catch {
      readmeContent.value = ''
      previewKind.value = null
    }
  } finally {
    isLoadingReadme.value = false
  }
}

function closeReadmePreview() {
  selectedRepo.value = null
  readmeContent.value = ''
  previewKind.value = null
}

async function pullRepo(repo: GitRepository) {
  try {
    const result = await gitApi.repoPull(repo.id)
    if (result.ok) {
      await loadRepos()
    } else {
      error.value = result.message || 'Pull failed'
    }
  } catch (e: any) {
    error.value = e.message || String(e)
  }
}

async function openInIde(repo: GitRepository) {
  try {
    await ideApi.openRepo(repo.id, project.value?.ideOverride || settings.value.defaultIde)
  } catch (e: any) {
    error.value = e.message || String(e)
  }
}

async function deleteRepo(_repo: GitRepository) {
  if (
    !confirm(
      locale.value === 'zh-CN'
        ? '确定删除此仓库吗？'
        : 'Are you sure you want to delete this repository?'
    )
  ) {
    return
  }

  try {
    // Note: Backend should have a delete repo method
    await loadRepos()
  } catch (e: any) {
    error.value = e.message || String(e)
  }
}

async function updateProject() {
  if (!project.value) return

  try {
    const updated = await projectApi.update(projectId.value, {
      description: editDescription.value,
    })
    // 使用后端返回的完整数据更新前端状态
    project.value = updated
    isEditing.value = false
  } catch (e: any) {
    error.value = e.message || String(e)
  }
}

async function bindDirectory() {
  // Old bindDirectory function - not used with new module system
  // TODO: Remove or refactor for new directory system
}

async function loadFileTree(relativePath: string) {
  try {
    isLoadingTree.value = true
    currentDirPath.value = relativePath
    const tree = await fsApi.tree(projectId.value, relativePath)
    fileTree.value = tree.children || []
    selectedFile.value = null
    fileContent.value = ''
  } catch (e: any) {
    // Directory might not exist yet
    fileTree.value = []
    currentDirPath.value = relativePath
  } finally {
    isLoadingTree.value = false
  }
}

async function selectFile(node: FileNode) {
  if (node.kind === 'dir') {
    await loadFileTree(currentDirPath.value + '/' + node.name)
    return
  }

  selectedFile.value = node
  isLoadingPreview.value = true

  try {
    // Detect preview kind
    const fullPath = currentDirPath.value + '/' + node.name
    const detected = await previewApi.detect(fullPath)
    previewKind.value = detected.kind

    // Load content if text/markdown
    if (detected.kind === 'text' || detected.kind === 'markdown') {
      const result = await fsApi.readText(fullPath)
      fileContent.value = result.content
    } else {
      fileContent.value = ''
    }
  } catch (e) {
    console.error('Failed to load file preview:', e)
    fileContent.value = ''
    previewKind.value = null
  } finally {
    isLoadingPreview.value = false
  }
}

async function createFolder() {
  if (!newFolderName.value.trim()) return

  try {
    const fullPath = currentDirPath.value + '/' + newFolderName.value.trim()
    await fsApi.createDir(fullPath)
    await loadFileTree(currentDirPath.value)
    newFolderName.value = ''
    isCreatingFolder.value = false
  } catch (e: any) {
    error.value = e.message || String(e)
  }
}

function navigateToParent() {
  const parts = currentDirPath.value.split('/')
  if (parts.length > 1) {
    parts.pop()
    loadFileTree(parts.join('/'))
  }
}

function applyTheme(themeMode: string) {
  const root = document.documentElement
  if (themeMode === 'dark') {
    root.classList.add('dark')
  } else if (themeMode === 'light') {
    root.classList.remove('dark')
  } else if (themeMode === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}

async function updateTheme(themeMode: 'light' | 'dark' | 'system' | 'custom') {
  try {
    settings.value = await workspaceApi.updateSettings({ themeMode })
    applyTheme(themeMode)
  } catch (e) {
    console.error('Failed to update theme:', e)
  }
}

function goToSettings() {
  router.push('/settings/workspace')
}

// Header events
function handleGoBack() {
  router.push('/projects')
}

function handleGoToSettings() {
  goToSettings()
}

function handleUpdateTheme(themeMode: 'light' | 'dark' | 'system' | 'custom') {
  updateTheme(themeMode)
}

function handleUpdateLocale(newLocale: 'zh-CN' | 'en-US') {
  changeLocale(newLocale)
}

// ProjectIntro events
function handleStartEdit() {
  isEditing.value = true
}

function handleCancelEdit() {
  isEditing.value = false
}

function handleSaveProject() {
  updateProject()
}

function handleUpdateDescription(value: string) {
  editDescription.value = value
}

// FileBrowser events
function handleNavigateToParent() {
  navigateToParent()
}

function handleSelectFile(node: FileNode) {
  selectFile(node)
}

function handleCreateFolder() {
  createFolder()
}

function handleUpdateViewMode(mode: 'grid' | 'list') {
  viewMode.value = mode
}

function handleBindDirectory() {
  bindDirectory()
}

function handleUpdateNewFolderName(value: string) {
  newFolderName.value = value
}

function handleCloseCreateFolderDialog() {
  isCreatingFolder.value = false
}

function handleConfirmCreateFolder() {
  isCreatingFolder.value = true
  if (newFolderName.value.trim()) {
    createFolder()
  }
}

// Create new directory with module (new module system)
async function handleCreateModuleDirectory() {
  const name = prompt('Enter directory name:')
  if (!name) return

  const moduleId = prompt('Enter module type (git, task, file):')
  if (!moduleId) return

  const validModules = ['git', 'task', 'file']
  if (!validModules.includes(moduleId)) {
    alert('Invalid module type. Use: git, task, or file')
    return
  }

  const result = await createDirectory({
    name,
    relativePath: name.toLowerCase().replace(/\s+/g, '-'),
    moduleId: `builtin:${moduleId}`,
  })

  if (result) {
    selectDirectory(result.id)
  }
}

// Handle directory reorder (drag and drop)
const draggedDirectories = ref<Directory[]>([])

// One-time sync when directories first load
let hasInitialized = false
watch(
  directories,
  (newDirs) => {
    if (!hasInitialized && newDirs.length > 0) {
      draggedDirectories.value = [...newDirs]
      hasInitialized = true
    }
  },
  { immediate: true }
)

// Handle drag events
let reorderTimeout: ReturnType<typeof setTimeout> | null = null

function onDragStart() {
  console.log(
    'Drag started, current order:',
    draggedDirectories.value.map((d) => d.name)
  )
}

function onDragChange(evt: any) {
  console.log('Drag CHANGE event:', evt)
  console.log(
    'After change, draggedDirectories:',
    draggedDirectories.value.map((d) => d.name)
  )
}

function onDragUpdate(evt: any) {
  console.log('Drag UPDATE event:', evt)
  console.log(
    'After update, draggedDirectories:',
    draggedDirectories.value.map((d) => d.name)
  )
}

function onModelValueUpdate(newList: Directory[]) {
  console.log(
    'Model value updated:',
    newList.map((d) => d.name)
  )
  draggedDirectories.value = newList
}

function onDragEnd() {
  console.log(
    'Drag ended, NEW order:',
    draggedDirectories.value.map((d) => d.name)
  )

  if (reorderTimeout) return

  // Wait for drag animation to complete (200ms)
  reorderTimeout = setTimeout(async () => {
    reorderTimeout = null
    try {
      const orderedIds = draggedDirectories.value.map((dir) => dir.id)
      console.log('Saving order:', orderedIds)
      const reordered = await reorderDirectories(orderedIds)
      console.log('Reorder result:', reordered)
      // 不刷新列表，保持当前排序状态
    } catch (e) {
      console.error('Failed to reorder directories:', e)
    }
  }, 250)
}

// Lifecycle
onMounted(async () => {
  await loadSettings()
  await loadCurrentWorkspace()
  // 延迟更新窗口标题，避免初始化时的性能问题
  nextTick(() => {
    updateWindowTitle(workspaceDisplayName.value)
  })
  await loadProject()
  await loadDirTypes()
  await loadProjectDirs()
  await loadRepos()

  // Load new module-based directories
  await loadDirectories()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <WorkspaceHeader
      :project="project"
      :settings="settings"
      :locale="locale"
      @go-back="handleGoBack"
      @go-to-settings="handleGoToSettings"
      @update-theme="handleUpdateTheme"
      @update-locale="handleUpdateLocale"
    />

    <!-- Main Content - New Module System Only -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Directory Sidebar -->
      <div
        class="w-72 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-white dark:bg-gray-900"
      >
        <!-- Project Header -->
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2
            class="text-lg font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            @click="goToHome"
          >
            {{ project?.name || 'Project' }}
          </h2>
        </div>

        <!-- Directories List -->
        <div class="flex-1 overflow-y-auto p-4">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Directories</h3>
            <button
              class="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              @click="handleCreateModuleDirectory"
            >
              + Add
            </button>
          </div>

          <!-- Loading State -->
          <div v-if="dirLoading" class="text-center py-4 text-gray-500">Loading...</div>

          <!-- Error State -->
          <div v-else-if="dirError" class="text-center py-4 text-red-500">
            {{ dirError }}
          </div>

          <!-- Directories -->
          <draggable
            :model-value="draggedDirectories"
            @update:model-value="onModelValueUpdate"
            item-key="id"
            group="directories"
            ghost-class="opacity-50"
            animation="200"
            force-fallback="true"
            handle=".drag-handle"
            @start="onDragStart"
            @end="onDragEnd"
          >
            <template #item="{ element: dir }">
              <div
                :class="[
                  'p-3 rounded-lg cursor-pointer transition-all select-none',
                  currentDirectory?.id === dir.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 shadow-sm'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-transparent',
                ]"
                @click="selectDirectory(dir.id)"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="drag-handle w-5 h-5 flex items-center justify-center cursor-grab active:cursor-grabbing flex-shrink-0"
                  >
                    <GripVertical class="w-4 h-4 text-gray-400 pointer-events-none" />
                  </div>
                  <component
                    :is="getModuleIcon(dir.moduleId)"
                    class="w-5 h-5 text-gray-500 flex-shrink-0"
                  />
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900 dark:text-white truncate">
                      {{ dir.name }}
                    </div>
                    <div v-if="dir.moduleId" class="text-xs text-gray-500">
                      {{ moduleRegistry.get(dir.moduleId)?.name }}
                    </div>
                    <div v-else class="text-xs text-gray-400">No module</div>
                  </div>
                </div>
              </div>
            </template>
          </draggable>

          <!-- Empty State -->
          <div v-if="directories.length === 0" class="text-center py-8">
            <Folder class="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p class="text-gray-500 text-sm mb-4">No directories yet</p>
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              @click="handleCreateModuleDirectory"
            >
              Create First Directory
            </button>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 overflow-hidden bg-white dark:bg-gray-800">
        <!-- Show ProjectIntro as home page when no directory is selected -->
        <ProjectIntro
          v-if="!currentDirectory"
          :project="project"
          :directories="directories"
          :repos="repos"
          :is-editing="isEditing"
          :edit-description="editDescription"
          @start-edit="handleStartEdit"
          @cancel-edit="handleCancelEdit"
          @save-project="handleSaveProject"
          @update-description="handleUpdateDescription"
        />
        <ModuleContentArea v-else :directory="currentDirectory" />
      </div>
    </div>
  </div>
</template>
