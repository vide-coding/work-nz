<script setup lang="ts">
import { Edit3, Save, Code, FileText, Image } from 'lucide-vue-next'
import type { Project, GitRepository, ProjectDirectory, DirectoryType } from '@/types'

const props = defineProps<{
  project: Project | null
  repos: GitRepository[]
  projectDirs: ProjectDirectory[]
  dirTypes: DirectoryType[]
  isEditing: boolean
  editDescription: string
}>()

const emit = defineEmits<{
  startEdit: []
  cancelEdit: []
  saveProject: []
  updateDescription: [value: string]
}>()

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

function getDocsCount(): number {
  return props.projectDirs.filter((pd) =>
    props.dirTypes.find((d) => d.id === pd.dirTypeId && d.kind === 'docs')
  ).length
}

function getUiDesignCount(): number {
  return props.projectDirs.filter((pd) =>
    props.dirTypes.find((d) => d.id === pd.dirTypeId && d.kind === 'ui_design')
  ).length
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
        <!-- Code Stats -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Code class="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span class="font-medium text-gray-900 dark:text-white">{{
              $t('workspace.codeOverview')
            }}</span>
          </div>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ repos.length }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('workspace.repositories') }}
          </p>
        </div>

        <!-- Docs Stats -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <FileText class="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span class="font-medium text-gray-900 dark:text-white">{{
              $t('workspace.docsOverview')
            }}</span>
          </div>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ getDocsCount() }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('workspace.directories') }}
          </p>
        </div>

        <!-- UI Design Stats -->
        <div
          class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3 mb-4">
            <div class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Image class="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span class="font-medium text-gray-900 dark:text-white">{{
              $t('workspace.designOverview')
            }}</span>
          </div>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">
            {{ getUiDesignCount() }}
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('workspace.directories') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
