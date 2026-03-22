<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { Project } from '@/types'

const { t } = useI18n()

const props = defineProps<{
  project: Project | null
  loading?: boolean
}>()

const emit = defineEmits<{
  'open-workspace': []
}>()

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('time.justNow')
  if (minutes < 60) return t('time.minutesAgo', { n: minutes })
  if (hours < 24) return t('time.hoursAgo', { n: hours })
  if (days < 7) return t('time.daysAgo', { n: days })

  return date.toLocaleDateString()
}
</script>

<template>
  <div
    class="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-auto"
  >
    <div v-if="loading" class="flex items-center justify-center h-full">
      <div class="text-gray-500 dark:text-gray-400">{{ t('common.loading') }}</div>
    </div>

    <div
      v-else-if="!project"
      class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400"
    >
      <p>{{ t('projects.selectToView') }}</p>
    </div>

    <div v-else class="p-6">
      <!-- Project Info -->
      <div class="text-center mb-6">
        <div
          class="w-16 h-16 rounded-xl mx-auto mb-3 flex items-center justify-center text-white text-2xl font-bold"
          :style="{
            backgroundColor: project.display?.themeColor || '#4F46E5',
          }"
        >
          {{ project.name.charAt(0).toUpperCase() }}
        </div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          {{ project.name }}
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {{ project.description || t('projects.noDescription') }}
        </p>
      </div>

      <!-- Details -->
      <div class="space-y-4">
        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {{ t('projects.path') }}
          </label>
          <p class="text-sm text-gray-900 dark:text-white mt-1 break-all">
            {{ project.projectPath }}
          </p>
        </div>

        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {{ t('projects.updatedAt') }}
          </label>
          <p class="text-sm text-gray-900 dark:text-white mt-1">
            {{ formatDate(project.updatedAt) }}
          </p>
        </div>

        <!-- Quick Actions -->
        <div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <button
            class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            @click="emit('open-workspace')"
          >
            {{ t('projects.openWorkspace') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
