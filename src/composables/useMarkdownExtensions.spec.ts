import { describe, it, expect, beforeAll } from 'vitest'
import { renderMath, processMarkdownExtensions } from './useMarkdownExtensions'

// Mock DOM for decodeHtmlEntities
describe('useMarkdownExtensions', () => {
  beforeAll(() => {
    // Ensure document is available
    if (typeof document === 'undefined') {
      // Minimal DOM mock for Node.js test environment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(global as any).document = {
        createElement: (tag: string) => globalThis.document.createElement(tag),
      }
    }
  })

  describe('renderMath', () => {
    it('should render inline math with KaTeX', () => {
      const result = renderMath('E = mc^2', false)
      expect(result).toContain('katex')
      // KaTeX renders individual characters with math classes
      expect(result).toContain('mathnormal')
      expect(result).not.toContain('katex-display')
    })

    it('should render block math with KaTeX', () => {
      const result = renderMath('\\int_0^\\infty e^{-x^2} dx', true)
      expect(result).toContain('katex')
      // Block math uses katex-display class
      expect(result).toContain('katex-display')
    })

    it('should handle invalid math gracefully', () => {
      const result = renderMath('\\invalid{command}', false)
      // KaTeX renders errors inline even with throwOnError: false
      expect(result).toBeDefined()
    })

    it('should render fractions correctly', () => {
      const result = renderMath('\\frac{a}{b}', false)
      expect(result).toContain('katex')
      expect(result).toContain('a')
      expect(result).toContain('b')
    })

    it('should render Greek letters', () => {
      const result = renderMath('\\alpha + \\beta = \\gamma', false)
      expect(result).toContain('katex')
    })
  })

  describe('processMarkdownExtensions', () => {
    it('should process inline math $...$', async () => {
      const html = '<p>The equation $E = mc^2$ is famous.</p>'
      const result = await processMarkdownExtensions(html)
      expect(result).toContain('katex')
      expect(result).not.toContain('$E = mc^2$')
    })

    it('should process block math $$...$$', async () => {
      const html = '<p>Here is a formula:</p><p>$$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$</p>'
      const result = await processMarkdownExtensions(html)
      expect(result).toContain('katex')
      expect(result).toContain('math-block')
      expect(result).not.toContain('$$')
    })

    it('should handle multiple inline math expressions', async () => {
      const html = '<p>$a$ plus $b$ equals $c$</p>'
      const result = await processMarkdownExtensions(html)
      expect(result).toContain('katex')
      const katexCount = (result.match(/katex/g) || []).length
      expect(katexCount).toBeGreaterThanOrEqual(3)
    })

    it('should process math expressions regardless of context', async () => {
      // Note: Current implementation processes math in all contexts
      // This may be improved in the future to skip code blocks
      const html = '<pre><code>$E = mc^2$</code></pre>'
      const result = await processMarkdownExtensions(html)
      // Math is processed even in code blocks in current implementation
      expect(result).toContain('katex')
    })

    it('should process mermaid code blocks', async () => {
      const html = '<pre class="language-mermaid"><code>graph TD; A-->B;</code></pre>'
      const result = await processMarkdownExtensions(html)
      // Mermaid should be processed (rendered or error)
      expect(result).toContain('mermaid')
    })

    it('should handle empty input', async () => {
      const result = await processMarkdownExtensions('')
      expect(result).toBe('')
    })

    it('should handle HTML without math or mermaid', async () => {
      const html = '<p>Just a normal paragraph.</p>'
      const result = await processMarkdownExtensions(html)
      expect(result).toBe(html)
    })

    it('should handle complex quadratic formula', async () => {
      const html = '<p>The solution is $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$</p>'
      const result = await processMarkdownExtensions(html)
      expect(result).toContain('katex')
      expect(result).toContain('math-block')
    })

    it('should handle inline math with special characters', async () => {
      const html = '<p>Let $\\vec{v} = \\langle x, y, z \\rangle$ be a vector.</p>'
      const result = await processMarkdownExtensions(html)
      expect(result).toContain('katex')
    })

    it('should process multiple mermaid diagrams', async () => {
      const html = `
        <pre class="language-mermaid"><code>graph TD; A-->B;</code></pre>
        <p>Some text</p>
        <pre class="language-mermaid"><code>graph LR; X-->Y;</code></pre>
      `
      const result = await processMarkdownExtensions(html)
      expect(result).toContain('mermaid')
    })

    it('should preserve non-mermaid code blocks', async () => {
      const html = '<pre class="language-javascript"><code>const x = 1;</code></pre>'
      const result = await processMarkdownExtensions(html)
      expect(result).toContain('language-javascript')
      expect(result).toContain('const x = 1;')
    })
  })
})
