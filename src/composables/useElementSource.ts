import { ref } from 'vue'
import type { ElementInfo, ElementSourceInfo } from 'element-source'
import {
  resolveElementInfo,
  resolveSource,
  resolveStack,
  resolveComponentName,
  formatStack,
  formatStackFrame,
} from 'element-source'

export interface ElementSourceResult {
  tagName: string
  componentName: string | null
  filePath: string | null
  lineNumber: number | null
  columnNumber: number | null
  stackFormatted: string
  rawInfo: ElementInfo | null
}

export function useElementSource() {
  const isLoading = ref(false)
  const lastResult = ref<ElementSourceResult | null>(null)
  const error = ref<string | null>(null)

  /**
   * Resolve element source information from a DOM event target
   */
  async function resolveFromEvent(event: MouseEvent): Promise<ElementSourceResult | null> {
    const target = event.target
    if (!(target instanceof Element)) {
      error.value = 'Target is not a DOM element'
      return null
    }
    return resolveFromElement(target)
  }

  /**
   * Resolve element source information from a DOM element
   */
  async function resolveFromElement(element: Element): Promise<ElementSourceResult | null> {
    isLoading.value = true
    error.value = null

    try {
      const info = await resolveElementInfo(element)

      const result: ElementSourceResult = {
        tagName: info.tagName,
        componentName: info.componentName,
        filePath: info.source?.filePath ?? null,
        lineNumber: info.source?.lineNumber ?? null,
        columnNumber: info.source?.columnNumber ?? null,
        stackFormatted: formatStack(info.stack, 3),
        rawInfo: info,
      }

      lastResult.value = result
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to resolve element source'
      return null
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Get only the source location (file + line)
   */
  async function getSource(element: Element): Promise<ElementSourceInfo | null> {
    try {
      return await resolveSource(element)
    } catch {
      return null
    }
  }

  /**
   * Get the component stack
   */
  async function getStack(element: Element): Promise<ElementSourceInfo[]> {
    try {
      return await resolveStack(element)
    } catch {
      return []
    }
  }

  /**
   * Get only the component name
   */
  async function getComponentName(element: Element): Promise<string | null> {
    try {
      return await resolveComponentName(element)
    } catch {
      return null
    }
  }

  /**
   * Format a source location as a readable string
   */
  function formatSource(frame: ElementSourceInfo): string {
    if (!frame) return ''
    return formatStackFrame(frame)
  }

  /**
   * Clear the last result
   */
  function clear() {
    lastResult.value = null
    error.value = null
  }

  return {
    isLoading,
    lastResult,
    error,
    resolveFromEvent,
    resolveFromElement,
    getSource,
    getStack,
    getComponentName,
    formatSource,
    clear,
  }
}
