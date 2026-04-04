<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SettingItem from './SettingItem.vue'
import IdeSelector from './IdeSelector.vue'
import { useSettings } from '@/composables/useSettings'
import type { FontSize } from '@/types/settings'
import type { IdeConfig } from '@/types'
import type { MarkdownThemeConfig } from '@/types/markdown'
import MarkdownThemeSelector from '@/components/MarkdownThemeSelector.vue'

const { t } = useI18n()
const { globalSettings, loadGlobalSettings, updateGlobalSettings, resetGlobalSettings } =
  useSettings()

const isLoading = ref(true)
const isSaving = ref(false)

// Local state for two-way binding
const localFontSize = ref<FontSize>('medium')
const localDefaultIde = ref<IdeConfig | undefined>(undefined)
const localMarkdownTheme = ref<MarkdownThemeConfig>({
  mode: 'separate',
  lightTheme: 'light',
  darkTheme: 'dark',
})
const localAutoFetchGitProjects = ref(true)

onMounted(async () => {
  await loadGlobalSettings()
  if (globalSettings.value) {
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
    // Load auto-fetch setting
    localAutoFetchGitProjects.value = globalSettings.value.autoFetchGitProjects ?? true
  }
  isLoading.value = false
})

// Watch for font size changes
watch(localFontSize, async (newFontSize) => {
  isSaving.value = true
  await updateGlobalSettings({ fontSize: newFontSize })
  isSaving.value = false
})

// Watch for IDE changes
watch(localDefaultIde, async (newIde) => {
  isSaving.value = true
  await updateGlobalSettings({ defaultIde: newIde })
  isSaving.value = false
})

// Watch for markdown theme changes
watch(
  localMarkdownTheme,
  async (newThemeConfig) => {
    isSaving.value = true
    await updateGlobalSettings({ markdownTheme: newThemeConfig })
    isSaving.value = false
  },
  { deep: true }
)

// Watch for auto-fetch git projects changes
watch(localAutoFetchGitProjects, async (newValue) => {
  isSaving.value = true
  await updateGlobalSettings({ autoFetchGitProjects: newValue })
  isSaving.value = false
})

async function handleReset() {
  if (confirm(t('settings.resetConfirm'))) {
    isSaving.value = true
    const defaults = await resetGlobalSettings()
    localFontSize.value = defaults.fontSize
    localDefaultIde.value = defaults.defaultIde

    isSaving.value = false
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

      <!-- Git Section -->
      <div class="mb-8">
        <h3
          class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4"
        >
          {{ t('git.title') }}
        </h3>

        <div
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4"
        >
          <SettingItem
            :label="t('settings.autoFetchGitProjects')"
            :description="t('settings.autoFetchGitProjectsDesc')"
          >
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="localAutoFetchGitProjects"
                type="checkbox"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"
              ></div>
            </label>
          </SettingItem>
        </div>
      </div>
    </div>
  </div>
</template>
