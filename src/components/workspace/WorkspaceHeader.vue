<script setup lang="ts">
import { ArrowLeft, ChevronRight, Settings } from 'lucide-vue-next'
import { computed } from 'vue'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import type { Project, WorkspaceSettings, ThemeMode } from '@/types'

const props = defineProps<{
  project: Project | null
  settings: WorkspaceSettings
  locale: string
}>()

// 将 ThemeMode 映射到 ThemeToggle 支持的类型
const displayThemeMode = computed<'light' | 'dark' | 'system'>(() => {
  const mode = props.settings.themeMode as ThemeMode
  if (mode === 'custom') {
    // 对于 custom 模式，默认使用 light（或可以根据某条件选择）
    return 'light'
  }
  return mode
})

const emit = defineEmits<{
  goBack: []
  goToSettings: []
  updateTheme: [themeMode: 'light' | 'dark' | 'system']
  updateLocale: [locale: 'zh-CN' | 'en-US']
}>()

function goBack() {
  emit('goBack')
}

function goToSettings() {
  emit('goToSettings')
}

function updateTheme(themeMode: 'light' | 'dark' | 'system') {
  emit('updateTheme', themeMode)
}

function updateLocale(locale: 'zh-CN' | 'en-US') {
  emit('updateLocale', locale)
}
</script>

<template>
  <header class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
    <div class="flex items-center justify-between">
      <!-- Breadcrumb -->
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          @click="goBack"
        >
          <ArrowLeft class="w-4 h-4" />
          {{ $t('projects.title') }}
        </button>
        <ChevronRight class="w-4 h-4 text-gray-400" />
        <span class="text-sm font-medium text-gray-900 dark:text-white">
          {{ project?.name || $t('workspace.projectWorkspace') }}
        </span>
      </div>

      <!-- Right Actions -->
      <div class="flex items-center gap-3">
        <!-- Settings -->
        <button
          @click="goToSettings"
          class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          :title="$t('settings.title')"
        >
          <Settings class="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <!-- Theme -->
        <ThemeToggle :model-value="displayThemeMode" @update:model-value="updateTheme" />
        <!-- Language -->
        <LanguageSelector
          :model-value="locale as 'zh-CN' | 'en-US'"
          @update:model-value="updateLocale"
        />
      </div>
    </div>
  </header>
</template>
