<script setup lang="ts">
import { GitBranch, FileText, GitPullRequest, ExternalLink, Edit3, Trash2 } from 'lucide-vue-next'
import Tooltip from '@/components/common/Tooltip.vue'
import type { GitRepository, GitRepoStatus } from '@/types'

const props = defineProps<{
  repo: GitRepository
  status?: GitRepoStatus
}>()

const emit = defineEmits<{
  viewReadme: [repo: GitRepository]
  pull: [repo: GitRepository]
  openInIde: [repo: GitRepository]
  edit: [repo: GitRepository]
  deleteRepo: [repo: GitRepository]
}>()

function getRepoDisplayName(repo: GitRepository): string {
  return repo.name
}

function viewReadme() {
  emit('viewReadme', props.repo)
}

function pull() {
  emit('pull', props.repo)
}

function openInIde() {
  emit('openInIde', props.repo)
}

function edit() {
  emit('edit', props.repo)
}

function deleteRepo() {
  emit('deleteRepo', props.repo)
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
    <div class="flex items-start justify-between">
      <div class="flex items-start gap-3">
        <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <GitBranch class="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div>
          <h3 class="font-medium text-gray-900 dark:text-white">
            {{ getRepoDisplayName(repo) }}
          </h3>
          <p v-if="repo.description" class="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {{ repo.description }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ repo.path }}
          </p>
          <div class="flex items-center gap-3 mt-2">
            <span
              v-if="repo.branch"
              class="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
            >
              {{ repo.branch }}
            </span>
            <span
              v-if="status?.dirty"
              class="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded"
            >
              {{ $t('workspace.dirty') }}
            </span>
            <span
              v-if="(status?.behind || 0) > 0"
              class="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded"
            >
              {{
                $t('workspace.behind', {
                  n: status?.behind,
                })
              }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Tooltip :text="$t('workspace.readme')">
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="viewReadme"
          >
            <FileText class="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip :text="$t('workspace.pull')">
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="pull"
          >
            <GitPullRequest class="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip :text="$t('workspace.openInIde')">
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="openInIde"
          >
            <ExternalLink class="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip :text="$t('common.edit')">
          <button
            class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="edit"
          >
            <Edit3 class="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip :text="$t('common.delete')">
          <button
            class="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="deleteRepo"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</template>
