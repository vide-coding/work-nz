<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen } from 'lucide-vue-next'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import SettingItem from './SettingItem.vue'
import { useSettings } from '@/composables/useSettings'
import { workspaceApi } from '@/composables/useApi'
import type { ThemeMode } from '@/types/settings'

const { t } = useI18n()
const {
  globalSettings,
  workspaceSettings,
  loadGlobalSettings,
  loadWorkspaceSettings,
  updateWorkspaceSettings,
} = useSettings()

const isLoading = ref(true)
const isSaving = ref(false)
const currentWorkspace = ref<{ path: string; alias?: string } | null>(null)

// Local state
const localUseGlobalTheme = ref(true)
const localTheme = ref<ThemeMode>('system')

onMounted(async () => {
  await loadGlobalSettings()
  await loadWorkspaceSettings()

  // Get current workspace
  try {
    const ws = await workspaceApi.getCurrent()
    if (ws) {
      currentWorkspace.value = { path: ws.path, alias: ws.alias }
    }
  } catch (error) {
    console.error('Failed to get current workspace:', error)
  }

  // Initialize local state from workspace settings
  if (workspaceSettings.value?.themeMode) {
    localUseGlobalTheme.value = false
    localTheme.value = workspaceSettings.value.themeMode
  } else {
    localUseGlobalTheme.value = true
    localTheme.value = globalSettings.value.themeMode
  }

  isLoading.value = false
})

const effectiveTheme = computed(() => {
  if (localUseGlobalTheme.value) {
    return globalSettings.value.themeMode
  }
  return localTheme.value
})

async function handleThemeOverrideChange(override: boolean) {
  localUseGlobalTheme.value = override
  isSaving.value = true

  if (override) {
    // Clear workspace-specific theme to inherit global
    await updateWorkspaceSettings({})
  } else {
    // Set workspace-specific theme
    await updateWorkspaceSettings({ themeMode: localTheme.value })
  }

  isSaving.value = false
}

async function handleThemeChange(theme: ThemeMode) {
  if (!localUseGlobalTheme.value) {
    isSaving.value = true
    await updateWorkspaceSettings({ themeMode: theme })
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
      <!-- Header -->
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {{ t('settings.workspace') }}
        </h2>
      </div>

      <!-- Workspace Info -->
      <div class="mb-8">
        <h3
          class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4"
        >
          {{ t('settings.currentWorkspace') }}
        </h3>

        <div
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-4"
        >
          <div v-if="currentWorkspace" class="flex items-center gap-3">
            <FolderOpen class="w-5 h-5 text-gray-400" />
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                {{ currentWorkspace.alias || currentWorkspace.path }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {{ currentWorkspace.path }}
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-gray-500 dark:text-gray-400">
            {{ t('settings.noWorkspace') }}
          </div>
        </div>
      </div>

      <!-- Theme Override Section -->
      <div v-if="currentWorkspace" class="mb-8">
        <h3
          class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4"
        >
          {{ t('settings.appearance') }}
        </h3>

        <div
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4"
        >
          <!-- Use Global Theme Toggle -->
          <SettingItem
            :label="t('settings.inheritGlobal')"
            :description="
              t('settings.theme') +
              ': ' +
              t(
                'settings.theme' +
                  globalSettings.themeMode.charAt(0).toUpperCase() +
                  globalSettings.themeMode.slice(1)
              )
            "
          >
            <button
              @click="handleThemeOverrideChange(!localUseGlobalTheme)"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                localUseGlobalTheme ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700',
              ]"
              :disabled="isSaving"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  localUseGlobalTheme ? 'translate-x-5' : 'translate-x-0',
                ]"
              />
            </button>
          </SettingItem>

          <!-- Workspace-specific Theme (only shown when not using global) -->
          <SettingItem
            v-if="!localUseGlobalTheme"
            :label="t('settings.override')"
            :description="
              t('settings.theme') +
              ': ' +
              t('settings.theme' + localTheme.charAt(0).toUpperCase() + localTheme.slice(1))
            "
          >
            <ThemeToggle
              v-model="localTheme"
              variant="select"
              @update:modelValue="handleThemeChange"
            />
          </SettingItem>
        </div>
      </div>

      <!-- No workspace message -->
      <div v-if="!currentWorkspace" class="text-center py-8 text-gray-500 dark:text-gray-400">
        {{ t('settings.noWorkspace') }}
      </div>
    </div>
  </div>
</template>
