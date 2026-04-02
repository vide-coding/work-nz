import { Page, expect } from '@playwright/test'

// Global type augmentations for Tauri test globals
// These are used by deprecated mock functions
declare global {
  interface Window {
    __TAURI__?: {
      core?: { invoke?: (cmd: string, args?: Record<string, unknown>) => unknown }
      event?: { listen?: () => Promise<() => void>; emit?: () => Promise<void> }
    }
    __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: Record<string, unknown>) => unknown }
  }
}

// Note: These types are duplicated from the app's type definitions to avoid
// the @/@types import path in E2E tests. Since mocking is deprecated,
// these are only used in the legacy mock functions kept for reference.
/** @deprecated - Use real Tauri backend instead */
interface WorkspaceInfo {
  path: string
  dbPath?: string
  alias?: string
  lastOpenedAt?: string
}
/** @deprecated */
interface WorkspaceSettings {
  themeMode?: string
}
/** @deprecated */
interface Project {
  id: string
  name: string
  description?: string
  projectPath: string
  visible?: boolean
  updatedAt?: string
}
/** @deprecated */
interface GitRepository {
  id: string
  projectId: string
  name: string
  path: string
  folder?: string
  remoteUrl?: string
  branch?: string
  description?: string
}
/** @deprecated */
interface FileNode {
  path: string
  name: string
  kind: string
  children?: FileNode[]
}
/** @deprecated */
interface Module {
  id: string
  key: string
  name: string
  description: string
  version: string
  capabilities?: string[]
  configSchema?: Record<string, unknown>
  defaultConfig?: Record<string, unknown>
  icon?: string
  isBuiltIn?: boolean
}

/**
 * Tauri Test Utilities
 *
 * DEPRECATED: This module previously provided browser-side Tauri API mocking.
 * Since migrating to official Tauri WebDriver testing, mocking is no longer used.
 * Tests now run against the real Tauri application via CDP (Chrome DevTools Protocol).
 *
 * Kept for:
 * - KNOWN_NON_CRITICAL_ERRORS: list of known Tauri error patterns for console monitoring
 * - setupConsoleErrorListener(): utility for capturing console errors during tests
 *
 * The mockTauriInvoke, mockWorkspaceApi, mockProjectApi functions are NO LONGER USED.
 * They remain here for reference only and will be removed in a future update.
 */

// ============================================================================
// Types
// ============================================================================

export interface MockProjectData {
  id: string
  name: string
  description?: string
  projectPath: string
  visible: boolean
  updatedAt: string
}

export interface MockGitRepoData {
  id: string
  projectId: string
  name: string
  path: string
  folder?: string
  remoteUrl?: string
  branch?: string
  description?: string
}

export interface MockFileNodeData {
  path: string
  name: string
  kind: 'file' | 'dir'
  children?: MockFileNodeData[]
}

export interface MockDirectoryData {
  id: string
  projectId: string
  name: string
  relativePath: string
  moduleId?: string
  moduleConfig?: Record<string, unknown>
  sortOrder: number
}

export interface MockModuleData {
  id: string
  key: string
  name: string
  description: string
  version: string
  capabilities: string[]
  configSchema: Record<string, unknown>
  defaultConfig: Record<string, unknown>
  icon?: string
  isBuiltIn: boolean
}

// ============================================================================
// Default mock data
// ============================================================================

export const DEFAULT_MOCK_WORKSPACE: WorkspaceInfo = {
  path: 'C:\\Users\\TestUser\\TestWorkspace',
  dbPath: 'C:\\Users\\TestUser\\TestWorkspace\\.myflow.db',
  lastOpenedAt: new Date().toISOString(),
  alias: 'Test Workspace',
}

export const DEFAULT_MOCK_SETTINGS: WorkspaceSettings = {
  themeMode: 'system',
}

