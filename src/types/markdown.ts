import type { ThemeName } from './theme'

// Markdown 主题配置类型
export type MarkdownThemeMode = 'unified' | 'separate'

export interface MarkdownThemeConfig {
  mode: MarkdownThemeMode
  // 统一主题（当 mode 为 'unified' 时使用）
  unifiedTheme?: ThemeName
  // 亮色主题（当 mode 为 'separate' 时使用）
  lightTheme?: ThemeName
  // 暗色主题（当 mode 为 'separate' 时使用）
  darkTheme?: ThemeName
}

// 默认配置
export const DEFAULT_MARKDOWN_THEME_CONFIG: MarkdownThemeConfig = {
  mode: 'separate',
  lightTheme: 'light',
  darkTheme: 'dark',
}
