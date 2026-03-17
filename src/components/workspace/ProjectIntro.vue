<script setup lang="ts">
import { computed } from 'vue'
import { Edit3, Save, Folder, GitBranch, CheckSquare, Files } from 'lucide-vue-next'
import type { Project, DirectoryNavItem, GitRepository } from '@/types'

const props = defineProps<{
  project: Project | null
  directories: DirectoryNavItem[]
  repos: GitRepository[]
  isEditing: boolean
  editDescription: string
}>()

const emit = defineEmits<{
  startEdit: []
  cancelEdit: []
  saveProject: []
  updateDescription: [value: string]
}>()

// 计算各模块类型的数量（不包括目录总数）
const moduleStats = computed(() => {
  const stats = {
    git: 0,
    task: 0,
    file: 0,
    other: 0,
  }

  props.directories.forEach((dir) => {
    const moduleId = dir.moduleId?.replace('builtin:', '') || ''
    switch (moduleId) {
      case 'git':
        stats.git++
        break
      case 'task':
        stats.task++
        break
      case 'file':
        stats.file++
        break
      default:
        stats.other++
    }
  })

  return stats
})

// git 项目数量（从 repos 获取）
const gitProjectCount = computed(() => props.repos.length)

// 获取模块图标
function getModuleIcon(moduleId?: string) {
  const moduleKey = moduleId?.replace('builtin:', '') || ''
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

// 获取模块图标颜色
function getModuleColor(moduleId?: string) {
  const moduleKey = moduleId?.replace('builtin:', '') || ''
  switch (moduleKey) {
    case 'git':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    case 'task':
      return 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
    case 'file':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
    default:
      return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
  }
}

function startEdit() {
  emit('startEdit')
}

function cancelEdit() {
  emit('cancelEdit')
}

function saveProject() {
  emit('saveProject')
}

function updateDescription(event: Event) {
  emit('updateDescription', (event.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="p-6">
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
            :style="{
              backgroundColor: project?.display?.themeColor || '#4F46E5',
            }"
          >
            {{ project?.name?.charAt(0).toUpperCase() }}
          </div>
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ project?.name }}
            </h1>
            <p v-if="!isEditing" class="text-gray-600 dark:text-gray-400 mt-1">
              {{ project?.description || $t('projects.noDescription') }}
            </p>
          </div>
        </div>

        <button
          v-if="!isEditing"
          class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          @click="startEdit"
        >
          <Edit3 class="w-4 h-4" />
          {{ $t('common.edit') }}
        </button>
      </div>

      <!-- Edit Mode -->
      <div v-if="isEditing" class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <textarea
          :value="editDescription"
          rows="4"
          class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
          :placeholder="$t('projects.descriptionPlaceholder')"
          @input="updateDescription"
        ></textarea>
        <div class="flex justify-end gap-2 mt-3">
          <button
            class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            @click="cancelEdit"
          >
            {{ $t('common.cancel') }}
          </button>
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            @click="saveProject"
          >
            <Save class="w-4 h-4" />
            {{ $t('common.save') }}
          </button>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-3 gap-4">
        <!-- Git Projects -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <GitBranch class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span class="font-medium text-gray-900 dark:text-white text-sm">
              {{ $t('workspace.gitProjects') }}
            </span>
          </div>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ gitProjectCount }}
          </p>
        </div>

        <!-- Tasks -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <CheckSquare class="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span class="font-medium text-gray-900 dark:text-white text-sm">
              {{ $t('workspace.taskModules') }}
            </span>
          </div>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ moduleStats.task }}
          </p>
        </div>

        <!-- File Modules -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Files class="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span class="font-medium text-gray-900 dark:text-white text-sm">
              {{ $t('workspace.fileModules') }}
            </span>
          </div>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ moduleStats.file }}
          </p>
        </div>
      </div>

      <!-- Module List -->
      <div v-if="directories.length > 0" class="mt-8">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {{ $t('workspace.moduleOverview') }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="dir in directories"
            :key="dir.id"
            class="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
          >
            <div :class="['p-2 rounded-lg', getModuleColor(dir.moduleId)]">
              <component :is="getModuleIcon(dir.moduleId)" class="w-5 h-5" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium text-gray-900 dark:text-white truncate">
                {{ dir.name }}
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ dir.moduleName || $t('workspace.noModule') }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ dir.directoryCount }}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                {{ $t('workspace.items') }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="mt-8 text-center py-12">
        <Folder class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <p class="text-gray-500 dark:text-gray-400">
          {{ $t('workspace.noModules') }}
        </p>
      </div>
    </div>
  </div>
</template>
