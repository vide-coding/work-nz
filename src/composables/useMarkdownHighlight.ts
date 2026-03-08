import { createHighlighter, type Highlighter } from 'shiki'

// Language support
const supportedLanguages = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'ruby',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'html',
  'css',
  'scss',
  'less',
  'json',
  'yaml',
  'toml',
  'xml',
  'markdown',
  'bash',
  'shell',
  'powershell',
  'sql',
  'graphql',
  'dockerfile',
  'vue',
  'svelte',
  'php',
]

// Theme configurations - matching CSS variables
const themeMap: Record<string, string> = {
  light: 'github-light',
  dark: 'github-dark',
  nord: 'nord',
  solarized: 'solarized-dark',
}

// Singleton highlighter instance
let highlighter: Highlighter | null = null

// Initialize highlighter
async function initHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter

  highlighter = await createHighlighter({
    themes: ['github-light', 'github-dark', 'nord', 'solarized-dark'],
    langs: supportedLanguages,
  })

  return highlighter
}

// Code highlight function using Shiki
export async function highlightCode(code: string, language: string): Promise<string> {
  if (!code) return ''

  const lang = normalizeLanguage(language)

  try {
    const hl = await initHighlighter()
    const theme = 'github-light' // Default theme, can be customized

    const html = hl.codeToHtml(code, {
      lang,
      theme,
    })

    // Extract just the highlighted code, strip outer wrapper
    // Shiki returns: <pre class="shiki ..."><code>...</code></pre>
    const match = html.match(/<code[^>]*>([\s\S]*)<\/code>/)
    return match ? match[1] : escapeHtml(code)
  } catch (error) {
    console.warn(`Failed to highlight code with Shiki (lang: ${lang}):`, error)
    return escapeHtml(code)
  }
}

// Normalize language alias to supported language
function normalizeLanguage(lang: string): string {
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    sh: 'bash',
    shell: 'bash',
    yml: 'yaml',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    cpp: 'cpp',
    csharp: 'csharp',
    cs: 'csharp',
    vue: 'vue',
  }

  const normalized = lang?.toLowerCase() || ''
  return languageMap[normalized] || normalized || 'text'
}

// Escape HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Extract language from class name
export function getLanguageFromClass(className: string): string {
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : 'text'
}

// Check if language is supported
export function isLanguageSupported(language: string): boolean {
  return supportedLanguages.includes(normalizeLanguage(language))
}

// Get available themes
export function getAvailableThemes(): string[] {
  return Object.keys(themeMap)
}

// Composable export
export function useMarkdownHighlight() {
  return {
    highlightCode,
    getLanguageFromClass,
    isLanguageSupported,
    getAvailableThemes,
    supportedLanguages,
  }
}