export const DEFAULT_MOCK_PROJECT: MockProjectData = {
  id: 'proj-test-001',
  name: 'Test Project',
  description: 'A test project for E2E testing',
  projectPath: 'C:\\Users\\TestUser\\TestWorkspace\\projects\\test-project',
  visible: true,
  updatedAt: new Date().toISOString(),
}

export const DEFAULT_MOCK_GIT_REPO: MockGitRepoData = {
  id: 'repo-test-001',
  projectId: 'proj-test-001',
  name: 'test-repo',
  path: 'C:\\Users\\TestUser\\TestWorkspace\\projects\\test-project\\code\\test-repo',
  folder: 'code',
  remoteUrl: 'https://github.com/test/test-repo.git',
  branch: 'main',
  description: 'Test repository',
}

export const DEFAULT_MOCK_FILE_TREE: MockFileNodeData = {
  path: '',
  name: 'root',
  kind: 'dir',
  children: [
    { path: 'src', name: 'src', kind: 'dir', children: [
      { path: 'src/main.ts', name: 'main.ts', kind: 'file' },
      { path: 'src/index.html', name: 'index.html', kind: 'file' },
    ]},
    { path: 'README.md', name: 'README.md', kind: 'file' },
    { path: 'package.json', name: 'package.json', kind: 'file' },
  ],
}

export const DEFAULT_MOCK_GIT_MODULE: MockModuleData = {
  id: 'mod-git-001',
  key: 'git',
  name: 'Git Repository',
  description: 'Manage Git repositories',
  version: '1.0.0',
  capabilities: ['git.clone', 'git.pull', 'git.status'],
  configSchema: {},
  defaultConfig: {},
  icon: 'GitBranch',
  isBuiltIn: true,
}

export const DEFAULT_MOCK_FILE_MODULE: MockModuleData = {
  id: 'mod-file-001',
  key: 'file',
  name: 'File Browser',
  description: 'Browse and manage files',
  version: '1.0.0',
  capabilities: ['file.browse', 'file.read', 'file.preview', 'file.create', 'file.delete'],
  configSchema: {},
  defaultConfig: {},
  icon: 'Files',
  isBuiltIn: true,
}

export const DEFAULT_MOCK_DIRECTORY: MockDirectoryData = {
  id: 'dir-test-001',
  projectId: 'proj-test-001',
  name: 'Code',
  relativePath: 'code',
  moduleId: 'mod-git-001',
  sortOrder: 0,
}

// ============================================================================
// Known non-critical error patterns
// ============================================================================

// Known non-critical error patterns for real Tauri backend testing
// These are errors that are expected/handled gracefully and don't indicate test failure
export const KNOWN_NON_CRITICAL_ERRORS = [
  // Tauri invoke command errors (app gracefully handles these)
  /invoke.*error/i,
  /Failed to invoke command/i,
  // File system errors (may occur when files don't exist)
  /ENOENT|no such file|file not found/i,
  // Git operation errors (expected when no git repos exist)
  /git.*error|fatal:.*not a git/i,
  // Network errors (may occur in offline scenarios)
  /network.*error|fetch.*failed/i,
  // Tauri plugin errors (handled by the app)
  /Tauri.*error|plugin.*error/i,
  // Dialog/file picker errors (user cancelled, etc.)
  /dialog.*cancel|user.*cancel/i,
  // Database errors
  /database.*error|SQL.*error/i,
  // Permission errors (common in desktop apps)
  /permission.*denied|access.*denied/i,
  // Window errors
  /Failed to update window title/i,
  // Database not found (app creates it automatically)
  /database.*not found/i,
]

// ============================================================================
// Command mocks registry
// ============================================================================

type InvokeResult =
  | { type: 'success'; data: unknown }
  | { type: 'error'; error: string }
  | { type: 'delay'; ms: number; next: InvokeResult }

type MockHandler = (args: Record<string, unknown>) => InvokeResult

const commandMocks: Map<string, MockHandler> = new Map()
const calledCommands: Array<{ command: string; args: Record<string, unknown> }> = []

