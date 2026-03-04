<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useLocale } from '../locales/useLocale'
import { projectApi, gitApi, workspaceApi } from '../composables/useApi'
import type { Project, GitRepoStatus, WorkspaceSettings, WorkspaceInfo } from '../types'
import { ArrowLeft, Folder, Loader2 } from 'lucide-vue-next'
import ProjectCard from '../components/project/ProjectCard.vue'
import ProjectPreview from '../components/project/ProjectPreview.vue'
import ProjectToolbar from '../components/project/ProjectToolbar.vue'
import ProjectCreateDialog from '../components/project/ProjectCreateDialog.vue'
import ProjectEditDialog from '../components/project/ProjectEditDialog.vue'
import ThemeToggle from '../components/common/ThemeToggle.vue'
import LanguageSelector from '../components/common/LanguageSelector.vue'

const router = useRouter()
const { locale, changeLocale } = useLocale()

// State
const projects = ref<Project[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const selectedProject = ref<Project | null>(null)
const showPreview = ref(true)
const settings = ref<WorkspaceSettings>({ themeMode: 'system' })
const projectStatuses = ref<Record<string, GitRepoStatus>>({})
const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const isCreatingProject = ref(false)
const currentWorkspace = ref<WorkspaceInfo | null>(null)

// Computed
const workspaceDisplayName = computed(() => {
  if (!currentWorkspace.value) return null
  return (
    currentWorkspace.value.alias ||
    currentWorkspace.value.path.split(/[\\/]/).pop() ||
    currentWorkspace.value.path
  )
})

const filteredProjects = computed(() => {
  let result = [...projects.value]

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
    )
  }

  // Sort by update time descending (newest first)
  result.sort((a, b) => {
    const dateA = new Date(a.updatedAt).getTime()
    const dateB = new Date(b.updatedAt).getTime()
    return dateB - dateA
  })

  return result
})

// Update window title
async function updateWindowTitle(title: string | null) {
  try {
    const window = getCurrentWindow()
    await window.setTitle(title || 'Vibe Kanban')
  } catch (e) {
    console.error('Failed to update window title:', e)
  }
}

watch(
  workspaceDisplayName,
  (name) => {
    updateWindowTitle(name)
  },
  { immediate: true }
)

// Methods
async function loadProjects() {
  try {
    loading.value = true
    error.value = ''
    projects.value = await projectApi.list()
  } catch (error: any) {
    error.value = error.message || String(error)
  } finally {
    loading.value = false
  }
}

