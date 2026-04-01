import { Page, expect } from '@playwright/test'

/**
 * Test Utilities
 *
 * Common helper functions for E2E tests
 */

/**
 * Retry an action until it succeeds or times out
 */
export async function retryUntil<T>(
  page: Page,
  action: () => Promise<T>,
  predicate: (result: T) => boolean,
  options: {
    maxAttempts?: number
    delayMs?: number
    timeoutMs?: number
  } = {}
): Promise<T> {
  const { maxAttempts = 5, delayMs = 200, timeoutMs = 10000 } = options
  const startTime = Date.now()

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await action()
    if (predicate(result)) {
      return result
    }

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Retry timeout after ${maxAttempts} attempts`)
    }

    await page.waitForTimeout(delayMs)
  }

  const result = await action()
  return result
}

/**
 * Poll until condition is met
 */
export async function pollUntil<T>(
  page: Page,
  condition: () => Promise<T>,
  predicate: (result: T) => boolean,
  timeoutMs = 10000,
  intervalMs = 200
): Promise<T> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const result = await condition()
    if (predicate(result)) {
      return result
    }
    await page.waitForTimeout(intervalMs)
  }

  const result = await condition()
  return result
}

/**
 * Wait for element to have specific text
 */
export async function waitForText(
  page: Page,
  selector: string,
  text: string | RegExp,
  timeoutMs = 10000
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    const element = page.locator(selector).first()
    const elementText = await element.textContent()
    if (elementText) {
      if (typeof text === 'string') {
        if (elementText.includes(text)) return
      } else {
        if (text.test(elementText)) return
      }
    }
    await page.waitForTimeout(200)
  }

  throw new Error(`Timeout waiting for text "${text}" in selector "${selector}"`)
}

/**
 * Dismiss any open toast/dialog messages
 */
export async function dismissToasts(page: Page): Promise<void> {
  const closeButtons = page.getByRole('button', { name: /close|关闭|×/i })
  const count = await closeButtons.count()

  for (let i = 0; i < count; i++) {
    try {
      await closeButtons.nth(0).click({ timeout: 1000 })
    } catch {
      break
    }
  }
}

/**
 * Take a screenshot on failure (for test reporters)
 */
export async function screenshotOnFailure(
  page: Page,
  testName: string,
  directory = 'test-results'
): Promise<void> {
  await page.screenshot({
    path: `${directory}/${testName}-${Date.now()}.png`,
    fullPage: true,
  })
}

/**
 * Get test info for logging
 */
export function getTestInfo(): { name: string; file: string } {
  const error = new Error()
  const stack = error.stack?.split('\n') || []
  const testLine = stack.find((line) => line.includes('.spec.'))

  if (testLine) {
    const match = testLine.match(/at .+ \((.+):(\d+):(\d+)\)/)
    if (match) {
      return {
        name: match[1].split('/').pop()?.replace('.spec.ts', '') || 'unknown',
        file: match[1],
      }
    }
  }

  return { name: 'unknown', file: 'unknown' }
}

/**
 * Clear all cookies and local storage (useful for test isolation)
 */
export async function clearBrowserState(page: Page): Promise<void> {
  await page.context().clearCookies()
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

/**
 * Simulate file drag and drop
 */
export async function dragAndDrop(
  page: Page,
  sourceSelector: string,
  targetSelector: string
): Promise<void> {
  const source = page.locator(sourceSelector)
  const target = page.locator(targetSelector)

  await source.dragTo(target)
}

/**
 * Type text with realistic typing delay
 */
export async function typeText(
  page: Page,
  selector: string,
  text: string,
  options: { delay?: number } = {}
): Promise<void> {
  const { delay = 50 } = options
  const element = page.locator(selector)
  await element.clear()
  await element.pressSequentially(text, { delay })
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!process.env.CI
}

/**
 * Get viewport size based on environment
 */
export function getViewportSize(): { width: number; height: number } {
  return isCI() ? { width: 1280, height: 720 } : { width: 1920, height: 1080 }
}
