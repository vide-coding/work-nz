<script setup lang="ts">
import type { Project } from '@/types'

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

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days < 7) return `${days} 天前`

  return date.toLocaleDateString('zh-CN')
}
</script>

<template>
  <div
    class="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-auto"
  >
    <div v-if="loading" class="flex items-center justify-center h-full">
      <div class="text-gray-500 dark:text-gray-400">加载中...</div>
    </div>

    <div
      v-else-if="!project"
      class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400"
    >
      <p>选择项目查看详情</p>
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
          {{ project.description || '暂无描述' }}
        </p>
      </div>

      <!-- Details -->
      <div class="space-y-4">
        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            路径
          </label>
          <p class="text-sm text-gray-900 dark:text-white mt-1 break-all">
            {{ project.projectPath }}
          </p>
        </div>

        <div>
          <label class="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            更新时间
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
            进入工作区
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
