// Global settings types for app configuration

export type LanguageCode = 'zh-CN' | 'en-US'

export type FontSize = 'small' | 'medium' | 'large'

/**
 * Global application settings stored in user directory
 * These settings apply across all workspaces
 */
export type GlobalSettings = {
  themeMode: 'light' | 'dark' | 'system'
  language: LanguageCode
  fontSize: FontSize
}

/**
 * Workspace-specific settings override
 * Allows individual workspaces to override global settings
 */
export type WorkspaceSettingsOverride = {
  useGlobalTheme: boolean
  useGlobalLanguage: boolean
  themeMode?: 'light' | 'dark' | 'system'
  language?: LanguageCode
}

/**
 * API response for global settings operations
 */
export type GlobalSettingsResult = {
  ok: boolean
  settings?: GlobalSettings
  error?: string
}
