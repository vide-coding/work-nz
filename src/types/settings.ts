// Global settings types for app configuration

import type { IdeConfig } from './index'
import type { MarkdownThemeConfig } from './markdown'
import type { LocaleCode } from './locale'

export type { LocaleCode as LanguageCode } from './locale'

// Re-export ThemeMode from index for convenience
export type { ThemeMode } from './index'

export type FontSize = 'small' | 'medium' | 'large'

/**
 * Global application settings stored in user directory
 * These settings apply across all workspaces
 */
export type GlobalSettings = {
  themeMode: 'light' | 'dark' | 'system'
  language: LocaleCode
  fontSize: FontSize
  defaultIde?: IdeConfig
  markdownTheme?: MarkdownThemeConfig
  autoFetchGitProjects?: boolean
}

/**
 * Workspace-specific settings override
 * Allows individual workspaces to override global settings
 */
export type WorkspaceSettingsOverride = {
  useGlobalTheme: boolean
  useGlobalLanguage: boolean
  useGlobalIde: boolean
  themeMode?: 'light' | 'dark' | 'system'
  language?: LocaleCode
  defaultIde?: IdeConfig
}
