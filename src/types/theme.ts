// 主题类型定义
export type ThemeName = 'light' | 'dark' | 'github' | 'nord' | 'solarized'

// 主题配置接口
export interface ThemeConfig {
  name: ThemeName
  label: string
  icon: string
  className: string
}

// 可用主题列表
export const AVAILABLE_THEMES: ThemeConfig[] = [
  { name: 'light', label: 'theme.light', icon: 'sun', className: 'theme-light' },
  { name: 'dark', label: 'theme.dark', icon: 'moon', className: 'theme-dark' },
  { name: 'github', label: 'theme.github', icon: 'github', className: 'theme-github' },
  { name: 'nord', label: 'theme.nord', icon: 'snowflake', className: 'theme-nord' },
  { name: 'solarized', label: 'theme.solarized', icon: 'sun-dim', className: 'theme-solarized' },
]

// 代码高亮主题映射
export const CODE_THEME_MAP: Record<ThemeName, string> = {
  light: 'github-light',
  dark: 'github-dark',
  github: 'github-light',
  nord: 'nord',
  solarized: 'solarized-dark',
}
