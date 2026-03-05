<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
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
} from '@/types'
import { Home, Code, FileText, Image, Map, Folder } from 'lucide-vue-next'

// Components
import WorkspaceHeader from '@/components/workspace/WorkspaceHeader.vue'
import WorkspaceSidebar from '@/components/workspace/WorkspaceSidebar.vue'
import ProjectIntro from '@/components/workspace/ProjectIntro.vue'
import CodeRepositories from '@/components/workspace/CodeRepositories.vue'
import FileBrowser from '@/components/workspace/FileBrowser.vue'
import ReadmePreview from '@/components/workspace/ReadmePreview.vue'

const props = defineProps<{
  id: string
}>()

const router = useRouter()
const route = useRoute()
const { locale, changeLocale } = useLocale()

// Type-safe theme mode for ThemeToggle
const themeMode = computed(() => {
  const mode = settings.value.themeMode
  return mode === 'custom' ? 'system' : mode
})

// Type-safe locale for LanguageSelector
const currentLocale = computed(() => locale.value as 'zh-CN' | 'en-US')

// Navigation
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

// 监听当前工作区变化，更新窗口标题
watch(
  workspaceDisplayName,
  (name) => {
    updateWindowTitle(name)
  },
  { immediate: true }
)

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

// Repo search
const repoSearchQuery = ref('')

// Initialize project ID from props
const projectId = computed(() => props.id || (route.params.id as string))

// Navigation items
const navItems = computed(() => {
  const items = [
    { id: 'intro', labelKey: 'workspace.projectIntro', icon: Home },
    { id: 'code', labelKey: 'workspace.code', icon: Code },
    { id: 'docs', labelKey: 'workspace.docs', icon: FileText },
    { id: 'ui_design', labelKey: 'workspace.uiDesign', icon: Image },
    {
      id: 'project_planning',
      labelKey: 'workspace.projectPlanning',
      icon: Map,
    },
  ]

  // Add custom directory types
  const customTypes = dirTypes.value.filter((t) => t.kind === 'custom')
  customTypes.forEach((t) => {
    items.push({ id: t.id, labelKey: t.name, icon: Folder })
  })

  return items
})

// Computed
const currentDirType = computed(() => {
  return dirTypes.value.find((t) => t.id === currentNav.value || t.kind === currentNav.value)
})

const boundDirs = computed(() => {
  return projectDirs.value.filter((pd) => {
    const dt = dirTypes.value.find((d) => d.id === pd.dirTypeId)
    return dt && (dt.kind === currentNav.value || dt.id === currentNav.value)
  })
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
    // Load status for each repo
    const statuses: Record<string, GitRepoStatus> = {}
    for (const repo of repos.value) {
      try {
        const status = await gitApi.repoStatusGet(repo.id)
        statuses[repo.id] = status
      } catch (e) {
        console.error('Failed to get repo status:', e)
      }
    }
    repoStatuses.value = statuses
  } catch (e) {
    console.error('Failed to load repos:', e)
  }
}