async function loadSettings() {
  try {
    settings.value = await workspaceApi.getSettings()
    applyTheme(settings.value.themeMode)
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

async function loadCurrentWorkspace() {
  try {
    currentWorkspace.value = await workspaceApi.getCurrent()
  } catch (error) {
    console.error('Failed to load current workspace:', error)
  }
}

async function loadProjectDetails(project: Project) {
  try {
    const repos = await gitApi.repoList(project.id)
    if (repos.length > 0) {
      const statuses: Record<string, GitRepoStatus> = {}
      for (const repo of repos) {
        try {
          const status = await gitApi.repoStatusGet(repo.id)
          statuses[repo.id] = status
        } catch (error) {
          console.error('Failed to get repo status:', error)
        }
      }
      projectStatuses.value[project.id] = Object.values(statuses)[0]
    }
  } catch (error) {
    console.error('Failed to load project details:', error)
  }
}

async function handleCreateProject(name: string, description: string) {
  try {
    isCreatingProject.value = true
    error.value = ''
    const project = await projectApi.create({
      name,
      description: description || undefined,
    })
    projects.value.unshift(project)
    showCreateDialog.value = false
    isCreatingProject.value = false
  } catch (error: any) {
    error.value = error.message || String(error)
    isCreatingProject.value = false
  }
}

async function hideProject(project: Project) {
  if (
    !confirm(
      locale.value === 'zh-CN'
        ? '确定隐藏此项目吗？隐藏后可在工作区数据文件中恢复。'
        : 'Are you sure you want to hide this project? You can restore it from the workspace data file.'
    )
  ) {
    return
  }

  try {
    loading.value = true
    await projectApi.delete(project.id)
    projects.value = projects.value.filter((p) => p.id !== project.id)
    if (selectedProject.value?.id === project.id) {
      selectedProject.value = null
    }
  } catch (error: any) {
    error.value = error.message || String(error)
  } finally {
    loading.value = false
  }
}

async function handleEditProject(name: string, description: string) {
  const project = selectedProject.value
  if (!project) return

  try {
    loading.value = true
    error.value = ''
    const updated = await projectApi.update(project.id, {
      name,
      description: description || undefined,
    })
    const index = projects.value.findIndex((p) => p.id === project.id)
    if (index !== -1) {
      projects.value[index] = updated
    }
    if (selectedProject.value?.id === project.id) {
      selectedProject.value = updated
    }
    showEditDialog.value = false
  } catch (error: any) {
    error.value = error.message || String(error)
  } finally {
    loading.value = false
  }
}

function handleEditClick(project: Project) {
  selectedProject.value = project
  showEditDialog.value = true
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

async function updateTheme(themeMode: 'light' | 'dark' | 'system') {
  try {
    settings.value = await workspaceApi.updateSettings({ themeMode })
    applyTheme(themeMode)
  } catch (error) {
    console.error('Failed to update theme:', error)
  }
}

function selectProject(project: Project) {
  selectedProject.value = project
  loadProjectDetails(project)
}

// Lifecycle
onMounted(async () => {
  await loadSettings()
  await loadCurrentWorkspace()
  await loadProjects()
})
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
    <!-- Top Bar -->
    <header
      class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4"
    >
      <div class="flex items-center justify-between">
        <!-- Left: Workspace info -->
        <div class="flex items-center gap-4">
          <button
            class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="router.push('/workspace')"
          >
            <ArrowLeft class="w-4 h-4" />
            {{ $t('projects.switchWorkspace') }}
          </button>
          <div class="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            {{ workspaceDisplayName || $t('projects.workspace') }}
          </span>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-3">
          <ThemeToggle :model-value="settings.themeMode" @update:model-value="updateTheme" />
          <LanguageSelector :model-value="locale" @update:model-value="changeLocale" />
          <button
            class="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
            @click="showCreateDialog = true"
          >
            {{ $t('projects.newProject') }}
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Project List -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Toolbar -->
        <ProjectToolbar v-model:search-query="searchQuery" v-model:show-preview="showPreview" />

        <!-- List -->
        <div class="flex-1 overflow-auto p-6">
          <div
            v-if="loading && projects.length === 0"
            class="flex items-center justify-center h-full"
          >
            <Loader2 class="w-8 h-8 text-indigo-600 animate-spin" />
          </div>

          <div
            v-else-if="filteredProjects.length === 0"
            class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400"
          >
            <Folder class="w-16 h-16 mb-4 opacity-50" />
            <p class="text-lg">{{ $t('projects.empty') }}</p>
            <p class="text-sm mt-2">{{ $t('projects.emptyHint') }}</p>
          </div>

          <div v-else class="grid gap-4">
            <ProjectCard
              v-for="project in filteredProjects"
              :key="project.id"
              :project="project"
              :selected="selectedProject?.id === project.id"
              :status="projectStatuses[project.id]"
              @select="selectProject(project)"
              @open="router.push(`/projects/${project.id}`)"
              @hide="hideProject(project)"
              @edit="handleEditClick(project)"
            />
          </div>
        </div>
      </div>

      <!-- Preview Panel -->
      <ProjectPreview
        v-if="showPreview"
        :project="selectedProject"
        @open-workspace="router.push(`/projects/${selectedProject?.id}`)"
      />
    </div>

    <!-- Create Project Dialog -->
    <ProjectCreateDialog
      v-model="showCreateDialog"
      :loading="isCreatingProject"
      :error="error"
      @create="handleCreateProject"
    />

    <!-- Edit Project Dialog -->
    <ProjectEditDialog
      v-model="showEditDialog"
      :project="selectedProject"
      @save="handleEditProject"
    />
  </div>
</template>
