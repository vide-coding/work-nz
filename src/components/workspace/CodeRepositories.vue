<script setup lang="ts">
import { ref } from 'vue'
import { GitBranch, Search, X } from 'lucide-vue-next'
import RepoCard from './RepoCard.vue'
import CloneRepoDialog from './CloneRepoDialog.vue'
import EditRepoDialog from './EditRepoDialog.vue'
import type { GitRepository, GitRepoStatus } from '@/types'

const props = defineProps<{
  repos: GitRepository[]
  repoStatuses: Record<string, GitRepoStatus>
  error: string
}>()

const emit = defineEmits<{
  cloneRepo: [payload: { remoteUrl: string; targetDirName: string; name?: string }]
  updateRepo: [payload: { id: string; name?: string; description?: string }]
  pullRepo: [repo: GitRepository]
  openInIde: [repo: GitRepository]
  deleteRepo: [repo: GitRepository]
  loadReadme: [repo: GitRepository]
}>()

const repoSearchQuery = ref('')
const showCloneDialog = ref(false)
const showEditRepoDialog = ref(false)
const editingRepo = ref<GitRepository | null>(null)
const editRepoName = ref('')
const editRepoDescription = ref('')

// Clone dialog state
const cloneUrl = ref('')
const cloneTargetDir = ref('')
const cloneRepoName = ref('')
const isCloning = ref(false)

// Edit dialog state
const isUpdatingRepo = ref(false)

const filteredRepos = computed(() => {
  if (!repoSearchQuery.value.trim()) {
    return props.repos
  }
  const query = repoSearchQuery.value.toLowerCase().trim()
  return props.repos.filter((repo) => {
    if (repo.name.toLowerCase().includes(query)) {
      return true
    }
    if (repo.description && repo.description.toLowerCase().includes(query)) {
      return true
    }
    return false
  })
})

import { computed } from 'vue'

function openCloneDialog() {
  showCloneDialog.value = true
}

function closeCloneDialog() {
  showCloneDialog.value = false
  cloneUrl.value = ''
  cloneTargetDir.value = ''
  cloneRepoName.value = ''
}

function handleClone() {
  if (!cloneUrl.value.trim() || !cloneTargetDir.value.trim()) return
  emit('cloneRepo', {
    remoteUrl: cloneUrl.value.trim(),
    targetDirName: cloneTargetDir.value.trim(),
    name: cloneRepoName.value.trim() || undefined,
  })
  closeCloneDialog()
}

function openEditRepoDialog(repo: GitRepository) {
  editingRepo.value = repo
  editRepoName.value = repo.name || ''
  editRepoDescription.value = repo.description || ''
  showEditRepoDialog.value = true
}

function closeEditRepoDialog() {
  showEditRepoDialog.value = false
  editingRepo.value = null
  editRepoName.value = ''
  editRepoDescription.value = ''
}

function handleUpdateRepo() {
  if (!editingRepo.value) return
  emit('updateRepo', {
    id: editingRepo.value.id,
    name: editRepoName.value.trim() || undefined,
    description: editRepoDescription.value.trim() || undefined,
  })
  closeEditRepoDialog()
}

function viewReadme(repo: GitRepository) {
  emit('loadReadme', repo)
}

function pull(repo: GitRepository) {
  emit('pullRepo', repo)
}

function openInIde(repo: GitRepository) {
  emit('openInIde', repo)
}

function deleteRepo(repo: GitRepository) {
  emit('deleteRepo', repo)
}
</script>

<template>
  <div class="p-6">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          {{ $t('workspace.codeRepositories') }}
        </h2>
        <button
          class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          @click="openCloneDialog"
        >
          <GitBranch class="w-4 h-4" />
          {{ $t('workspace.cloneNewRepo') }}
        </button>
      </div>

      <!-- Search Bar -->
      <div class="mb-4 relative">
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            v-model="repoSearchQuery"
            type="text"
            class="w-full pl-10 pr-10 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            :placeholder="$t('workspace.searchRepos')"
          />
          <button
            v-if="repoSearchQuery"
            class="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            @click="repoSearchQuery = ''"
          >
            <X class="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      <!-- Repo List -->
      <div v-if="repos.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
        <GitBranch class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{{ $t('workspace.noRepos') }}</p>
        <p class="text-sm mt-2">{{ $t('workspace.noReposHint') }}</p>
      </div>

      <div
        v-else-if="filteredRepos.length === 0"
        class="text-center py-12 text-gray-500 dark:text-gray-400"
      >
        <Search class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{{ $t('workspace.noReposFound') }}</p>
      </div>

      <div v-else class="space-y-4">
        <RepoCard
          v-for="repo in filteredRepos"
          :key="repo.id"
          :repo="repo"
          :status="repoStatuses[repo.id]"
          @view-readme="viewReadme"
          @pull="pull"
          @open-in-ide="openInIde"
          @edit="openEditRepoDialog"
          @delete-repo="deleteRepo"
        />
      </div>
    </div>

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

    <!-- Edit Repo Dialog -->
    <EditRepoDialog
      v-if="showEditRepoDialog"
      :repo="editingRepo"
      :edit-repo-name="editRepoName"
      :edit-repo-description="editRepoDescription"
      :is-updating="isUpdatingRepo"
      :error="error"
      @update:edit-repo-name="editRepoName = $event"
      @update:edit-repo-description="editRepoDescription = $event"
      @close="closeEditRepoDialog"
      @confirm="handleUpdateRepo"
    />
  </div>
</template>
