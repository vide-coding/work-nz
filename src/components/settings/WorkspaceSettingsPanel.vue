<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderOpen } from 'lucide-vue-next'
import ThemeToggle from '@/components/common/ThemeToggle.vue'
import SettingItem from './SettingItem.vue'
import IdeSelector from './IdeSelector.vue'
import { useSettings } from '@/composables/useSettings'
import { workspaceApi } from '@/composables/useApi'
import type { IdeConfig } from '@/types'

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
const saveMessage = ref('')

// Local state
const localUseGlobalTheme = ref(true)
const localTheme = ref<'light' | 'dark' | 'system'>('system')
const localUseGlobalIde = ref(true)
const localDefaultIde = ref<IdeConfig | undefined>(undefined)
const localUseGlobalAutoFetch = ref(true)
const localAutoFetchGitProjects = ref(true)

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
    // workspaceSettings.themeMode may include 'custom', convert to valid theme
    const wsTheme = workspaceSettings.value.themeMode
    localTheme.value = (wsTheme === 'custom' ? 'system' : wsTheme) as 'light' | 'dark' | 'system'
  } else {
    localUseGlobalTheme.value = true
    // globalSettings.themeMode is already 'light' | 'dark' | 'system'
    localTheme.value = globalSettings.value.themeMode
  }

  // Initialize IDE state from workspace settings
  if (workspaceSettings.value?.defaultIde) {
    localUseGlobalIde.value = false
    localDefaultIde.value = {
      kind: workspaceSettings.value.defaultIde.kind,
      name: workspaceSettings.value.defaultIde.name,
      command: workspaceSettings.value.defaultIde.command,
      args: workspaceSettings.value.defaultIde.args
        ? [...workspaceSettings.value.defaultIde.args]
        : undefined,
    }
  } else {
    localUseGlobalIde.value = true
    // Use global IDE as default
    if (globalSettings.value.defaultIde) {
      localDefaultIde.value = {
        kind: globalSettings.value.defaultIde.kind,
        name: globalSettings.value.defaultIde.name,
        command: globalSettings.value.defaultIde.command,
        args: globalSettings.value.defaultIde.args
          ? [...globalSettings.value.defaultIde.args]
          : undefined,
      }
    } else {
      localDefaultIde.value = undefined
    }
  }

  // Initialize auto-fetch state from workspace settings
  if (workspaceSettings.value?.autoFetchGitProjects !== undefined) {
    localUseGlobalAutoFetch.value = false
    localAutoFetchGitProjects.value = workspaceSettings.value.autoFetchGitProjects
  } else {
    localUseGlobalAutoFetch.value = true
    // Use global setting as default
    localAutoFetchGitProjects.value = globalSettings.value.autoFetchGitProjects ?? true
  }

  isLoading.value = false
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

async function handleThemeChange(theme: 'light' | 'dark' | 'system') {
  if (!localUseGlobalTheme.value) {
    isSaving.value = true
    await updateWorkspaceSettings({ themeMode: theme })
    isSaving.value = false
  }
}

async function handleIdeOverrideChange(useGlobal: boolean) {
  localUseGlobalIde.value = useGlobal
  isSaving.value = true

  if (useGlobal) {
    // Clear workspace-specific IDE to inherit global
    await updateWorkspaceSettings({})
  } else {
    // Set workspace-specific IDE
    if (localDefaultIde.value) {
      await updateWorkspaceSettings({ defaultIde: localDefaultIde.value })
    }
  }

  showSaveMessage()
  isSaving.value = false
}

async function handleIdeChange(ide: IdeConfig | undefined) {
  localDefaultIde.value = ide
  if (!localUseGlobalIde.value && ide) {
    isSaving.value = true
    await updateWorkspaceSettings({ defaultIde: ide })
    showSaveMessage()
    isSaving.value = false
  }
}

async function handleAutoFetchOverrideChange(useGlobal: boolean) {
  localUseGlobalAutoFetch.value = useGlobal
  isSaving.value = true

  if (useGlobal) {
    // Clear workspace-specific auto-fetch to inherit global
    await updateWorkspaceSettings({})
  } else {
    // Set workspace-specific auto-fetch
    await updateWorkspaceSettings({ autoFetchGitProjects: localAutoFetchGitProjects.value })
  }

  showSaveMessage()
  isSaving.value = false
}

async function handleAutoFetchChange(value: boolean) {
  localAutoFetchGitProjects.value = value
  if (!localUseGlobalAutoFetch.value) {
    isSaving.value = true
    await updateWorkspaceSettings({ autoFetchGitProjects: value })
    showSaveMessage()
    isSaving.value = false
  }
}

function showSaveMessage() {
  saveMessage.value = t('settings.saved')
  setTimeout(() => {
    saveMessage.value = ''
  }, 2000)
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

      <!-- Save message -->
      <div
        v-if="saveMessage"
        class="mb-4 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm"
      >
        {{ saveMessage }}
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

      <!-- IDE Section -->
      <div v-if="currentWorkspace" class="mb-8">
        <h3
          class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4"
        >
          {{ t('settings.ide') }}
        </h3>

        <div
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4"
        >
          <!-- Use Global IDE Toggle -->
          <SettingItem
            :label="t('settings.inheritGlobal')"
            :description="
              t('settings.defaultIde') +
              ': ' +
              (globalSettings.defaultIde?.name || t('settings.noIdesDetected'))
            "
          >
            <button
              @click="handleIdeOverrideChange(!localUseGlobalIde)"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                localUseGlobalIde ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700',
              ]"
              :disabled="isSaving"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  localUseGlobalIde ? 'translate-x-5' : 'translate-x-0',
                ]"
              />
            </button>
          </SettingItem>

          <!-- Workspace-specific IDE (only shown when not using global) -->
          <div v-if="!localUseGlobalIde" class="py-4">
            <IdeSelector
              v-model="localDefaultIde"
              :disabled="isSaving"
              @update:modelValue="handleIdeChange"
            />
          </div>
        </div>
      </div>

      <!-- Git Auto-fetch Section -->
      <div v-if="currentWorkspace" class="mb-8">
        <h3
          class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-4"
        >
          {{ t('git.title') }}
        </h3>

        <div
          class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4"
        >
          <!-- Use Global Auto-fetch Toggle -->
          <SettingItem
            :label="t('settings.inheritGlobal')"
            :description="
              t('settings.autoFetchGitProjects') +
              ': ' +
              (globalSettings.autoFetchGitProjects ? t('common.yes') : t('common.no'))
            "
          >
            <button
              @click="handleAutoFetchOverrideChange(!localUseGlobalAutoFetch)"
              :class="[
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
                localUseGlobalAutoFetch ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700',
              ]"
              :disabled="isSaving"
            >
              <span
                :class="[
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  localUseGlobalAutoFetch ? 'translate-x-5' : 'translate-x-0',
                ]"
              />
            </button>
          </SettingItem>

          <!-- Workspace-specific Auto-fetch (only shown when not using global) -->
          <SettingItem
            v-if="!localUseGlobalAutoFetch"
            :label="t('settings.autoFetchGitProjects')"
            :description="t('settings.autoFetchGitProjectsDesc')"
          >
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="localAutoFetchGitProjects"
                type="checkbox"
                class="sr-only peer"
                @change="handleAutoFetchChange(localAutoFetchGitProjects)"
              />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"
              ></div>
            </label>
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
