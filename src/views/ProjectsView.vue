<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLocale } from '../locales/useLocale'
import { projectApi, ideApi, gitApi, workspaceApi } from '../composables/useApi'
import type { Project, GitRepoStatus, WorkspaceSettings } from '../types'
import {
  FolderPlus,
  Search,
  SortAsc,
  SortDesc,
  PanelRightClose,
  PanelRightOpen,
  ArrowLeft,
  Moon,
  Sun,
  Monitor,
  ExternalLink,
  Trash2,
  Folder,
  ChevronRight,
  Loader2,
} from 'lucide-vue-next'

const router = useRouter()
const { locale, changeLocale } = useLocale()

// State
const projects = ref<Project[]>([])
const loading = ref(false)
const error = ref('')
const searchQuery = ref('')
const sortBy = ref<'updatedAt' | 'name'>('updatedAt')
const sortOrder = ref<'asc' | 'desc'>('desc')
const selectedProject = ref<Project | null>(null)
const showPreview = ref(true)
const settings = ref<WorkspaceSettings>({ themeMode: 'system' })
const projectStatuses = ref<Record<string, GitRepoStatus>>({})
const showCreateDialog = ref(false)
const isCreatingProject = ref(false)
const newProjectName = ref('')
const newProjectDescription = ref('')

// Computed
const filteredProjects = computed(() => {
  let result = [...projects.value]

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
    )
  }

  // Sort
  result.sort((a, b) => {
    if (sortBy.value === 'name') {
      return sortOrder.value === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    } else {
      const dateA = new Date(a.updatedAt).getTime()
      const dateB = new Date(b.updatedAt).getTime()
      return sortOrder.value === 'asc' ? dateA - dateB : dateB - dateA
    }
  })

  return result
})

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

