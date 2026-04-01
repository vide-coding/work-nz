import { test as base, Page, Browser, BrowserContext } from '@playwright/test'
import { createWorkspacePage, WorkspacePage } from '../page-objects'
import { createProjectsPage, ProjectsPage } from '../page-objects'
import { createSettingsPage, SettingsPage } from '../page-objects'
import { createProjectWorkspacePage, ProjectWorkspacePage } from '../page-objects'

/**
 * Tauri E2E Test Fixtures
 *
 * These fixtures provide pre-configured page objects and utilities
 * for consistent and maintainable E2E testing.
 *
 * Usage:
 * ```typescript
 * test('my test', async ({ workspacePage }) => {
 *   await workspacePage.goto()
 *   // ...
 * })
 * ```
 */

/**
 * Fixture options for customizing test behavior
 */
export interface TauriFixtures {
  workspacePage: WorkspacePage
  projectsPage: ProjectsPage
  settingsPage: SettingsPage
  projectWorkspacePage: ProjectWorkspacePage
}

/**
 * Custom Tauri test function with typed fixtures
 */
export const test = base.extend<TauriFixtures>({
  /**
   * WorkspacePage fixture
   */
  workspacePage: async ({ page }, use) => {
    const workspacePage = createWorkspacePage(page)
    await use(workspacePage)
  },

  /**
   * ProjectsPage fixture
   */
  projectsPage: async ({ page }, use) => {
    const projectsPage = createProjectsPage(page)
    await use(projectsPage)
  },

  /**
   * SettingsPage fixture
   */
  settingsPage: async ({ page }, use) => {
    const settingsPage = createSettingsPage(page)
    await use(settingsPage)
  },

  /**
   * ProjectWorkspacePage fixture
   */
  projectWorkspacePage: async ({ page }, use) => {
    const projectWorkspacePage = createProjectWorkspacePage(page)
    await use(projectWorkspacePage)
  },
})

/**
 * Export expect with extended matchers
 */
export { expect } from '@playwright/test'

/**
 * Browser utilities for advanced testing
 */
export interface BrowserUtils {
  browser: Browser
  context: BrowserContext
  page: Page
}

/**
 * Extended fixtures for browser-level access
 */
export const browserTest = base.extend<BrowserUtils>({
  browser: async ({ browser }, use) => {
    await use(browser)
  },
  context: async ({ context }, use) => {
    await use(context)
  },
  page: async ({ page }, use) => {
    await use(page)
  },
})
