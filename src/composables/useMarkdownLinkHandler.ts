import { openUrl } from '@tauri-apps/plugin-opener'
import { useSettings } from './useSettings'
import { fsApi } from '@/composables/useApi'
import type { IdeConfig } from '@/types'

// 代码文件扩展名
const CODE_EXTENSIONS = new Set([
  'js',
  'ts',
  'jsx',
  'tsx',
  'vue',
  'svelte',
  'py',
  'rs',
  'go',
  'java',
  'cpp',
  'c',
  'h',
  'hpp',
  'css',
  'scss',
  'less',
  'html',
  'xml',
  'json',
  'yaml',
  'yml',
  'toml',
  'md',
  'txt',
  'log',
  'sh',
  'bash',
  'zsh',
  'ps1',
  'bat',
  'sql',
  'graphql',
  'gql',
  'php',
  'rb',
  'swift',
  'kt',
  'scala',
])

// 目录类型
const DIRECTORY_EXTENSIONS = new Set(['md'])

export interface LinkInfo {
  href: string
  isExternal: boolean
  isCodeFile: boolean
  isDirectory: boolean
  /** 相对于 basePath 的路径 */
  relativePath: string
  /** 完整绝对路径 */
  absolutePath: string
}

/**
 * 解析链接信息
 */
export function parseLink(href: string, basePath: string): LinkInfo | null {
  // 跳过空链接和锚点
  if (!href || href.startsWith('#')) return null

  const isExternal = href.startsWith('http://') || href.startsWith('https://')

  let absolutePath: string
  let relativePath: string

  if (isExternal) {
    // 外部链接不需要处理
    return null
  } else if (href.startsWith('/')) {
    // 绝对路径（相对于工作区）
    absolutePath = href
    relativePath = href
  } else {
    // 相对路径
    relativePath = href
    // 合并 basePath 和相对路径
    const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
    absolutePath = `${normalizedBase}/${href}`
  }

  // 获取文件扩展名
  const ext = href.split('.').pop()?.toLowerCase() || ''
  const isCodeFile = CODE_EXTENSIONS.has(ext)
  const isDirectory = DIRECTORY_EXTENSIONS.has(ext)

  return {
    href,
    isExternal,
    isCodeFile,
    isDirectory,
    relativePath,
    absolutePath,
  }
}

/**
 * 判断是否应该用 IDE 打开
 */
function shouldOpenWithIde(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  return CODE_EXTENSIONS.has(ext)
}

/**
 * 使用 IDE 打开文件（使用 Rust 后端命令）
 */
async function openWithIde(filePath: string, _ide?: IdeConfig): Promise<boolean> {
  try {
    // 使用 Rust 后端的 fs_open_external 命令，它有更高权限
    const result = await fsApi.openExternal(filePath)
    return result.ok
  } catch (error) {
    console.error('Failed to open file with IDE:', error)
    return false
  }
}

/**
 * 使用系统默认应用打开文件（使用 Rust 后端命令）
 */
async function openWithSystemDefault(filePath: string): Promise<boolean> {
  try {
    // 使用 Rust 后端的 fs_open_external 命令，它有更高权限
    const result = await fsApi.openExternal(filePath)
    return result.ok
  } catch (error) {
    console.error('Failed to open file with system default app:', error)
    return false
  }
}

/**
 * Markdown 链接处理 composable
 */
export function useMarkdownLinkHandler() {
  const { globalSettings, workspaceSettings } = useSettings()

  /**
   * 获取有效的 IDE 配置
   */
  function getEffectiveIde(): IdeConfig | undefined {
    // 优先使用工作区设置
    if (workspaceSettings.value?.defaultIde) {
      const ide = workspaceSettings.value.defaultIde
      return {
        kind: ide.kind,
        name: ide.name,
        command: ide.command,
        args: ide.args ? [...ide.args] : undefined,
        available: ide.available,
      }
    }
    // 其次使用全局设置
    if (globalSettings.value.defaultIde) {
      const ide = globalSettings.value.defaultIde
      return {
        kind: ide.kind,
        name: ide.name,
        command: ide.command,
        args: ide.args ? [...ide.args] : undefined,
        available: ide.available,
      }
    }
    return undefined
  }

  /**
   * 处理外部链接（HTTP/HTTPS）
   */
  async function handleExternalLink(url: string): Promise<void> {
    try {
      await openUrl(url)
    } catch (error) {
      console.error('Failed to open URL:', error)
    }
  }

  /**
   * 处理本地文件链接
   */
  async function handleLocalLink(linkInfo: LinkInfo): Promise<boolean> {
    try {
      if (shouldOpenWithIde(linkInfo.absolutePath)) {
        // 代码文件用 IDE 或系统默认应用打开
        const ide = getEffectiveIde()
        return await openWithIde(linkInfo.absolutePath, ide)
      } else {
        // 其他文件用系统默认应用打开
        return await openWithSystemDefault(linkInfo.absolutePath)
      }
    } catch (error) {
      console.error('Failed to handle local link:', error)
      return false
    }
  }

  /**
   * 判断链接是否是外部链接
   */
  function isExternalLink(href: string): boolean {
    return href.startsWith('http://') || href.startsWith('https://')
  }

  return {
    parseLink,
    handleExternalLink,
    handleLocalLink,
    isExternalLink,
    shouldOpenWithIde,
  }
}