function resetMocks() {
  commandMocks.clear()
  calledCommands.length = 0
}

// ============================================================================
// Mock setup functions
// ============================================================================

/**
 * Set up console error listener and return cleanup function
 */
export function setupConsoleErrorListener(page: Page): {
  errors: string[]
  cleanup: () => void
} {
  const errors: string[] = []

  const listener = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') {
      const text = msg.text()
      const isKnown = KNOWN_NON_CRITICAL_ERRORS.some((pattern) => pattern.test(text))
      if (!isKnown) {
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
 * Register a mock for a specific Tauri command
 */
export async function mockTauriCommand(
  page: Page,
  command: string,
  handler: MockHandler
): Promise<() => void> {
  commandMocks.set(command, handler)

  // Inject mock into page if not already done
  return page.addInitScript(() => {
    const mocks = (window as any).__TAURI_MOCKS__
    if (!mocks) {
      (window as any).__TAURI_MOCKS__ = { commands: new Map(), called: [] }

      // Override invoke
      const { invoke: originalInvoke } = (window as any).__TAURI_INTERNALS__ || {}
      if (originalInvoke) {
        (window as any).__TAURI_INTERNALS__.invoke = async (cmd: string, args?: Record<string, unknown>) => {
          const mocks = (window as any).__TAURI_MOCKS__
          mocks.called.push({ command: cmd, args: args || {} })

          const handler = mocks.commands.get(cmd)
          if (handler) {
            const result = handler(args || {})
            if (result.type === 'delay') {
              await new Promise(resolve => setTimeout(resolve, result.ms))
              return result.next.type === 'success' ? result.next.data : Promise.reject(new Error(result.next.error))
            }
            if (result.type === 'error') {
              throw new Error(result.error)
            }
            return result.data
          }

          // Fall back to original invoke
          return originalInvoke(cmd, args)
        }
      }
    }

    (window as any).__TAURI_MOCKS__.commands.set(command, handler)
  }) as unknown as () => void
}

/**
 * Simplified mock for Tauri invoke commands using addInitScript
 * This approach creates a fake Tauri global before the app loads
 */
export async function mockTauriInvoke(
  page: Page,
  mocks: Record<string, unknown>
): Promise<void> {
  await page.addInitScript(
    ({ mocks }) => {
      // Create fake Tauri global with invoke that returns mock data
      window.__TAURI__ = {
        core: {
          invoke: async (cmd: string, args?: Record<string, unknown>) => {
            // Check for function mocks (callables stored as mock functions)
            if (mocks[cmd] && typeof mocks[cmd] === 'function') {
              return (mocks[cmd] as Function)(args || {})
            }
            // Return static mock data
            if (mocks[cmd] !== undefined) {
              return mocks[cmd]
            }
            // Return sensible defaults for common commands
            switch (cmd) {
              case 'workspace_get_current':
                return null
              case 'workspace_list_recent':
                return []
              case 'workspace_settings_get':
                return { themeMode: 'system' }
              case 'projects_list':
                return []
              case 'git_repo_list':
                return []
              case 'project_fs_tree':
                return { path: '', name: 'root', kind: 'dir', children: [] }
              case 'dir_types_list':
                return []
              case 'module_list':
                return []
              case 'directory_list':
                return []
              default:
                console.warn(`[Mock] No mock for command: ${cmd}`)
                return null
            }
          },
        },
        event: {
          listen: () => Promise.resolve(() => {}),
          emit: () => Promise.resolve(),
        },
      }

      // Mock window module
      const mockWindow = {
        getCurrentWindow: () => ({
          setTitle: () => Promise.resolve(),
          label: 'main',
          isMaximized: () => Promise.resolve(false),
          isMinimized: () => Promise.resolve(false),
          isVisible: () => Promise.resolve(true),
          outerSize: () => Promise.resolve({ width: 1280, height: 720 }),
          innerSize: () => Promise.resolve({ width: 1280, height: 720 }),
          setSize: () => Promise.resolve(),
          setFocus: () => Promise.resolve(),
          close: () => Promise.resolve(),
          minimize: () => Promise.resolve(),
          maximize: () => Promise.resolve(),
          unmaximize: () => Promise.resolve(),
          toggleMaximize: () => Promise.resolve(),
        }),
      }

      // Apply window mock if @tauri-apps/api/window is loaded
      if (typeof window !== 'undefined') {
        Object.assign(window, mockWindow)
      }

      // Also expose on __TAURI_INTERNALS__ if used
      window.__TAURI_INTERNALS__ = {
        invoke: window.__TAURI__?.core?.invoke,
      }
    },
    { mocks }
  )
}

/**
 * Check if a command was called
 */
export async function wasCommandCalled(
  page: Page,
  command: string
): Promise<boolean> {
  return page.evaluate(
    ({ cmd }) => {
      const calls = (window as any).__TAURI_INVOKE_CALLS__ || []
      return calls.some((c: { cmd: string }) => c.cmd === command)
    },
    { cmd: command }
  )
}

/**
 * Get all commands that were called
 */
export async function getCalledCommands(
  page: Page
): Promise<Array<{ cmd: string; args: Record<string, unknown> }>> {
  return page.evaluate(() => {
    return (window as any).__TAURI_INVOKE_CALLS__ || []
  })
}

// ============================================================================
// Pre-configured mock setups
// ============================================================================

export interface MockSetupOptions {
  workspace?: Partial<WorkspaceInfo>
  settings?: Partial<WorkspaceSettings>
  projects?: MockProjectData[]
  gitRepos?: MockGitRepoData[]
  fileTree?: MockFileNodeData
  directories?: MockDirectoryData[]
  modules?: MockModuleData[]
  shouldFail?: string[]
}

/**
 * Set up comprehensive mocks for a typical project workspace scenario
 */
export async function mockProjectWorkspace(
  page: Page,
  options: MockSetupOptions = {}
): Promise<void> {
  const {
    workspace = {},
    settings = {},
    projects = [DEFAULT_MOCK_PROJECT],
    gitRepos = [DEFAULT_MOCK_GIT_REPO],
    fileTree = DEFAULT_MOCK_FILE_TREE,
    directories = [DEFAULT_MOCK_DIRECTORY],
    modules = [DEFAULT_MOCK_GIT_MODULE, DEFAULT_MOCK_FILE_MODULE],
    shouldFail = [],
  } = options

  const mocks: Record<string, unknown> = {}

  // Workspace commands
  mocks['workspace_get_current'] = { ...DEFAULT_MOCK_WORKSPACE, ...workspace }
  mocks['workspace_list_recent'] = [{ ...DEFAULT_MOCK_WORKSPACE, ...workspace }]
  mocks['workspace_settings_get'] = { ...DEFAULT_MOCK_SETTINGS, ...settings }

  // Project commands
  mocks['projects_list'] = projects
  mocks['project_get'] = (args: { id: string }) => {
    const project = projects.find(p => p.id === args.id) || projects[0]
    return project
  }
  mocks['project_create'] = (args: { input: { name: string } }) => ({
    ...DEFAULT_MOCK_PROJECT,
    id: `proj-${Date.now()}`,
    name: args.input.name,
  })

  // Git commands
  mocks['git_repo_list'] = gitRepos
  mocks['git_repo_status_get'] = (args: { repoId: string }) => ({
    repoId: args.repoId,
    branch: 'main',
    dirty: false,
    ahead: 0,
    behind: 0,
    lastCheckedAt: new Date().toISOString(),
    network: 'online',
  })
  mocks['git_repo_scan'] = { ok: true, scanned: [] }
  mocks['git_repo_clone'] = (args: { input: { targetDirName: string } }) => ({
    ...DEFAULT_MOCK_GIT_REPO,
    id: `repo-${Date.now()}`,
    name: args.input.targetDirName,
  })
  mocks['git_extract_repo_name'] = (args: { remoteUrl: string }) => {
    const match = args.remoteUrl.match(/\/([^/]+?)(?:\.git)?$/)
    return match ? match[1] : 'repo'
  }
  mocks['git_repo_pull'] = { ok: true, syncedAt: new Date().toISOString() }

  // Directory Type commands
  mocks['dir_types_list'] = [
    { id: 'dt-1', kind: 'code', name: 'Code', sortOrder: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'dt-2', kind: 'docs', name: 'Docs', sortOrder: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ]
  mocks['project_dirs_list'] = []

  // File system commands
  mocks['project_fs_tree'] = (args: { relativeRoot: string }) => {
    if (args.relativeRoot === '') {
      return fileTree
    }
    // Find the node in tree
    const findNode = (node: MockFileNodeData, path: string): MockFileNodeData | null => {
      if (node.path === path) return node
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child, path)
          if (found) return found
        }
      }
      return null
    }
    return findNode(fileTree, args.relativeRoot) || { path: args.relativeRoot, name: args.relativeRoot.split('/').pop() || '', kind: 'dir', children: [] }
  }
  mocks['fs_create_dir'] = { ok: true }
  mocks['fs_create_file'] = { ok: true }
  mocks['fs_delete'] = { ok: true }
  mocks['fs_rename'] = { ok: true }

  // Module commands
  mocks['module_list'] = modules
  mocks['module_get_by_key'] = (args: { key: string }) => {
    const mod = modules.find(m => m.key === args.key)
    return mod || modules[0]
  }

  // Directory commands
  mocks['directory_list'] = directories
  mocks['directory_create'] = (args: { input: { name: string } }) => ({
    ...DEFAULT_MOCK_DIRECTORY,
    id: `dir-${Date.now()}`,
    name: args.input.name,
  })
  mocks['directory_reorder'] = directories

  // Preview commands
  mocks['preview_detect'] = (args: { path: string }) => {
    if (args.path.endsWith('.md')) return { kind: 'markdown' }
    if (args.path.endsWith('.txt')) return { kind: 'text' }
    if (args.path.match(/\.(jpg|png|gif|svg)$/)) return { kind: 'image' }
    return { kind: 'text' }
  }

  // IDE commands
  mocks['ide_list_supported'] = [
    { kind: 'vscode', name: 'VS Code', command: 'code', available: true },
    { kind: 'idea', name: 'IntelliJ IDEA', command: 'idea', available: false },
  ]

  // Add error mocks for shouldFail commands
  for (const cmd of shouldFail) {
    mocks[cmd] = async () => {
      throw new Error(`Mock error for ${cmd}`)
    }
  }

  await mockTauriInvoke(page, mocks)
}

// ============================================================================
// Verify no critical console errors occurred
// ============================================================================

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

// ============================================================================
// Wait for Tauri
// ============================================================================

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

// ============================================================================
// Mock workspace API responses (legacy)
// ============================================================================

export function mockWorkspaceApi(
  page: Page,
  data?: Partial<{
    recentWorkspaces: WorkspaceInfo[]
    currentWorkspace: WorkspaceInfo | null
    settings: WorkspaceSettings
  }>
) {
  const mockResponse = {
    recentWorkspaces: data?.recentWorkspaces ?? [DEFAULT_MOCK_WORKSPACE],
    currentWorkspace: data?.currentWorkspace ?? DEFAULT_MOCK_WORKSPACE,
    settings: data?.settings ?? DEFAULT_MOCK_SETTINGS,
  }

  return page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const body = route.request().postData() || ''
    const command = url.includes('list_recent') || body.includes('list_recent')
      ? 'list_recent'
      : url.includes('get_settings') || body.includes('get_settings')
        ? 'get_settings'
        : url.includes('get_current') || body.includes('get_current')
          ? 'get_current'
          : null

    if (command) {
      const response =
        command === 'list_recent'
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
 * Mock projectApi responses (legacy)
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
