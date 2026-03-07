import type { ThemeName } from '@/types/theme'
import { CODE_THEME_MAP } from '@/types/theme'

// 代码高亮功能已禁用
// 如需重新启用，可以集成 shiki 或 highlight.js

// 语言规则定义（已禁用）
const languageRules: Record<string, never> = {}

// 代码高亮函数（已禁用，直接返回转义后的代码）
export function highlightCode(code: string, _language: string): string {
  if (!code) return ''
  // 直接返回转义后的代码，不做高亮处理
  return escapeHtml(code)
}

// 转义 HTML 特殊字符
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 从语言类名中提取语言
export function getLanguageFromClass(className: string): string {
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : 'text'
}

// 检查语言是否支持（已禁用，始终返回 false）
export function isLanguageSupported(_language: string): boolean {
  return false
}

// Composable 导出
export function useMarkdownHighlight() {
  return {
    highlightCode,
    getLanguageFromClass,
    isLanguageSupported,
    languageRules,
  }
}
