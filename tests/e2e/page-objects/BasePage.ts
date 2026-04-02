import { Page, Locator, expect } from '@playwright/test'
import { BASE_URL } from '../utils/url-helper'

/**
 * BasePage - Common page object base class with shared functionality
 */
export class BasePage {
  constructor(readonly page: Page) {}

  /**
   * Navigate to a path (prepends BASE_URL for WebDriver compatibility)
   */
  async goto(path: string) {
    const absolute = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
    await this.page.goto(absolute)
  }

  /**
   * Wait for page to load
   */
  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
  }

  /**
   * Get page title
   */
  getTitle(): Promise<string> {
    return this.page.title()
  }

  /**
   * Check if locator is visible with timeout
   */
  async expectVisible(locator: Locator, timeout = 30000) {
    await expect(locator).toBeVisible({ timeout })
  }

  /**
   * Check if locator is hidden with timeout
   */
  async expectHidden(locator: Locator, timeout = 30000) {
    await expect(locator).toBeHidden({ timeout })
  }

  /**
   * Check if locator has text
   */
  async expectText(locator: Locator, text: string | RegExp, timeout = 30000) {
    await expect(locator).toHaveText(text, { timeout })
  }

  /**
   * Check if locator is enabled
   */
  async expectEnabled(locator: Locator, timeout = 30000) {
    await expect(locator).toBeEnabled({ timeout })
  }

  /**
   * Check if locator is disabled
   */
  async expectDisabled(locator: Locator, timeout = 30000) {
    await expect(locator).toBeDisabled({ timeout })
  }

  /**
   * Click with retry - useful for elements that may need to settle
   */
  async clickWithRetry(locator: Locator, retries = 2) {
    for (let i = 0; i <= retries; i++) {
      try {
        await locator.click()
        return
      } catch (e) {
        if (i === retries) throw e
        await this.page.waitForTimeout(200)
      }
    }
  }

  /**
   * Wait for URL to match pattern
   */
  async waitForURL(pattern: string | RegExp, timeout = 30000) {
    await this.page.waitForURL(pattern, { timeout })
  }
}

/**
 * Create BasePage instance
 */
export function createBasePage(page: Page) {
  return new BasePage(page)
}
