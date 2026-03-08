<template>
  <div class="markdown-theme-selector space-y-6">
    <!-- 模式选择 -->
    <div class="mode-selection">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {{ t('theme.mode') }}
      </label>
      <div class="flex gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg inline-flex">
        <button
          v-for="mode in modes"
          :key="mode.value"
          @click="setMode(mode.value)"
          :class="[
            'px-3 py-1.5 text-sm rounded-md transition-all',
            localConfig.mode === mode.value
              ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200',
          ]"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <!-- 统一主题选择 -->
    <div v-if="localConfig.mode === 'unified'" class="theme-selection">
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        {{ t('theme.select') }}
      </label>
      <div class="grid grid-cols-5 gap-2">
        <button
          v-for="theme in themes"
          :key="theme.value"
          @click="setUnifiedTheme(theme.value)"
          :class="[
            'relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
            localConfig.unifiedTheme === theme.value
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
          ]"
        >
          <div
            class="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700"
            :style="{ background: getThemePreviewColor(theme.value) }"
          />
          <span class="text-xs font-medium text-gray-700 dark:text-gray-300">
            {{ theme.label }}
          </span>
          <div
            v-if="localConfig.unifiedTheme === theme.value"
            class="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center"
          >
            <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </button>
      </div>
    </div>

    <!-- 分离主题选择 -->
    <div v-else class="separate-themes space-y-4">
      <!-- 亮色主题 -->
      <div class="theme-selection">
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2"
        >
          <Sun class="w-4 h-4" />
          {{ t('theme.lightTheme') }}
        </label>
        <div class="grid grid-cols-5 gap-2">
          <button
            v-for="theme in themes"
            :key="theme.value"
            @click="setLightTheme(theme.value)"
            :class="[
              'relative flex items-center justify-center py-2 px-1 rounded-lg border-2 transition-all',
              localConfig.lightTheme === theme.value
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
            ]"
          >
            <div class="flex items-center gap-2">
              <div
                class="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-700"
                :style="{ background: getThemePreviewColor(theme.value) }"
              />
              <span class="text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ theme.label }}
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- 暗色主题 -->
      <div class="theme-selection">
        <label
          class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2"
        >
          <Moon class="w-4 h-4" />
          {{ t('theme.darkTheme') }}
        </label>
        <div class="grid grid-cols-5 gap-2">
          <button
            v-for="theme in themes"
            :key="theme.value"
            @click="setDarkTheme(theme.value)"
            :class="[
              'relative flex items-center justify-center py-2 px-1 rounded-lg border-2 transition-all',
              localConfig.darkTheme === theme.value
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
            ]"
          >
            <div class="flex items-center gap-2">
              <div
                class="w-4 h-4 rounded-full border border-gray-200 dark:border-gray-700"
                :style="{ background: getThemePreviewColor(theme.value) }"
              />
              <span class="text-xs font-medium text-gray-700 dark:text-gray-300">
                {{ theme.label }}
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sun, Moon } from 'lucide-vue-next'
import type { MarkdownThemeConfig } from '@/types/markdown'
import type { ThemeName } from '@/types/theme'
import { DEFAULT_MARKDOWN_THEME_CONFIG } from '@/types/markdown'

const props = defineProps<{
  modelValue: MarkdownThemeConfig
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: MarkdownThemeConfig): void
}>()

const { t } = useI18n()

// 本地配置副本
const localConfig = ref<MarkdownThemeConfig>({ ...props.modelValue })

// 监听外部变化
watch(
  () => props.modelValue,
  (newValue) => {
    localConfig.value = { ...newValue }
  },
  { deep: true }
)

// 监听本地变化并触发更新
watch(
  localConfig,
  (newValue) => {
    emit('update:modelValue', { ...newValue })
  },
  { deep: true }
)

// 模式选项
const modes = [
  { value: 'unified' as const, label: t('theme.modeUnified') },
  { value: 'separate' as const, label: t('theme.modeSeparate') },
]

// 主题选项
const themes: { value: ThemeName; label: string }[] = [
  { value: 'light', label: t('theme.light') },
  { value: 'dark', label: t('theme.dark') },
  { value: 'github', label: t('theme.github') },
  { value: 'nord', label: t('theme.nord') },
  { value: 'solarized', label: t('theme.solarized') },
]

// 获取主题预览颜色
function getThemePreviewColor(themeName: ThemeName): string {
  const colors: Record<ThemeName, string> = {
    light: '#ffffff',
    dark: '#0d1117',
    github: '#f6f8fa',
    nord: '#2e3440',
    solarized: '#002b36',
  }
  return colors[themeName] || '#ffffff'
}

// 更新模式
function setMode(mode: 'unified' | 'separate') {
  localConfig.value = {
    ...localConfig.value,
    mode,
    // 设置默认值
    unifiedTheme: localConfig.value.unifiedTheme || DEFAULT_MARKDOWN_THEME_CONFIG.unifiedTheme,
    lightTheme: localConfig.value.lightTheme || DEFAULT_MARKDOWN_THEME_CONFIG.lightTheme,
    darkTheme: localConfig.value.darkTheme || DEFAULT_MARKDOWN_THEME_CONFIG.darkTheme,
  }
}

// 设置统一主题
function setUnifiedTheme(theme: ThemeName) {
  localConfig.value = {
    ...localConfig.value,
    unifiedTheme: theme,
  }
}

// 设置亮色主题
function setLightTheme(theme: ThemeName) {
  localConfig.value = {
    ...localConfig.value,
    lightTheme: theme,
  }
}

// 设置暗色主题
function setDarkTheme(theme: ThemeName) {
  localConfig.value = {
    ...localConfig.value,
    darkTheme: theme,
  }
}
</script>
