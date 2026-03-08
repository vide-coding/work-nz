<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import LanguageSelector from '@/components/common/LanguageSelector.vue'
import SettingItem from './SettingItem.vue'
import IdeSelector from './IdeSelector.vue'
import { useSettings } from '@/composables/useSettings'
import type { LanguageCode, FontSize } from '@/types/settings'
import type { IdeConfig } from '@/types'
import type { MarkdownThemeConfig } from '@/types/markdown'
import MarkdownThemeSelector from '@/components/MarkdownThemeSelector.vue'

const { t, locale } = useI18n()
const { globalSettings, loadGlobalSettings, updateGlobalSettings, resetGlobalSettings } =
  useSettings()

const isLoading = ref(true)
const isSaving = ref(false)
const saveMessage = ref('')

// Local state for two-way binding
// Use 'light' | 'dark' | 'system' to match ThemeToggle and GlobalSettings type
const localTheme = ref<'light' | 'dark' | 'system'>('system')
const localLanguage = ref<LanguageCode>('zh-CN')
const localFontSize = ref<FontSize>('medium')
const localDefaultIde = ref<IdeConfig | undefined>(undefined)
const localMarkdownTheme = ref<MarkdownThemeConfig>({
  mode: 'separate',
  lightTheme: 'light',
  darkTheme: 'dark',
})

onMounted(async () => {
  await loadGlobalSettings()
  if (globalSettings.value) {
    localTheme.value = globalSettings.value.themeMode as 'light' | 'dark' | 'system'
    localLanguage.value = globalSettings.value.language
    localFontSize.value = globalSettings.value.fontSize
    // Create a mutable copy of IdeConfig to avoid readonly issues
    localDefaultIde.value = globalSettings.value.defaultIde
      ? {
          ...globalSettings.value.defaultIde,
          args: [...(globalSettings.value.defaultIde.args || [])],
        }
      : undefined
    // Load markdown theme config
    localMarkdownTheme.value = globalSettings.value.markdownTheme || {
      mode: 'separate',
      lightTheme: 'light',
      darkTheme: 'dark',
    }
  }
  isLoading.value = false
})

// Apply theme changes immediately
watch(localTheme, async (newTheme) => {
  isSaving.value = true
  await updateGlobalSettings({ themeMode: newTheme })
  applyTheme(newTheme)
  isSaving.value = false
  showSaveMessage()
})

// Apply language changes immediately
watch(localLanguage, async (newLanguage) => {
  isSaving.value = true
  await updateGlobalSettings({ language: newLanguage })
  locale.value = newLanguage
  isSaving.value = false
  showSaveMessage()
})

// Watch for font size changes
watch(localFontSize, async (newFontSize) => {
  isSaving.value = true
  await updateGlobalSettings({ fontSize: newFontSize })
  isSaving.value = false
  showSaveMessage()
})

// Watch for IDE changes
watch(localDefaultIde, async (newIde) => {
  isSaving.value = true
  await updateGlobalSettings({ defaultIde: newIde })
  isSaving.value = false
  showSaveMessage()
})

// Watch for markdown theme changes
watch(
  localMarkdownTheme,
  async (newThemeConfig) => {
    isSaving.value = true
    await updateGlobalSettings({ markdownTheme: newThemeConfig })
    isSaving.value = false
    showSaveMessage()
  },
  { deep: true }
)

function applyTheme(theme: 'light' | 'dark' | 'system') {
  const root = document.documentElement

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.toggle('dark', prefersDark)
  } else {
    root.classList.toggle('dark', theme === 'dark')
  }
}

function showSaveMessage() {
  saveMessage.value = t('settings.saved')
  setTimeout(() => {
    saveMessage.value = ''
  }, 2000)
}

async function handleReset() {
  if (confirm(t('settings.resetConfirm'))) {
    isSaving.value = true
    const defaults = await resetGlobalSettings()
    localTheme.value = defaults.themeMode
    localLanguage.value = defaults.language
    localFontSize.value = defaults.fontSize
    localDefaultIde.value = defaults.defaultIde

    applyTheme(defaults.themeMode)
    locale.value = defaults.language

    isSaving.value = false
    saveMessage.value = t('settings.resetSuccess')
    setTimeout(() => {
      saveMessage.value = ''
    }, 2000)
  }
}
</script>

<template>
  <div class="p-6">
    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else>
      <!-- Header with reset button -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ t('settings.global') }}
        </h2>
        <button
          @click="handleReset"
          :disabled="isSaving"
          class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          {{ t('settings.reset') }}
        </button>
      </div>

      <!-- Save message -->
      <div
        v-if="saveMessage"
        class="mb-4 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm"
      >
        {{ saveMessage }}
      </div>

      <!-- Appearance Section -->
      <div class="mb-8">
        <h3
          class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4"
        >
          {{ t('settings.appearance') }}
        </h3>

        <div
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4"
        >
          <!-- Theme Setting -->
          <SettingItem
            :label="t('settings.theme')"
            :description="
              t('settings.theme' + localTheme.charAt(0).toUpperCase() + localTheme.slice(1))
            "
          >
            <ThemeToggle v-model="localTheme" variant="select" />
          </SettingItem>

          <!-- Language Setting -->
          <SettingItem :label="t('settings.language')">
            <LanguageSelector v-model="localLanguage" variant="select" />
          </SettingItem>

          <!-- Font Size Setting -->
          <SettingItem :label="t('settings.fontSize')">
            <select
              v-model="localFontSize"
              class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="small">{{ t('settings.fontSizeSmall') }}</option>
              <option value="medium">{{ t('settings.fontSizeMedium') }}</option>
              <option value="large">{{ t('settings.fontSizeLarge') }}</option>
            </select>
          </SettingItem>
        </div>
      </div>

      <!-- IDE Section -->
      <div class="mb-8">
        <h3
          class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4"
        >
          {{ t('settings.ide') }}
        </h3>

        <div
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-4"
        >
          <SettingItem
            :label="t('settings.defaultIde')"
            :description="t('settings.defaultIdeDescription')"
          >
            <IdeSelector v-model="localDefaultIde" :disabled="isSaving" />
          </SettingItem>
        </div>
      </div>

      <!-- Markdown Theme Section -->
      <div class="mb-8">
        <h3
          class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4"
        >
          {{ t('theme.markdownThemes') }}
        </h3>

        <div
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-4"
        >
          <MarkdownThemeSelector v-model="localMarkdownTheme" :disabled="isSaving" />
        </div>
      </div>
    </div>
  </div>
</template>
