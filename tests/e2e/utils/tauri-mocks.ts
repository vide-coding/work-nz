import { Page, expect } from '@playwright/test'

/**
 * Tauri Mock Utilities
 *
 * Provides utilities for mocking Tauri Rust backend commands in E2E tests.
 * Since Tauri apps use IPC to communicate with the Rust backend, we need
 * to intercept these calls at the webview level.
 *
 * In Tauri 2.0, the frontend communicates via:
 * - window.__TAURI__ global (older approach)
 * - @tauri-apps/api invoke() function (newer approach)
 *
 * We mock these by intercepting the underlying fetch/XHR calls or
 * directly patching the invoke function.
 */

/**
 * Known Tauri API error patterns that are non-critical in tests
 */
export const KNOWN_NON_CRITICAL_ERRORS = [
  /Cannot read properties of undefined.*invoke/,
  /Cannot read properties of undefined.*metadata/,
  /Failed to load recent workspaces/,
  /Failed to load settings/,
  /Failed to update window title/,
  /Failed to load.*project/,
  /Failed to load.*workspace/,
  /invoke.*error/,
  /Tauri.*error/,
]

/**
 * Mock data for workspace API
 */
export interface MockWorkspaceData {
  path: string
  alias?: string
}

export const DEFAULT_MOCK_WORKSPACE: MockWorkspaceData = {
  path: 'C:\\Users\\TestUser\\TestWorkspace',
  alias: 'Test Workspace',
}

/**
 * Mock data for project API
 */
export interface MockProjectData {
  id: string
  name: string
  description?: string
  projectPath: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_MOCK_PROJECT: MockProjectData = {
  id: 'test-project-1',
  name: 'Test Project',
  description: 'A test project for E2E testing',
  projectPath: 'C:\\Users\\TestUser\\TestWorkspace\\projects\\test-project-1',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

/**
 * Mock Tauri invoke function for a specific command
 * This patches window.__TAURI__ globally
 */
export function mockTauriCommand(page: Page, command: string, mockData: any) {
  return page.route('**/api/**', async (route) => {
    // For Tauri 2.0 IPC, commands go through the invoke function
    // which typically makes HTTP requests to the Tauri backend
    // In development, these are proxied through Vite
    if (route.request().url().includes(command)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockData),
      })
    } else {
      await route.continue()
    }
  })
}

/**
 * Set up console error listener and return cleanup function
 */
export function setupConsoleErrorListener(
  page: Page,
  filterCritical: (error: string) => boolean = () => true
): { errors: string[]; cleanup: () => void } {
  const errors: string[] = []

  const listener = (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      const isKnown = KNOWN_NON_CRITICAL_ERRORS.some((pattern) => pattern.test(text))
      if (!isKnown && filterCritical(text)) {
        errors.push(text)
      }
    }
  }

  page.on('console', listener)

  return {
    errors,
    cleanup: () => page.off('console', listener),
  }
}

/**
 * Wait for Tauri to be initialized
 */
export async function waitForTauri(page: Page, timeout = 10000): Promise<boolean> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const isTauri = await page.evaluate(() => {
      return typeof window !== 'undefined' && '__TAURI__' in window
    })
    if (isTauri) return true
    await page.waitForTimeout(100)
  }
  return false
}

/**
 * Mock dialog.open (Tauri dialog plugin)
 */
export function mockDialogOpen(page: Page, result: string | null) {
  return page.evaluate(
    ({ mockResult }) => {
      // Use type assertion for Tauri global
      const tauri = (window as any).__TAURI__
      const originalOpen = tauri?.dialog?.open
      if (originalOpen) {
        tauri.dialog.open = async () => mockResult
      }
    },
    { mockResult: result }
  )
}

/**
 * Mock window title setting
 */
export function mockWindowSetTitle(page: Page) {
  return page.evaluate(() => {
    // Use type assertion for Tauri global
    const tauri = (window as any).__TAURI__
    const originalSetTitle = tauri?.window?.currentWindow?.setTitle
    if (originalSetTitle) {
      tauri.window.currentWindow.setTitle = async (title: string) => {
        console.log('[Mock] Window title set to:', title)
        return originalSetTitle(title)
      }
    }
  })
}

/**
 * Mock workspaceApi responses
 */
export function mockWorkspaceApi(page: Page, data?: Partial<{
  recentWorkspaces: MockWorkspaceData[]
  currentWorkspace: MockWorkspaceData | null
  settings: any
}>) {
  const mockResponse = {
    recentWorkspaces: data?.recentWorkspaces ?? [DEFAULT_MOCK_WORKSPACE],
    currentWorkspace: data?.currentWorkspace ?? DEFAULT_MOCK_WORKSPACE,
    settings: data?.settings ?? { themeMode: 'system' },
  }

  return page.route('**/api/**', async (route) => {
    const url = route.request().url()
    // Parse the command from the URL or body
    const body = route.request().postData() || ''
    const command = url.includes('list_recent') || body.includes('list_recent')
      ? 'list_recent'
      : url.includes('get_settings') || body.includes('get_settings')
        ? 'get_settings'
        : url.includes('get_current') || body.includes('get_current')
          ? 'get_current'
          : null

    if (command) {
      const response = command === 'list_recent'
        ? mockResponse.recentWorkspaces
        : command === 'get_settings'
          ? mockResponse.settings
          : command === 'get_current'
            ? mockResponse.currentWorkspace
            : null

      if (response !== null) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response),
        })
        return
      }
    }

    await route.continue()
  })
}

/**
 * Mock projectApi responses
 */
export function mockProjectApi(page: Page, projects?: MockProjectData[]) {
  const mockProjects = projects ?? [DEFAULT_MOCK_PROJECT]

  return page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const body = route.request().postData() || ''

    if (url.includes('project') || body.includes('"project"') || body.includes("'project'")) {
      if (url.includes('list') || body.includes('list')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProjects),
        })
        return
      }

      if (url.includes('get') || body.includes('get')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProjects[0]),
        })
        return
      }
    }

    await route.continue()
  })
}

/**
 * Verify no critical console errors occurred
 */
export async function expectNoCriticalErrors(
  page: Page,
  errors: string[],
  message = 'No critical console errors'
) {
  const criticalErrors = errors.filter(
    (e) => !KNOWN_NON_CRITICAL_ERRORS.some((pattern) => pattern.test(e))
  )

  expect(criticalErrors, message).toHaveLength(0)
}

/**
 * Helper to create a mock for any Tauri invoke command
 */
export function createCommandMock(
  commandName: string,
  mockData: any,
  error?: string
) {
  return {
    command: commandName,
    mockData,
    error,
  }
}
