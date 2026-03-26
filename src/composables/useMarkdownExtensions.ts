import katex from 'katex'
import { marked } from 'marked'

/**
 * Composable for handling markdown extensions like mermaid diagrams and math formulas
 */

let mermaidInitialized = false
let mermaidModule: any = null

// Initialize mermaid lazily
async function initMermaid() {
  if (mermaidInitialized) return mermaidModule
  const mermaid = await import('mermaid')
  mermaidModule = mermaid.default || mermaid
  mermaidModule.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontFamily: 'inherit',
  })
  mermaidInitialized = true
  return mermaidModule
}

// Render math formulas with KaTeX
export function renderMath(text: string, displayMode: boolean): string {
  try {
    return katex.renderToString(text, {
      displayMode,
      throwOnError: false,
      output: 'html',
    })
  } catch (error) {
    console.error('KaTeX rendering error:', error)
    return `<span class="math-error" title="${error}">${escapeHtml(text)}</span>`
  }
}

// Escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Process inline math ($...$)
function processInlineMath(html: string): string {
  // Match inline math: $...$ but not $$...$$
  const inlineMathRegex = /\$([^$\n]+?)\$/g
  return html.replace(inlineMathRegex, (_, math) => {
    return renderMath(math.trim(), false)
  })
}

// Process block math ($$...$$)
function processBlockMath(html: string): string {
  // Match block math: $$...$$
  const blockMathRegex = /\$\$([^$]+?)\$\$/g
  return html.replace(blockMathRegex, (_, math) => {
    return `<div class="math-block">${renderMath(math.trim(), true)}</div>`
  })
}

// Process mermaid code blocks
async function processMermaid(html: string): Promise<string> {
  const mermaidRegex = /<pre class="language-mermaid"><code[^>]*>([\s\S]*?)<\/code><\/pre>/g

  const matches: Array<{ code: string; start: number; end: number }> = []
  let match

  while ((match = mermaidRegex.exec(html)) !== null) {
    const fullMatch = match[0]
    const code = decodeHtmlEntities(match[1])
    matches.push({ code, start: match.index, end: match.index + fullMatch.length })
  }

  if (matches.length === 0) return html

  const mermaid = await initMermaid()
  let result = html

  // Process from end to start to preserve indices
  for (const m of matches.reverse()) {
    try {
      const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const { svg } = await mermaid.render(id, m.code)
      const newBlock = `<div class="mermaid">${svg}</div>`
      result = result.slice(0, m.start) + newBlock + result.slice(m.end)
    } catch (error) {
      console.error('Mermaid rendering error:', error)
      const errorMsg = escapeHtml(String(error))
      const newBlock = `<div class="mermaid-error" title="${errorMsg}">
        <div class="mermaid-error-title">Diagram Error</div>
        <pre class="mermaid-error-code">${escapeHtml(m.code)}</pre>
      </div>`
      result = result.slice(0, m.start) + newBlock + result.slice(m.end)
    }
  }

  return result
}

// HTML entity decode
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

// Main function to process markdown with extensions
export async function processMarkdownExtensions(html: string): Promise<string> {
  // 1. Process block math first ($$...$$)
  let result = processBlockMath(html)

  // 2. Process inline math ($...$)
  result = processInlineMath(result)

  // 3. Process mermaid diagrams
  result = await processMermaid(result)

  return result
}

// Setup marked extensions for math (inline math in text)
export function setupMathExtension() {
  // Marked extension for detecting math patterns during parsing
  // This is handled in post-processing instead
}

// Get mermaid theme based on markdown theme
export function getMermaidTheme(markdownTheme: string): string {
  const themeMap: Record<string, string> = {
    light: 'default',
    dark: 'dark',
    github: 'default',
    nord: 'neutral',
    solarized: 'neutral',
  }
  return themeMap[markdownTheme] || 'default'
}