async function loadProjectDetails(project: Project) {
  try {
    // Load Git repositories
    const repos = await gitApi.repoList(project.id)
    if (repos.length > 0) {
      // Load status for each repo
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

async function createProject() {
  console.log('[createProject] Starting...')
  if (!newProjectName.value.trim()) return

  try {
    isCreatingProject.value = true
    error.value = ''
    console.log('[createProject] Calling API with:', {
      name: newProjectName.value.trim(),
      description: newProjectDescription.value.trim() || undefined,
    })
    const project = await projectApi.create({
      name: newProjectName.value.trim(),
      description: newProjectDescription.value.trim() || undefined,
    })
    console.log('[createProject] API returned:', project)
    projects.value.unshift(project)
    newProjectName.value = ''
    newProjectDescription.value = ''
    isCreatingProject.value = false
  } catch (error: any) {
    console.error('[createProject] Error:', error)
    error.value = error.message || String(error)
    isCreatingProject.value = false
  }
}

async function deleteProject(project: Project) {
  if (
    !confirm(
      locale.value === 'zh-CN'
        ? '确定删除此项目吗？'
        : 'Are you sure you want to delete this project?'
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

async function openInIde(project: Project) {
  try {
    await ideApi.openRepo(project.id, project.ideOverride || settings.value.defaultIde)
  } catch (error: any) {
    error.value = error.message || String(error)
  }
}

function toggleSort(field: 'updatedAt' | 'name') {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
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
  } catch (error) {
    console.error('Failed to update theme:', error)
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return locale.value === 'zh-CN' ? '刚刚' : 'Just now'
  if (minutes < 60) return `${minutes} ${locale.value === 'zh-CN' ? '分钟前' : 'min ago'}`
  if (hours < 24) return `${hours} ${locale.value === 'zh-CN' ? '小时前' : 'hours ago'}`
  if (days < 7) return `${days} ${locale.value === 'zh-CN' ? '天前' : 'days ago'}`

  return date.toLocaleDateString(locale.value)
}

function selectProject(project: Project) {
  selectedProject.value = project
  loadProjectDetails(project)
}

// Lifecycle
onMounted(async () => {
  await loadSettings()
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
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('projects.workspace') }}
          </span>
        </div>

        <!-- Right: Actions -->
        <div class="flex items-center gap-3">
          <!-- Theme Toggle -->
          <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              class="p-1.5 rounded-md transition-colors"
              :class="
                settings.themeMode === 'light'
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              "
              @click="updateTheme('light')"
            >
              <Sun class="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              class="p-1.5 rounded-md transition-colors"
              :class="
                settings.themeMode === 'dark'
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              "
              @click="updateTheme('dark')"
            >
              <Moon class="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
            <button
              class="p-1.5 rounded-md transition-colors"
              :class="
                settings.themeMode === 'system'
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              "
              @click="updateTheme('system')"
            >
              <Monitor class="w-4 h-4 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          <!-- Language -->
          <select
            v-model="locale"
            class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
            @change="changeLocale(locale as 'zh-CN' | 'en-US')"
          >
            <option value="zh-CN">中文</option>
            <option value="en-US">EN</option>
          </select>

          <!-- New Project -->
          <button
            class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors text-sm font-medium"
            @click="showCreateDialog = true"
          >
            <FolderPlus class="w-4 h-4" />
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
        <div
          class="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-4">
            <!-- Search -->
            <div class="flex-1 relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="text"
                :placeholder="$t('projects.searchPlaceholder')"
                class="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <!-- Sort -->
            <div class="flex items-center gap-2">
              <button
                class="flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors"
                :class="
                  sortBy === 'updatedAt'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                "
                @click="toggleSort('updatedAt')"
              >
                {{ $t('projects.sortByUpdate') }}
                <component :is="sortOrder === 'asc' ? SortAsc : SortDesc" class="w-4 h-4" />
              </button>
              <button
                class="flex items-center gap-1 px-3 py-2 text-sm rounded-lg transition-colors"
                :class="
                  sortBy === 'name'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                "
                @click="toggleSort('name')"
              >
                {{ $t('projects.sortByName') }}
                <component :is="sortOrder === 'asc' ? SortAsc : SortDesc" class="w-4 h-4" />
              </button>
            </div>

            <!-- Toggle Preview -->
            <button
              class="p-2 rounded-lg transition-colors"
              :class="
                showPreview
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              "
              @click="showPreview = !showPreview"
            >
              <component :is="showPreview ? PanelRightClose : PanelRightOpen" class="w-5 h-5" />
            </button>
          </div>
        </div>

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
            <div
              v-for="project in filteredProjects"
              :key="project.id"
              class="bg-white dark:bg-gray-800 rounded-xl border transition-all cursor-pointer"
              :class="
                selectedProject?.id === project.id
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              "
              @click="selectProject(project)"
            >
              <div class="p-4">
                <div class="flex items-start justify-between">
                  <div class="flex items-start gap-3">
                    <div
                      class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold"
                      :style="{
                        backgroundColor: project.display?.themeColor || '#4F46E5',
                      }"
                    >
                      {{ project.name.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <h3 class="font-semibold text-gray-900 dark:text-white">
                        {{ project.name }}
                      </h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                        {{ project.description || $t('projects.noDescription') }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400 dark:text-gray-500">
                      {{ formatDate(project.updatedAt) }}
                    </span>
                    <button
                      class="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      @click.stop="deleteProject(project)"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="mt-4 flex items-center gap-3">
                  <button
                    class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                    @click.stop="router.push(`/projects/${project.id}`)"
                  >
                    {{ $t('projects.open') }}
                    <ChevronRight class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Preview Panel -->
      <aside
        v-if="showPreview && selectedProject"
        class="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-auto"
      >
        <div class="p-6">
          <!-- Project Info -->
          <div class="text-center mb-6">
            <div
              class="w-16 h-16 rounded-xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold"
              :style="{
                backgroundColor: selectedProject.display?.themeColor || '#4F46E5',
              }"
            >
              {{ selectedProject.name.charAt(0).toUpperCase() }}
            </div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ selectedProject.name }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {{ selectedProject.description || $t('projects.noDescription') }}
            </p>
          </div>

          <!-- Details -->
          <div class="space-y-4">
            <div>
              <label class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {{ $t('projects.path') }}
              </label>
              <p class="text-sm text-gray-900 dark:text-white mt-1 break-all">
                {{ selectedProject.projectPath }}
              </p>
            </div>

            <div>
              <label class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                {{ $t('projects.lastUpdated') }}
              </label>
              <p class="text-sm text-gray-900 dark:text-white mt-1">
                {{ formatDate(selectedProject.updatedAt) }}
              </p>
            </div>

            <!-- Quick Actions -->
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
              <button
                class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                @click="router.push(`/projects/${selectedProject.id}`)"
              >
                {{ $t('projects.enterWorkspace') }}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Create Project Dialog -->
    <div
      v-if="showCreateDialog"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showCreateDialog = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4">
        <div class="p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {{ $t('projects.createNewProject') }}
          </h3>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ $t('projects.projectName') }}
              </label>
              <input
                v-model="newProjectName"
                type="text"
                class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                :placeholder="$t('projects.projectNamePlaceholder')"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ $t('projects.description') }}
              </label>
              <textarea
                v-model="newProjectDescription"
                rows="3"
                class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                :placeholder="$t('projects.descriptionPlaceholder')"
              ></textarea>
            </div>

            <div
              v-if="error"
              class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-xl">
          <button
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            @click="showCreateDialog = false"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
            @click="createProject"
            :disabled="!newProjectName.trim() || isCreatingProject"
          >
            {{ isCreatingProject ? $t('common.creating') : $t('common.create') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
