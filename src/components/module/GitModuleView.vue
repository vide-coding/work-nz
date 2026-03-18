<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { debounce } from '@/composables/useDebounce'
import type { Directory, GitRepository, GitRepoStatus } from '@/types'
import { gitApi, ideApi, fsApi } from '@/composables/useApi'
import RepoCard from '@/components/workspace/RepoCard.vue'
import ReadmePreview from '@/components/workspace/ReadmePreview.vue'
import CloneRepoDialog from '@/components/workspace/CloneRepoDialog.vue'
import EditRepoDialog from '@/components/workspace/EditRepoDialog.vue'

interface Props {
  directory: Directory
}

const props = defineProps<Props>()

// State
const repositories = ref<GitRepository[]>([])
const repoStatuses = ref<Record<string, GitRepoStatus>>({})
const loading = ref(false)
const error = ref('')

// Clone dialog state
const showCloneDialog = ref(false)
const cloneUrl = ref('')
const cloneTargetDir = ref('')
const cloneRepoName = ref('')
const isCloning = ref(false)

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
    for (const repo of filteredRepos.value) {
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

  isCloning.value = true
  error.value = ''
  try {
    const newRepo = await gitApi.repoClone(props.directory.projectId, {
      remoteUrl: cloneUrl.value,
      targetDirName: cloneTargetDir.value,
      targetDirectory: props.directory.relativePath || undefined,
      name: cloneRepoName.value || undefined,
    })
    repositories.value.push(newRepo)
    showCloneDialog.value = false
    cloneUrl.value = ''
    cloneTargetDir.value = ''
    cloneRepoName.value = ''

    // Load status for new repo
    await loadRepoStatus(newRepo.id)
  } catch (e: any) {
    error.value = e.message || 'Failed to clone repository'
  } finally {
    isCloning.value = false
  }
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
  try {
    await gitApi.repoPull(repo.id)
    // Refresh status after pull
    await loadRepoStatus(repo.id)
  } catch (e) {
    console.error('Failed to pull:', e)
  }
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

// Load on mount and when directory changes
onMounted(() => {
  loadRepositories()
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
        <h3 class="git-module__title">Git Repositories</h3>
        <button class="git-module__clone-btn" @click="showCloneDialog = true">
          + Clone Repository
        </button>
      </div>

      <!-- Directory path -->
      <div v-if="directory.relativePath" class="git-module__path">
        <span class="git-module__path-label">Directory:</span>
        <span class="git-module__path-value">{{ directory.relativePath }}</span>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="git-module__loading">Loading repositories...</div>

      <!-- Error state -->
      <div v-else-if="error" class="git-module__error">
        {{ error }}
      </div>

      <!-- Repository list -->
      <div v-else-if="filteredRepos.length > 0" class="git-module__list">
        <RepoCard
          v-for="repo in filteredRepos"
          :key="repo.id"
          :repo="repo"
          :status="repoStatuses[repo.id]"
          @view-readme="handleLoadReadme"
          @pull="handlePull"
          @open-in-ide="handleOpenInIde"
          @open-in-terminal="handleOpenInTerminal"
          @edit="openEditDialog"
          @delete-repo="handleDeleteRepo"
        />
      </div>

      <!-- Empty state -->
      <div v-else class="git-module__empty">
        <p>No Git repositories in this directory</p>
        <p class="git-module__empty-hint">Click "Clone Repository" to add one</p>
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
      :is-cloning="isCloning"
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
