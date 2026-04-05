<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { debounce } from '@/composables/useDebounce'
import { Loader2, GitBranch, X, RefreshCw } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import type { Directory, GitRepository, GitRepoStatus, GitCloneProgress } from '@/types'
import { gitApi, ideApi, fsApi, projectApi } from '@/composables/useApi'
import RepoCard from '@/components/workspace/RepoCard.vue'
import ReadmePreview from '@/components/workspace/ReadmePreview.vue'
import CloneRepoDialog from '@/components/workspace/CloneRepoDialog.vue'
import EditRepoDialog from '@/components/workspace/EditRepoDialog.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'

const { t } = useI18n()

interface Props {
  directory: Directory
}

const props = defineProps<Props>()

// State
const repositories = ref<GitRepository[]>([])
const repoStatuses = ref<Record<string, GitRepoStatus>>({})
const loading = ref(false)
const scanning = ref(false)
const refreshing = ref(false)
const error = ref('')

// File system watcher state
let unlistenDirChange: UnlistenFn | null = null
const watchingDirectory = ref(false)
let currentWatchId: string | null = null
let isCleaningUp = false

// Drag and drop state
const draggedRepos = ref<GitRepository[]>([])

// Clone dialog state
const showCloneDialog = ref(false)
const cloneUrl = ref('')
const cloneTargetDir = ref('')
const cloneRepoName = ref('')

// Clone progress tracking
interface CloneTask {
  targetDirName: string
  remoteUrl: string
  progress: GitCloneProgress | null
  status: 'cloning' | 'completed' | 'failed'
}
const cloneTasks = ref<Record<string, CloneTask>>({})
let unlistenCloneProgress: UnlistenFn | null = null

// Check if there's any active cloning
const hasActiveCloning = computed(() => {
  return Object.values(cloneTasks.value).some((task) => task.status === 'cloning')
})

// Pull retry tracking
const pullRetryCount = ref<Record<string, number>>({})

