/**
 * Test URL utilities
 *
 * Provides absolute URLs for E2E tests. The base URL is the Vite dev server
 * (http://localhost:1420) since tests use WebDriver to connect to the Tauri app,
 * and WebDriver navigation requires absolute URLs.
 */

import type { Page } from '@playwright/test'

export const BASE_URL = 'http://localhost:1420'

/**
 * Build an absolute URL for navigation.
 */
export function url(path: string): string {
  return `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Navigate a page to an absolute URL.
 * Prefer this over page.goto() with relative paths when using WebDriver.
 */
export async function goto(page: Page, path: string): Promise<void> {
  await page.goto(url(path))
}