// Auto extract repo name from URL when clone URL changes
watch(cloneUrl, async (newUrl) => {
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

async function updateRepo() {
  if (!editingRepo.value) return

  try {
    isUpdatingRepo.value = true
    error.value = ''
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
    error.value = e.message || String(e)
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
    await projectApi.update(projectId.value, {
      description: editDescription.value,
    })
    project.value.description = editDescription.value
    isEditing.value = false
  } catch (e: any) {
    error.value = e.message || String(e)
  }
}

async function bindDirectory() {
  try {
    if (!currentDirType.value) return

    const dirPath = currentDirType.value.kind + 's'
    await dirTypeApi.createOrUpdateProjectDir(projectId.value, {
      dirTypeId: currentDirType.value.id,
      relativePath: dirPath,
    })
    await loadProjectDirs()
    await loadFileTree(dirPath)
  } catch (e: any) {
    error.value = e.message || String(e)
  }
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

function handleUpdateLocale(newLocale: string) {
  changeLocale(newLocale)
}

// Sidebar events
function handleNavigate(id: string) {
  currentNav.value = id
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

// Watch navigation changes
watch(currentNav, async (newNav) => {
  // Close README preview when switching away from code tab
  if (newNav !== 'code') {
    selectedRepo.value = null
    readmeContent.value = ''
    previewKind.value = null
  }

  if (newNav === 'intro') {
    await loadProject()
  } else if (newNav === 'code') {
    await loadRepos()
  } else {
    // Resource directory
    const dt = dirTypes.value.find((t) => t.id === newNav || t.kind === newNav)
    if (dt) {
      const pd = projectDirs.value.find((p) => p.dirTypeId === dt.id)
      if (pd) {
        await loadFileTree(pd.relativePath)
      }
    }
  }
})

// Lifecycle
onMounted(async () => {
  await loadSettings()
  await loadCurrentWorkspace()
  await loadProject()
  await loadDirTypes()
  await loadProjectDirs()
  await loadRepos()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
    <!-- Header -->
    <WorkspaceHeader
      :project="project"
      :settings="settings"
      :workspace-info="currentWorkspace"
      :locale="locale"
      @go-back="handleGoBack"
      @go-to-settings="handleGoToSettings"
      @update-theme="handleUpdateTheme"
      @update-locale="handleUpdateLocale"
    />

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <WorkspaceSidebar
        :current-nav="currentNav"
        :nav-items="navItems"
        @navigate="handleNavigate"
      />

      <!-- Content Area -->
      <main class="flex-1 overflow-auto">
        <!-- Project Introduction -->
        <ProjectIntro
          v-if="currentNav === 'intro'"
          :project="project"
          :repos="repos"
          :project-dirs="projectDirs"
          :dir-types="dirTypes"
          :is-editing="isEditing"
          :edit-description="editDescription"
          @start-edit="handleStartEdit"
          @cancel-edit="handleCancelEdit"
          @save-project="handleSaveProject"
          @update-description="handleUpdateDescription"
        />

        <!-- Code Management -->
        <CodeRepositories
          v-else-if="currentNav === 'code'"
          :repos="repos"
          :repo-statuses="repoStatuses"
          :error="error"
          @clone-repo="cloneRepo"
          @update-repo="updateRepo"
          @pull-repo="pullRepo"
          @open-in-ide="openInIde"
          @delete-repo="deleteRepo"
          @load-readme="loadRepoReadme"
        />

        <!-- Resource Directory (Docs, UI Design, Project Planning) -->
        <FileBrowser
          v-else
          :current-dir-path="currentDirPath"
          :file-tree="fileTree"
          :view-mode="viewMode"
          :selected-file="selectedFile"
          :file-content="fileContent"
          :preview-kind="previewKind"
          :is-loading-tree="isLoadingTree"
          :is-loading-preview="isLoadingPreview"
          :bound-dirs="boundDirs"
          :dir-types="dirTypes"
          :current-nav="currentNav"
          :new-folder-name="newFolderName"
          :is-creating-folder="isCreatingFolder"
          @navigate-to-parent="handleNavigateToParent"
          @select-file="handleSelectFile"
          @create-folder="handleCreateFolder"
          @update-view-mode="handleUpdateViewMode"
          @bind-directory="handleBindDirectory"
          @update-new-folder-name="handleUpdateNewFolderName"
          @close-create-folder-dialog="handleCloseCreateFolderDialog"
          @confirm-create-folder="handleConfirmCreateFolder"
        />
      </main>

      <!-- README Preview Sidebar -->
      <ReadmePreview
        v-if="selectedRepo"
        :selected-repo="selectedRepo"
        :readme-content="readmeContent"
        :is-loading-readme="isLoadingReadme"
        @close="closeReadmePreview"
      />
    </div>
  </div>
</template>