// Auto extract repo name from URL when clone URL changes
const debouncedExtractRepoName = debounce(async (newUrl: string) => {
  if (newUrl && !cloneTargetDir.value) {
    try {
      const name = await gitApi.extractRepoName(newUrl)
      if (name) {
        cloneTargetDir.value = name
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

// Auto update repo name when target dir changes
watch(cloneTargetDir, (newDir) => {
  if (newDir && !cloneRepoName.value) {
    cloneRepoName.value = newDir
  }
})

// Edit dialog state
const showEditDialog = ref(false)
const editingRepo = ref<GitRepository | null>(null)
const editRepoName = ref('')
const editRepoDescription = ref('')
const isUpdating = ref(false)
const editRepoError = ref('')

// Delete dialog state
const showDeleteDialog = ref(false)
const deletingRepo = ref<GitRepository | null>(null)
const deleteLocalFiles = ref(false)
const isDeleting = ref(false)
const deleteError = ref('')

// README preview state
const selectedRepo = ref<GitRepository | null>(null)
const readmeContent = ref('')
const isLoadingReadme = ref(false)

// Repos are already filtered by the backend (via folder parameter).
// Use repositories directly - filteredRepos was causing double-filtering issues.
const filteredRepos = computed(() => repositories.value)

// Load repositories for this directory
async function loadRepositories() {
  if (!props.directory.projectId) return

  loading.value = true
  error.value = ''
  try {
    // Pass relativePath as folder filter - backend handles the SQL WHERE clause
    const repos = await gitApi.repoList(props.directory.projectId, props.directory.relativePath || undefined)
    // Clear and reset all state for the new directory
    repositories.value = repos
    repoStatuses.value = {}
    draggedRepos.value = [...repos]
    // Clear selection when switching directories
    selectedRepo.value = null
    readmeContent.value = ''
    // Load status for each repo in parallel
    await Promise.all(repos.map((repo) => loadRepoStatus(repo.id)))
  } catch (e: any) {
    error.value = e.message || 'Failed to load repositories'
  } finally {
    loading.value = false
  }
}

// Load repository status
async function loadRepoStatus(repoId: string) {
  try {
    const status = await gitApi.repoStatusGet(repoId)
    repoStatuses.value[repoId] = status
  } catch (e) {
    console.error('Failed to load repo status:', e)
  }
}

// Scan for new repositories
async function handleScan() {
  if (!props.directory.projectId) return

  scanning.value = true
  error.value = ''
  try {
    const result = await gitApi.scan(props.directory.projectId)
    if (result.scanned && result.scanned.length > 0) {
      // Reload repositories to include newly scanned ones
      await loadRepositories()
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to scan repositories'
  } finally {
    scanning.value = false
  }
}

// Start watching directory for changes
async function setupDirectoryWatcher() {
  if (!props.directory.projectId) return

  // Create instance-scoped debounced function to prevent cross-component interference
  const debouncedAutoScan = debounce(async () => {
    if (!props.directory.projectId || scanning.value) return

    scanning.value = true
    error.value = ''
    try {
      const result = await gitApi.scan(props.directory.projectId)
      if (result.scanned && result.scanned.length > 0) {
        await loadRepositories()
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to auto-scan repositories'
    } finally {
      scanning.value = false
    }
  }, 1500)

  try {
    // Get project path to compute full directory path
    const project = await projectApi.get(props.directory.projectId)
    const dirPath = props.directory.relativePath
      ? `${project.projectPath}/${props.directory.relativePath}`
      : project.projectPath

    // Clean up existing watcher first
    await cleanupDirectoryWatcher()

    // Call backend to start watching
    currentWatchId = await gitApi.watchDirectory(dirPath)

    // Listen for directory change events
    unlistenDirChange = await listen<string>('git:directory:changed', () => {
      // Trigger debounced auto-scan when files/folders change
      debouncedAutoScan()
    })
    watchingDirectory.value = true
  } catch (e) {
    console.error('Failed to setup directory watcher:', e)
  }
}

// Clean up watcher
async function cleanupDirectoryWatcher() {
  // Guard against concurrent cleanup calls
  if (isCleaningUp) return
  isCleaningUp = true

  try {
    if (unlistenDirChange) {
      unlistenDirChange()
      unlistenDirChange = null
    }
    if (currentWatchId) {
      try {
        await gitApi.unwatchDirectory(currentWatchId)
      } catch (e) {
        console.error('Failed to unwatch directory:', e)
      }
      currentWatchId = null
    }
    watchingDirectory.value = false
  } finally {
    isCleaningUp = false
  }
}

// Refresh all repository statuses (with network check)
async function refreshAllRepoStatuses() {
  if (!props.directory.projectId || refreshing.value || scanning.value) return

  refreshing.value = true
  try {
    // First scan for new repositories
    await handleScan()

    // Then refresh status for each existing repo
    const repos = await gitApi.repoList(props.directory.projectId, props.directory.relativePath || undefined)
    // Refresh status for each repo with network check
    await Promise.all(
      repos.map(async (repo) => {
        try {
          const status = await gitApi.repoStatusCheck(repo.id)
          repoStatuses.value[repo.id] = status
        } catch (e) {
          console.error(`Failed to refresh status for repo ${repo.id}:`, e)
          // Fall back to local status
          const status = await gitApi.repoStatusGet(repo.id)
          repoStatuses.value[repo.id] = status
        }
      })
    )
  } catch (e) {
    console.error('Failed to refresh repo statuses:', e)
  } finally {
    refreshing.value = false
  }
}

// Clone repository
async function handleClone() {
  if (!props.directory.projectId) return

  const targetDirName = cloneTargetDir.value
  const remoteUrl = cloneUrl.value
  const repoName = cloneRepoName.value
  error.value = ''

  // Close the dialog immediately
  showCloneDialog.value = false
  cloneUrl.value = ''
  cloneTargetDir.value = ''
  cloneRepoName.value = ''

  // Track the clone task
  const taskKey = `clone-${targetDirName}`
  cloneTasks.value[taskKey] = {
    targetDirName,
    remoteUrl,
    progress: null,
    status: 'cloning',
  }

  try {
    await gitApi.repoClone(props.directory.projectId, {
      remoteUrl: remoteUrl,
      targetDirName: targetDirName,
      targetDirectory: props.directory.relativePath || undefined,
      name: repoName || undefined,
    })
    // Clone completes via event - loadRepositories() will be called on 'completed' stage
  } catch (e: any) {
    error.value = e.message || 'Failed to clone repository'
    if (cloneTasks.value[taskKey]) {
      cloneTasks.value[taskKey].status = 'failed'
      cloneTasks.value[taskKey].progress = {
        stage: 'failed',
        message: error.value,
        retryCount: 0,
        error: error.value,
      }
    }
  }
}

// Retry failed clone
async function retryClone(targetDirName: string) {
  const taskKey = Object.keys(cloneTasks.value).find(
    (key) => cloneTasks.value[key].targetDirName === targetDirName
  )
  if (!taskKey) return

  const task = cloneTasks.value[taskKey]
  if (task.status !== 'failed' || !props.directory.projectId) return

  cloneTasks.value[taskKey].status = 'cloning'
  cloneTasks.value[taskKey].progress = null
  error.value = ''

  try {
    await gitApi.repoClone(props.directory.projectId, {
      remoteUrl: task.remoteUrl,
      targetDirName: targetDirName,
      targetDirectory: props.directory.relativePath || undefined,
    })
    // Clone completes via event - loadRepositories() will be called on 'completed' stage
    delete cloneTasks.value[taskKey]
  } catch (e: any) {
    error.value = e.message || 'Failed to clone repository'
    cloneTasks.value[taskKey].status = 'failed'
    cloneTasks.value[taskKey].progress = {
      stage: 'failed',
      message: error.value,
      retryCount: (task.progress?.retryCount || 0) + 1,
      error: error.value,
    }
  }
}

// Cancel clone task
function cancelClone(targetDirName: string) {
  const taskKey = Object.keys(cloneTasks.value).find(
    (key) => cloneTasks.value[key].targetDirName === targetDirName
  )
  if (!taskKey) return
  delete cloneTasks.value[taskKey]
}

// Delete clone task
function deleteCloneTask(targetDirName: string) {
  const taskKey = Object.keys(cloneTasks.value).find(
    (key) => cloneTasks.value[key].targetDirName === targetDirName
  )
  if (!taskKey) return
  delete cloneTasks.value[taskKey]
}

// Update repository
async function handleUpdateRepo() {
  if (!editingRepo.value) return

  isUpdating.value = true
  editRepoError.value = ''
  try {
    const updated = await gitApi.repoUpdate(editingRepo.value.id, {
      name: editRepoName.value || undefined,
      description: editRepoDescription.value || undefined,
    })
    const index = repositories.value.findIndex((r) => r.id === editingRepo.value!.id)
    if (index !== -1) {
      repositories.value[index] = updated
    }
    showEditDialog.value = false
    editingRepo.value = null
  } catch (e: any) {
    editRepoError.value = e.message || 'Failed to update repository'
  } finally {
    isUpdating.value = false
  }
}

// Pull changes
async function handlePull(repo: GitRepository) {
  const retryCount = pullRetryCount.value[repo.id] || 0
  try {
    const result = await gitApi.repoPull(repo.id)
    if (result.ok) {
      // Refresh status after pull
      await loadRepoStatus(repo.id)
      // Clear retry count on success
      delete pullRetryCount.value[repo.id]
    } else {
      // Increment retry count
      pullRetryCount.value[repo.id] = retryCount + 1
    }
  } catch (e) {
    console.error('Failed to pull:', e)
    pullRetryCount.value[repo.id] = retryCount + 1
  }
}

// Retry pull for a specific repo
async function handleRetryPull(repo: GitRepository) {
  delete pullRetryCount.value[repo.id]
  await handlePull(repo)
}

// Open in IDE
async function handleOpenInIde(repo: GitRepository) {
  try {
    await ideApi.openRepo(repo.id)
  } catch (e: any) {
    console.error('Failed to open in IDE:', e)
    error.value = e.message || 'Failed to open in IDE'
  }
}

// Open in terminal
async function handleOpenInTerminal(repo: GitRepository) {
  try {
    await ideApi.openInTerminal(repo.id)
  } catch (e: any) {
    console.error('Failed to open terminal:', e)
    error.value = e.message || 'Failed to open terminal'
  }
}

// Delete repository
function openDeleteDialog(repo: GitRepository) {
  deletingRepo.value = repo
  deleteLocalFiles.value = false
  deleteError.value = ''
  showDeleteDialog.value = true
}

async function handleDeleteRepo() {
  if (!deletingRepo.value) return

  isDeleting.value = true
  deleteError.value = ''

  try {
    await gitApi.repoDelete(deletingRepo.value.id, deleteLocalFiles.value)
    // Remove from the list
    repositories.value = repositories.value.filter((r) => r.id !== deletingRepo.value!.id)
    draggedRepos.value = draggedRepos.value.filter((r) => r.id !== deletingRepo.value!.id)
    // Clean up status
    delete repoStatuses.value[deletingRepo.value.id]
    showDeleteDialog.value = false
    deletingRepo.value = null
  } catch (e: any) {
    deleteError.value = e.message || 'Failed to delete repository'
  } finally {
    isDeleting.value = false
  }
}

function closeDeleteDialog() {
  showDeleteDialog.value = false
  deletingRepo.value = null
  deleteLocalFiles.value = false
  deleteError.value = ''
}

// Drag and drop handlers
function onModelValueUpdate(newList: GitRepository[]) {
  draggedRepos.value = newList
}

async function onDragEnd() {
  if (!props.directory.projectId) return

  // All repos in repositories.value belong to this directory (backend filtered by folder)
  repositories.value = [...draggedRepos.value]

  // Save the new order to backend
  try {
    const orderedIds = draggedRepos.value.map((r) => r.id)
    await gitApi.repoReorder(props.directory.projectId, orderedIds)
  } catch (e) {
    console.error('Failed to save reorder:', e)
  }
}

// Load README
async function handleLoadReadme(repo: GitRepository) {
  // Skip if same repo already selected and has content
  if (selectedRepo.value?.id === repo.id && readmeContent.value) {
    return
  }
  selectedRepo.value = repo
  readmeContent.value = ''
  isLoadingReadme.value = true

  try {
    // Try common README filenames
    const readmeNames = ['README.md', 'README.MD', 'Readme.md', 'readme.md', 'README', 'readme']

    for (const name of readmeNames) {
      const readmePath = `${repo.path}/${name}`
      try {
        const result = await fsApi.readText(readmePath)
        readmeContent.value = result.content
        break
      } catch {
        // Try next filename
        continue
      }
    }
  } catch (e: any) {
    console.error('Failed to load README:', e)
    readmeContent.value = ''
  } finally {
    isLoadingReadme.value = false
  }
}

// Close README preview
function closeReadmePreview() {
  selectedRepo.value = null
  readmeContent.value = ''
}

// Open edit dialog
function openEditDialog(repo: GitRepository) {
  editingRepo.value = repo
  editRepoName.value = repo.name || ''
  editRepoDescription.value = repo.description || ''
  showEditDialog.value = true
}

// Close clone dialog
function closeCloneDialog() {
  showCloneDialog.value = false
  cloneUrl.value = ''
  cloneTargetDir.value = ''
  cloneRepoName.value = ''
}

// Close edit dialog
function closeEditDialog() {
  showEditDialog.value = false
  editingRepo.value = null
  editRepoName.value = ''
  editRepoDescription.value = ''
}

// Sync draggedRepos when repositories change
watch(
  () => repositories.value,
  (newRepos) => {
    if (draggedRepos.value.length === 0 || draggedRepos.value.length !== newRepos.length) {
      draggedRepos.value = [...newRepos]
    }
  },
  { immediate: true, deep: true }
)

// Load on mount and when directory changes
// Note: watch with immediate:true handles initial load + watcher setup
onMounted(async () => {
  // Listen for clone progress events
  unlistenCloneProgress = await listen<GitCloneProgress>('git:clone:progress', (event) => {
    const progress = event.payload
    // Find the active clone task
    const activeTaskKey = Object.keys(cloneTasks.value).find(
      (key) => cloneTasks.value[key].status === 'cloning'
    )

    if (activeTaskKey) {
      cloneTasks.value[activeTaskKey].progress = progress
      if (progress.stage === 'completed') {
        // Remove completed task immediately
        delete cloneTasks.value[activeTaskKey]
        loadRepositories()
      } else if (progress.stage === 'failed') {
        cloneTasks.value[activeTaskKey].status = 'failed'
      }
    }
  })
})

onUnmounted(() => {
  cleanupDirectoryWatcher()
  if (unlistenCloneProgress) {
    unlistenCloneProgress()
  }
})

// Reload when directory identity changes (handles both id and relativePath changes)
// immediate:true ensures this runs on mount (replaces onMounted setup calls)
watch(
  () => [props.directory.id, props.directory.projectId, props.directory.relativePath] as const,
  async () => {
    cleanupDirectoryWatcher()
    loadRepositories()
    await handleScan()
    await setupDirectoryWatcher()
  },
  { immediate: true }
)
</script>

<template>
  <div class="h-full flex p-4 overflow-hidden">
    <div class="flex-1 min-w-0 overflow-y-auto pr-4">
      <!-- Header -->
      <div class="flex justify-between items-center mb-4">
        <h3 class="m-0 text-base font-semibold text-gray-900">{{ t('git.title') }}</h3>
        <div class="flex items-center gap-2">
          <button
            class="flex items-center justify-center p-1.5 text-gray-500 bg-transparent border border-gray-300 rounded-md cursor-pointer transition-all hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="refreshing || scanning"
            :title="$t('git.refresh')"
            @click="refreshAllRepoStatuses"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': refreshing || scanning }" />
          </button>
          <button class="px-3 py-1.5 text-[13px] font-medium text-white bg-blue-500 border-none rounded-md cursor-pointer transition-colors hover:bg-blue-600" @click="showCloneDialog = true">
            {{ t('git.cloneButton') }}
          </button>
        </div>
      </div>

      <!-- Directory path -->
      <div v-if="directory.relativePath" class="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-md mb-4 text-[13px]">
        <span class="text-gray-500">{{ t('git.directory') }}</span>
        <span class="text-gray-900 font-mono">{{ directory.relativePath }}</span>
      </div>

      <!-- Error state -->
      <div v-if="error" class="text-center p-8 text-red-500">
        {{ error }}
      </div>

      <!-- Clone progress items -->
      <div v-if="Object.keys(cloneTasks).length > 0" class="flex-1">
        <div
          v-for="(task, taskId) in cloneTasks"
          :key="'clone-' + taskId"
          class="bg-white rounded-xl p-4 border border-gray-200 mb-3 dark:bg-gray-800 dark:border-gray-700"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Loader2
                v-if="task.status === 'cloning'"
                class="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin"
              />
              <GitBranch
                v-else-if="task.status === 'completed'"
                class="w-5 h-5 text-green-600 dark:text-green-400"
              />
              <span v-else class="text-red-600 dark:text-red-400 text-lg">✕</span>
            </div>
            <div class="flex-1">
              <p class="font-medium text-gray-900 dark:text-white">
                {{ task.targetDirName }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ task.progress?.message || $t('common.cloning') }}
              </p>
              <div
                v-if="task.progress?.retryCount && task.progress.retryCount > 0"
                class="text-xs text-orange-500 mt-1"
              >
                {{ $t('workspace.retryCount', { n: task.progress.retryCount }) }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <!-- Cloning: show cancel button -->
              <button
                v-if="task.status === 'cloning'"
                class="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                :title="$t('common.cancel')"
                @click="cancelClone(task.targetDirName)"
              >
                <X class="w-4 h-4" />
              </button>
              <!-- Failed: show retry and delete buttons -->
              <template v-else-if="task.status === 'failed'">
                <button
                  class="px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded-lg transition-colors"
                  @click="retryClone(task.targetDirName)"
                >
                  {{ $t('workspace.retry') }}
                </button>
                <button
                  class="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
                  @click="deleteCloneTask(task.targetDirName)"
                >
                  {{ $t('common.delete') }}
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Repository list with drag and drop -->
      <div v-if="draggedRepos.length > 0" class="flex-1">
        <draggable
          :model-value="draggedRepos"
          @update:model-value="onModelValueUpdate"
          item-key="id"
          ghost-class="opacity-50"
          :animation="200"
          force-fallback="true"
          handle=".git-module__drag-handle"
          @end="onDragEnd"
        >
          <template #item="{ element: repo }">
            <RepoCard
              :repo="repo"
              :status="repoStatuses[repo.id]"
              :pull-error="pullRetryCount[repo.id] ? $t('workspace.pullFailed') : undefined"
              :selected="selectedRepo?.id === repo.id"
              @select="handleLoadReadme"
              @pull="handlePull"
              @retry-pull="handleRetryPull"
              @open-in-ide="handleOpenInIde"
              @open-in-terminal="handleOpenInTerminal"
              @edit="openEditDialog"
              @delete-repo="openDeleteDialog"
            />
          </template>
        </draggable>
      </div>

      <!-- Empty state -->
      <div v-else class="flex-1 flex flex-col items-center justify-center text-gray-500">
        <p>{{ t('git.noRepos') }}</p>
        <p class="text-[13px] text-gray-400 mt-1">{{ t('git.noReposHint') }}</p>
      </div>
    </div>

    <!-- README Preview Sidebar -->
    <ReadmePreview
      v-if="selectedRepo"
      :selected-repo="selectedRepo"
      :readme-content="readmeContent"
      :is-loading-readme="isLoadingReadme"
      @close="closeReadmePreview"
    />

    <!-- Clone Dialog -->
    <CloneRepoDialog
      v-if="showCloneDialog"
      :clone-url="cloneUrl"
      :clone-target-dir="cloneTargetDir"
      :clone-repo-name="cloneRepoName"
      :is-cloning="false"
      :error="error"
      @update:clone-url="cloneUrl = $event"
      @update:clone-target-dir="cloneTargetDir = $event"
      @update:clone-repo-name="cloneRepoName = $event"
      @close="closeCloneDialog"
      @confirm="handleClone"
    />

    <!-- Edit Dialog -->
    <EditRepoDialog
      v-if="showEditDialog"
      :repo="editingRepo"
      :edit-repo-name="editRepoName"
      :edit-repo-description="editRepoDescription"
      :is-updating="isUpdating"
      :error="editRepoError"
      @update:edit-repo-name="editRepoName = $event"
      @update:edit-repo-description="editRepoDescription = $event"
      @close="closeEditDialog"
      @confirm="handleUpdateRepo"
    />

    <!-- Delete Confirmation Dialog -->
    <BaseDialog
      v-if="showDeleteDialog"
      v-model="showDeleteDialog"
      :title="$t('workspace.deleteRepo')"
      width="max-w-sm"
      @close="closeDeleteDialog"
    >
      <div class="space-y-4">
        <p class="text-gray-700 dark:text-gray-300">
          {{ $t('workspace.deleteRepoConfirm', { name: deletingRepo?.name }) }}
        </p>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="deleteLocalFiles"
            type="checkbox"
            class="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600"
          />
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('workspace.deleteLocalFiles') }}
          </span>
        </label>
        <p v-if="deleteLocalFiles" class="text-sm text-orange-600 dark:text-orange-400">
          {{ $t('workspace.deleteLocalWarning') }}
        </p>
        <p v-if="deleteError" class="text-sm text-red-600 dark:text-red-400">
          {{ deleteError }}
        </p>
      </div>
      <template #footer>
        <button
          class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
          @click="closeDeleteDialog"
        >
          {{ $t('common.cancel') }}
        </button>
        <button
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isDeleting"
          @click="handleDeleteRepo"
        >
          {{ isDeleting ? $t('common.loading') : $t('common.delete') }}
        </button>
      </template>
    </BaseDialog>
  </div>
</template>
