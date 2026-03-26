<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { debounce } from '@/composables/useDebounce'
import { Loader2, GitBranch, X } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import type { Directory, GitRepository, GitRepoStatus, GitCloneProgress } from '@/types'
import { gitApi, ideApi, fsApi } from '@/composables/useApi'
import RepoCard from '@/components/workspace/RepoCard.vue'
import ReadmePreview from '@/components/workspace/ReadmePreview.vue'
import CloneRepoDialog from '@/components/workspace/CloneRepoDialog.vue'
import EditRepoDialog from '@/components/workspace/EditRepoDialog.vue'

const { t } = useI18n()

interface Props {
  directory: Directory
}

const props = defineProps<Props>()

// State
const repositories = ref<GitRepository[]>([])
const repoStatuses = ref<Record<string, GitRepoStatus>>({})
const loading = ref(false)
const error = ref('')

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

// README preview state
const selectedRepo = ref<GitRepository | null>(null)
const readmeContent = ref('')
const isLoadingReadme = ref(false)

// Filter repos by directory path
const filteredRepos = computed(() => {
  const dirPath = props.directory.relativePath
  if (!dirPath) return repositories.value

  // repo.path is absolute, need to check if it contains the relative path as a segment
  // e.g., repo.path = "C:/projects/project/src/my-repo" and dirPath = "src"
  // We need to match paths that end with "/src" or contain "/src/"
  const pathSegment = dirPath.replace(/\\/g, '/')
  return repositories.value.filter((repo) => {
    const normalizedPath = repo.path.replace(/\\/g, '/')
    return normalizedPath.includes(`/${pathSegment}/`) || normalizedPath.endsWith(`/${pathSegment}`)
  })
})

// Load repositories for this directory
async function loadRepositories() {
  if (!props.directory.projectId) return

  loading.value = true
  error.value = ''
  try {
    const repos = await gitApi.repoList(props.directory.projectId)
    repositories.value = repos

    // Load status for each repo
    for (const repo of repos) {
      await loadRepoStatus(repo.id)
    }
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
    const newRepo = await gitApi.repoClone(props.directory.projectId, {
      remoteUrl: remoteUrl,
      targetDirName: targetDirName,
      targetDirectory: props.directory.relativePath || undefined,
      name: repoName || undefined,
    })
    // Add to the beginning of the list
    repositories.value.unshift(newRepo)
    draggedRepos.value.unshift(newRepo)
    await loadRepoStatus(newRepo.id)
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
    const newRepo = await gitApi.repoClone(props.directory.projectId, {
      remoteUrl: task.remoteUrl,
      targetDirName: targetDirName,
      targetDirectory: props.directory.relativePath || undefined,
    })
    repositories.value.push(newRepo)
    delete cloneTasks.value[taskKey]
    await loadRepoStatus(newRepo.id)
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
async function handleDeleteRepo(repo: GitRepository) {
  // TODO: Implement
  console.log('Delete repo:', repo)
}

// Drag and drop handlers
function onModelValueUpdate(newList: GitRepository[]) {
  draggedRepos.value = newList
}

async function onDragEnd() {
  if (!props.directory.projectId) return

  // Update the main repositories list to match the new order
  const nonFilteredRepos = repositories.value.filter(
    (r) => !filteredRepos.value.some((fr) => fr.id === r.id)
  )
  repositories.value = [...draggedRepos.value, ...nonFilteredRepos]

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
onMounted(async () => {
  loadRepositories()
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
  if (unlistenCloneProgress) {
    unlistenCloneProgress()
  }
})

watch(
  () => props.directory.id,
  () => {
    loadRepositories()
  }
)
</script>

<template>
  <div class="git-module">
    <div class="git-module__content">
      <!-- Header -->
      <div class="git-module__header">
        <h3 class="git-module__title">{{ t('git.title') }}</h3>
        <button class="git-module__clone-btn" @click="showCloneDialog = true">
          {{ t('git.cloneButton') }}
        </button>
      </div>

      <!-- Directory path -->
      <div v-if="directory.relativePath" class="git-module__path">
        <span class="git-module__path-label">{{ t('git.directory') }}</span>
        <span class="git-module__path-value">{{ directory.relativePath }}</span>
      </div>

      <!-- Error state -->
      <div v-if="error" class="git-module__error">
        {{ error }}
      </div>

      <!-- Clone progress items -->
      <div v-if="Object.keys(cloneTasks).length > 0" class="git-module__list">
        <div
          v-for="(task, taskId) in cloneTasks"
          :key="'clone-' + taskId"
          class="git-module__clone-card"
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
      <div v-if="draggedRepos.length > 0" class="git-module__list">
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
              @delete-repo="handleDeleteRepo"
            />
          </template>
        </draggable>
      </div>

      <!-- Empty state -->
      <div v-else class="git-module__empty">
        <p>{{ t('git.noRepos') }}</p>
        <p class="git-module__empty-hint">{{ t('git.noReposHint') }}</p>
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
  </div>
</template>

<style scoped>
.git-module {
  height: 100%;
  display: flex;
  padding: 16px;
  overflow: hidden;
}

.git-module__content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding-right: 16px;
}

.git-module__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.git-module__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.git-module__clone-btn {
  padding: 6px 12px;
  background-color: #3b82f6;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.git-module__clone-btn:hover {
  background-color: #2563eb;
}

.git-module__path {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background-color: #f3f4f6;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 13px;
}

.git-module__path-label {
  color: #6b7280;
}

.git-module__path-value {
  color: #111827;
  font-family: monospace;
}

.git-module__loading,
.git-module__error {
  text-align: center;
  padding: 32px;
  color: #6b7280;
}

.git-module__error {
  color: #dc2626;
}

.git-module__list {
  flex: 1;
}

.git-module__clone-card {
  background: white;
  border-radius: 0.75rem;
  padding: 1rem;
  border: 1px solid #e5e7eb;
  margin-bottom: 0.75rem;
}

.dark .git-module__clone-card {
  background: #1f2937;
  border-color: #374151;
}

.git-module__ghost {
  opacity: 0.5;
  background: #dbeafe;
}

.dark .git-module__ghost {
  background: #1e3a8a;
}

.git-module__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6b7280;
}

.git-module__empty-hint {
  font-size: 13px;
  color: #9ca3af;
  margin-top: 4px;
}
</style>
