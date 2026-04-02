/**
 * Tauri E2E Test Fixtures
 *
 * Provides typed page objects for E2E testing against the real Tauri application.
 *
 * IMPORTANT: This fixture uses the REAL Tauri backend.
 * Tests connect to the built Tauri application via CDP (Chrome DevTools Protocol).
 * No browser-side Tauri API mocking is performed.
 *
 * Usage:
 * ```typescript
 * test('my test', async ({ workspacePage }) => {
 *   await workspacePage.goto()
 *   // ... tests use real Tauri backend
 * })
 * ```
 */

import { test as base, Page } from '@playwright/test'
import { createWorkspacePage, WorkspacePage } from '../page-objects'
import { createProjectsPage, ProjectsPage } from '../page-objects'
import { createSettingsPage, SettingsPage } from '../page-objects'
import { createProjectWorkspacePage, ProjectWorkspacePage } from '../page-objects'

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
 * Custom Tauri test function with typed page objects.
 *
 * Tests use the REAL Tauri backend (via CDP connection).
 * No mocking is performed - the built Tauri application handles all requests.
 */
export const test = base.extend<TauriFixtures>({
  /**
   * WorkspacePage fixture - page object for /workspace route
   */
  workspacePage: async ({ page }, use) => {
    const workspacePage = createWorkspacePage(page)
    await use(workspacePage)
  },

  /**
   * ProjectsPage fixture - page object for /projects route
   */
  projectsPage: async ({ page }, use) => {
    const projectsPage = createProjectsPage(page)
    await use(projectsPage)
  },

  /**
   * SettingsPage fixture - page object for /settings/* routes
   */
  settingsPage: async ({ page }, use) => {
    const settingsPage = createSettingsPage(page)
    await use(settingsPage)
  },

  /**
   * ProjectWorkspacePage fixture - page object for /projects/:id route
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
