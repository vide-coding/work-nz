import { ref, readonly } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import type { GlobalSettings, WorkspaceSettingsOverride } from '../types/settings'
import type { WorkspaceSettings } from '../types'
import { workspaceApi } from './useApi'

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  themeMode: 'system',
  language: 'zh-CN',
  fontSize: 'medium',
}

// Global settings state
const globalSettingsState = ref<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS)
const globalSettingsLoaded = ref(false)

// Workspace settings state
const workspaceSettingsState = ref<WorkspaceSettings | null>(null)
const workspaceSettingsLoaded = ref(false)

/**
 * Load global settings from user directory config file
 */
async function loadGlobalSettings(): Promise<GlobalSettings> {
  try {
    const settings = await invoke<GlobalSettings>('global_settings_get')
    globalSettingsState.value = { ...DEFAULT_GLOBAL_SETTINGS, ...settings }
    globalSettingsLoaded.value = true
    return globalSettingsState.value
  } catch (error) {
    // If error (e.g., file doesn't exist), return defaults
    globalSettingsState.value = DEFAULT_GLOBAL_SETTINGS
    globalSettingsLoaded.value = true
    return DEFAULT_GLOBAL_SETTINGS
  }
}

/**
 * Update global settings and persist to config file
 */
async function updateGlobalSettings(patch: Partial<GlobalSettings>): Promise<GlobalSettings> {
  const updated = { ...globalSettingsState.value, ...patch }
  await invoke('global_settings_update', { patch })
  globalSettingsState.value = updated
  return updated
}

/**
 * Reset global settings to defaults
 */
async function resetGlobalSettings(): Promise<GlobalSettings> {
  globalSettingsState.value = DEFAULT_GLOBAL_SETTINGS
  await invoke('global_settings_update', { patch: DEFAULT_GLOBAL_SETTINGS })
  return DEFAULT_GLOBAL_SETTINGS
}

/**
 * Load current workspace settings
 */
async function loadWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  try {
    const settings = await workspaceApi.getSettings()
    workspaceSettingsState.value = settings
    workspaceSettingsLoaded.value = true
    return settings
  } catch (error) {
    workspaceSettingsState.value = null
    workspaceSettingsLoaded.value = true
    return null
  }
}

/**
 * Update workspace settings
 */
async function updateWorkspaceSettings(
  patch: Partial<WorkspaceSettings>
): Promise<WorkspaceSettings | null> {
  try {
    const settings = await workspaceApi.updateSettings(patch)
    workspaceSettingsState.value = settings
    return settings
  } catch (error) {
    console.error('Failed to update workspace settings:', error)
    return null
  }
}

/**
 * Get workspace settings override
 */
function getWorkspaceOverride(): WorkspaceSettingsOverride {
  const global = globalSettingsState.value
  const workspace = workspaceSettingsState.value

  if (!workspace) {
    return {
      useGlobalTheme: true,
      useGlobalLanguage: true,
    }
  }

  return {
    useGlobalTheme: !workspace.themeMode || workspace.themeMode === global.themeMode,
    useGlobalLanguage: true, // Language is always from global for now
    themeMode: workspace.themeMode,
  }
}

/**
 * Get effective theme (considering workspace override)
 */
function getEffectiveTheme(): GlobalSettings['themeMode'] {
  const workspace = workspaceSettingsState.value
  if (workspace?.themeMode && workspace.themeMode !== 'system') {
    return workspace.themeMode
  }
  return globalSettingsState.value.themeMode
}

/**
 * Get effective language
 */
function getEffectiveLanguage(): GlobalSettings['language'] {
  return globalSettingsState.value.language
}

export function useSettings() {
  return {
    // Global settings
    globalSettings: readonly(globalSettingsState),
    globalSettingsLoaded: readonly(globalSettingsLoaded),
    loadGlobalSettings,
    updateGlobalSettings,
    resetGlobalSettings,

    // Workspace settings
    workspaceSettings: readonly(workspaceSettingsState),
    workspaceSettingsLoaded: readonly(workspaceSettingsLoaded),
    loadWorkspaceSettings,
    updateWorkspaceSettings,

    // Computed helpers
    getWorkspaceOverride,
    getEffectiveTheme,
    getEffectiveLanguage,
  }
}
