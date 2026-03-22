<script setup lang="ts">
import { Trash2, ChevronRight, Pen } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { Project, GitRepoStatus } from '@/types'

const { t } = useI18n()

const props = defineProps<{
  project: Project
  selected: boolean
  status?: GitRepoStatus | null
}>()

const emit = defineEmits<{
  select: []
  open: []
  hide: []
  edit: []
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

  return date.toLocaleDateString('zh-CN')
}
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 rounded-xl border transition-all cursor-pointer"
    :class="
      selected
        ? 'border-indigo-500 ring-2 ring-indigo-500/20'
        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
    "
    @click="emit('select')"
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
            class="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            @click.stop="emit('edit')"
            :title="$t('project.edit')"
          >
            <Pen class="w-4 h-4" />
          </button>
          <button
            class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            @click.stop="emit('hide')"
            :title="$t('project.hide')"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="mt-4 flex items-center gap-3">
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
          @click.stop="emit('open')"
        >
          {{ $t('project.open') }}
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
