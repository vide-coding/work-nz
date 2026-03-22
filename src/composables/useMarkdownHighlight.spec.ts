import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  highlightCode,
  getLanguageFromClass,
  isLanguageSupported,
  getAvailableThemes,
  useMarkdownHighlight,
} from './useMarkdownHighlight'

// Mock shiki module
vi.mock('shiki', async () => {
  const actual = await vi.importActual('shiki')
  return {
    ...actual,
    createHighlighter: vi.fn().mockResolvedValue({
      codeToHtml: vi.fn((code: string, options: { lang: string; theme: string }) => {
        return `<pre class="shiki"><code>${code}</code></pre>`
      }),
    }),
  }
})

describe('useMarkdownHighlight', () => {
  describe('highlightCode', () => {
    it('should return empty string for empty code', async () => {
      const result = await highlightCode('', 'javascript')
      expect(result).toBe('')
    })

    it('should highlight code with valid language', async () => {
      const result = await highlightCode('const x = 1', 'javascript')
      expect(result).toContain('const x = 1')
    })

    it('should handle unknown language gracefully', async () => {
      const result = await highlightCode('some code', 'unknownlang')
      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })

    it('should normalize language aliases', async () => {
      // js -> javascript
      const result1 = await highlightCode('const x = 1', 'js')
      expect(result1).toBeDefined()

      // ts -> typescript
      const result2 = await highlightCode('const x: number = 1', 'ts')
      expect(result2).toBeDefined()
    })
  })

  describe('getLanguageFromClass', () => {
    it('should extract language from class name', () => {
      expect(getLanguageFromClass('language-javascript')).toBe('javascript')
      expect(getLanguageFromClass('language-typescript')).toBe('typescript')
      expect(getLanguageFromClass('language-python')).toBe('python')
    })

    it('should return text for no language', () => {
      expect(getLanguageFromClass('some-class')).toBe('text')
      expect(getLanguageFromClass('')).toBe('text')
    })

    it('should handle multiple classes', () => {
      expect(getLanguageFromClass('language-js highlight some-class')).toBe('js')
    })
  })

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(isLanguageSupported('javascript')).toBe(true)
      expect(isLanguageSupported('typescript')).toBe(true)
      expect(isLanguageSupported('python')).toBe(true)
      expect(isLanguageSupported('rust')).toBe(true)
      expect(isLanguageSupported('go')).toBe(true)
    })

    it('should return true for language aliases', () => {
      expect(isLanguageSupported('js')).toBe(true)
      expect(isLanguageSupported('ts')).toBe(true)
      expect(isLanguageSupported('py')).toBe(true)
      expect(isLanguageSupported('rb')).toBe(true)
    })

    it('should return false for unsupported languages', () => {
      expect(isLanguageSupported('unknownlang')).toBe(false)
      expect(isLanguageSupported('notasupportedlanguage')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(isLanguageSupported('JavaScript')).toBe(true)
      expect(isLanguageSupported('JAVASCRIPT')).toBe(true)
      expect(isLanguageSupported('Python')).toBe(true)
    })
  })

  describe('getAvailableThemes', () => {
    it('should return available theme names', () => {
      const themes = getAvailableThemes()
      expect(themes).toContain('light')
      expect(themes).toContain('dark')
      expect(themes).toContain('nord')
      expect(themes).toContain('solarized')
    })

    it('should return array', () => {
      const themes = getAvailableThemes()
      expect(Array.isArray(themes)).toBe(true)
    })
  })

  describe('useMarkdownHighlight composable', () => {
    it('should return all required functions', () => {
      const result = useMarkdownHighlight()
      expect(result.highlightCode).toBeDefined()
      expect(result.getLanguageFromClass).toBeDefined()
      expect(result.isLanguageSupported).toBeDefined()
      expect(result.getAvailableThemes).toBeDefined()
      expect(result.supportedLanguages).toBeDefined()
    })

    it('should return supported languages array', () => {
      const result = useMarkdownHighlight()
      expect(Array.isArray(result.supportedLanguages)).toBe(true)
      expect(result.supportedLanguages).toContain('javascript')
      expect(result.supportedLanguages).toContain('typescript')
    })
  })
})
