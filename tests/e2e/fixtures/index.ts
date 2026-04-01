import { test as base, Page, Browser, BrowserContext, expect } from '@playwright/test'
import { createWorkspacePage, WorkspacePage } from '../page-objects'
import { createProjectsPage, ProjectsPage } from '../page-objects'
import { createSettingsPage, SettingsPage } from '../page-objects'
import { createProjectWorkspacePage, ProjectWorkspacePage } from '../page-objects'
import {
  mockTauriInvoke,
  DEFAULT_MOCK_WORKSPACE,
  DEFAULT_MOCK_SETTINGS,
  DEFAULT_MOCK_PROJECT,
  DEFAULT_MOCK_GIT_REPO,
  DEFAULT_MOCK_FILE_TREE,
  DEFAULT_MOCK_GIT_MODULE,
  DEFAULT_MOCK_FILE_MODULE,
  DEFAULT_MOCK_DIRECTORY,
} from '../utils/tauri-mocks'

/**
 * Tauri E2E Test Fixtures
 *
 * These fixtures provide pre-configured page objects and utilities
 * with automatic Tauri command mocking for consistent and maintainable E2E testing.
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
 * Default mock data for all tests
 */
const DEFAULT_MOCKS = {
  'workspace_get_current': DEFAULT_MOCK_WORKSPACE,
  'workspace_list_recent': [DEFAULT_MOCK_WORKSPACE],
  'workspace_settings_get': DEFAULT_MOCK_SETTINGS,
  'projects_list': [DEFAULT_MOCK_PROJECT],
  'project_get': DEFAULT_MOCK_PROJECT,
  'git_repo_list': [DEFAULT_MOCK_GIT_REPO],
  'git_repo_status_get': {
    repoId: DEFAULT_MOCK_GIT_REPO.id,
    branch: 'main',
    dirty: false,
    ahead: 0,
    behind: 0,
    lastCheckedAt: new Date().toISOString(),
    network: 'online',
  },
  'git_repo_scan': { ok: true, scanned: [] },
  'git_extract_repo_name': 'test-repo',
  'git_repo_clone': {
    ...DEFAULT_MOCK_GIT_REPO,
    id: `repo-${Date.now()}`,
  },
  'git_repo_pull': { ok: true, syncedAt: new Date().toISOString() },
  'project_fs_tree': DEFAULT_MOCK_FILE_TREE,
  'fs_create_dir': { ok: true },
  'fs_create_file': { ok: true },
  'fs_delete': { ok: true },
  'fs_rename': { ok: true },
  'fs_read_text': { content: '# Test File\n\nThis is a test file.' },
  'preview_detect': (args: { path: string }) => {
    if (args.path.endsWith('.md')) return { kind: 'markdown' }
    if (args.path.endsWith('.vue')) return { kind: 'text' }
    if (args.path.endsWith('.ts')) return { kind: 'text' }
    if (args.path.endsWith('.json')) return { kind: 'text' }
    return { kind: 'text' }
  },
  'dir_types_list': [
    { id: 'dt-1', kind: 'code', name: 'Code', sortOrder: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'dt-2', kind: 'docs', name: 'Docs', sortOrder: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ],
  'project_dirs_list': [],
  'module_list': [DEFAULT_MOCK_GIT_MODULE, DEFAULT_MOCK_FILE_MODULE],
  'module_get_by_key': DEFAULT_MOCK_GIT_MODULE,
  'directory_list': [DEFAULT_MOCK_DIRECTORY],
  'directory_create': {
    ...DEFAULT_MOCK_DIRECTORY,
    id: `dir-${Date.now()}`,
  },
  'ide_list_supported': [
    { kind: 'vscode', name: 'VS Code', command: 'code', available: true },
    { kind: 'idea', name: 'IntelliJ IDEA', command: 'idea', available: false },
  ],
}

/**
 * Custom Tauri test function with typed fixtures and automatic mock setup
 */
export const test = base.extend<TauriFixtures>({
  /**
   * Automatically set up Tauri mocks before each test
   */
  page: async ({ page }, use) => {
    // Set up Tauri mocks before test runs
    await mockTauriInvoke(page, DEFAULT_MOCKS)
    await use(page)
  },

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
    // Set up Tauri mocks for browser tests too
    await mockTauriInvoke(page, DEFAULT_MOCKS)
    await use(page)
  },
})
