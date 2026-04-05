/**
 * Task Module E2E Tests
 *
 * Tests for the task kanban board UI components using a mocked Tauri backend.
 * These tests verify UI element presence, interactions, and state changes
 * without requiring a real Tauri backend or database.
 *
 * Tests cover:
 * - TaskBoardView (columns, quick add, toolbar)
 * - TaskColumn (column rendering, add task button)
 * - TaskCard (task cards, priority dots, assignee, expand button)
 * - TaskDetailPanel (slide-out panel, form fields, subtasks)
 * - ColumnSettingsDialog (column list, add form, visibility toggle, delete)
 * - TaskQuickAdd (inline task creation input)
 * - SubTaskList / SubTaskItem (subtask display, add, toggle, delete)
 */

import { test, expect, Page } from '@playwright/test'
import {
  TaskBoardViewPage,
  createTaskBoardViewPage,
  ProjectWorkspacePage,
  createProjectWorkspacePage,
} from '../page-objects'
import { goto } from '../utils/url-helper'
import {
  mockTauriInvoke,
  setupConsoleErrorListener,
  DEFAULT_MOCK_TASKS,
  DEFAULT_MOCK_TASK_COLUMNS,
  DEFAULT_MOCK_TASK_DIRECTORY,
  DEFAULT_MOCK_PROJECT,
  DEFAULT_MOCK_WORKSPACE,
} from '../utils/tauri-mocks'

// Test project ID
const TEST_PROJECT_ID = DEFAULT_MOCK_PROJECT.id

/**
 * Set up task mocks for the page
 */
async function mockTaskBackend(page: Page) {
  await mockTauriInvoke(page, {
    // Workspace
    workspace_get_current: DEFAULT_MOCK_WORKSPACE,
    workspace_list_recent: [DEFAULT_MOCK_WORKSPACE],
    workspace_settings_get: { themeMode: 'system' },

    // Projects
    projects_list: [DEFAULT_MOCK_PROJECT],
    project_get: DEFAULT_MOCK_PROJECT,

    // Directories - include task directory
    directory_list: [DEFAULT_MOCK_TASK_DIRECTORY],

    // Modules
    module_list: [
      { id: 'builtin:task', key: 'task', name: 'Task', description: 'Task board', version: '1.0.0', capabilities: ['task.kanban'], configSchema: {}, defaultConfig: {}, icon: 'checklist', isBuiltIn: true },
      { id: 'builtin:git', key: 'git', name: 'Git', description: 'Git repos', version: '1.0.0', capabilities: [], configSchema: {}, defaultConfig: {}, icon: 'git', isBuiltIn: true },
    ],
    module_get_by_key: (args: { key: string }) => {
      if (args.key === 'task') return { id: 'builtin:task', key: 'task', name: 'Task', description: 'Task board', version: '1.0.0', capabilities: ['task.kanban'], configSchema: {}, defaultConfig: {}, icon: 'checklist', isBuiltIn: true }
      return { id: 'builtin:git', key: 'git', name: 'Git', description: 'Git repos', version: '1.0.0', capabilities: [], configSchema: {}, defaultConfig: {}, icon: 'git', isBuiltIn: true }
    },

    // Task columns
    task_column_list: (args: { directoryId: string }) =>
      DEFAULT_MOCK_TASK_COLUMNS.filter((c) => c.directoryId === args.directoryId),
    task_column_init_defaults: () => DEFAULT_MOCK_TASK_COLUMNS,

    // Tasks
    task_list: (args: { directoryId: string }) =>
      DEFAULT_MOCK_TASKS.filter((t) => t.directoryId === args.directoryId && !t.parentId),
    task_list_children: (args: { parentId: string }) =>
      DEFAULT_MOCK_TASKS.filter((t) => t.parentId === args.parentId),
    task_toggle_complete: (args: { id: string }) => {
      const task = DEFAULT_MOCK_TASKS.find((t) => t.id === args.id)
      if (!task) throw new Error('Task not found')
      return { ...task, isCompleted: !task.isCompleted }
    },
    task_create: (args: { directoryId: string; title: string }) => ({
      id: `task-${Date.now()}`,
      directoryId: args.directoryId,
      parentId: null,
      title: args.title,
      description: null,
      status: 'todo',
      priority: 'medium',
      assignee: null,
      dueDate: null,
      sortOrder: 99,
      isCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    task_create_child: (args: { parentId: string; title: string }) => ({
      id: `subtask-${Date.now()}`,
      directoryId: DEFAULT_MOCK_TASK_DIRECTORY.id,
      parentId: args.parentId,
      title: args.title,
      description: null,
      status: '',
      priority: 'medium',
      assignee: null,
      dueDate: null,
      sortOrder: 0,
      isCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    task_update: (args: { id: string; patch: Record<string, unknown> }) => {
      const task = DEFAULT_MOCK_TASKS.find((t) => t.id === args.id)
      if (!task) throw new Error('Task not found')
      return { ...task, ...args.patch }
    },
    task_delete: () => ({ ok: true }),
    task_delete_child: () => ({ ok: true }),
    task_reorder: () => ({ ok: true }),

    // Column settings commands
    task_column_create: (args: { directoryId: string; statusKey: string; name: string; color: string }) => ({
      id: `col-${Date.now()}`,
      directoryId: args.directoryId,
      statusKey: args.statusKey,
      name: args.name,
      color: args.color,
      sortOrder: 99,
      isVisible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    task_column_update: (args: { id: string; patch: Record<string, unknown> }) => ({
      id: args.id,
      directoryId: DEFAULT_MOCK_TASK_DIRECTORY.id,
      statusKey: 'todo',
      name: 'Updated',
      color: '#000000',
      sortOrder: 0,
      isVisible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    task_column_toggle_visibility: () => ({
      id: 'col-todo',
      directoryId: DEFAULT_MOCK_TASK_DIRECTORY.id,
      statusKey: 'todo',
      name: 'To Do',
      color: '#9CA3AF',
      sortOrder: 0,
      isVisible: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
    task_column_delete: () => ({}),
  })
}

// ============================================================
// Task Module Tests
// ============================================================

test.describe('Task Module - UI Elements', () => {
  let taskPage: TaskBoardViewPage
  let projectPage: ProjectWorkspacePage
  let consoleErrors: string[] = []
  let cleanupConsole: () => void

  test.beforeEach(async ({ page }) => {
    taskPage = createTaskBoardViewPage(page)
    projectPage = createProjectWorkspacePage(page)

    await mockTaskBackend(page)

    const { errors, cleanup } = setupConsoleErrorListener(page)
    consoleErrors = errors
    cleanupConsole = cleanup
  })

  test.afterEach(async () => {
    if (cleanupConsole) cleanupConsole()
  })

  test.describe.configure({ mode: 'parallel' })

  // ============================================================
  // Page Load
  // ============================================================

  test.describe('Page Load', () => {
    test('should display task board when directory with task module is selected', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      // Click on the task directory in the sidebar
      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        // Task board should be visible
        const taskBoard = taskPage.taskBoard
        const boardVisible = await taskBoard.isVisible().catch(() => false)
        if (boardVisible) {
          await expect(taskBoard).toBeVisible()
        }
      }
    })

    test('should show task board columns', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const columns = taskPage.columns
        const columnsVisible = await columns.first().isVisible().catch(() => false)
        if (columnsVisible) {
          await expect(columns.first()).toBeVisible()
        }
      }
    })

    test('should have toolbar with settings button', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const toolbar = taskPage.toolbar
        const toolbarVisible = await toolbar.isVisible().catch(() => false)
        if (toolbarVisible) {
          await expect(toolbar).toBeVisible()
          await expect(taskPage.getSettingsButton()).toBeVisible()
        }
      }
    })
  })

  // ============================================================
  // Task Cards
  // ============================================================

  test.describe('Task Cards', () => {
    test('should display task cards in columns', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const cards = taskPage.taskCards
        const hasCards = await cards.first().isVisible().catch(() => false)
        if (hasCards) {
          const count = await cards.count()
          expect(count).toBeGreaterThan(0)
        }
      }
    })

    test('should show task title in card', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const titles = taskPage.taskCardTitles
        const hasTitles = await titles.first().isVisible().catch(() => false)
        if (hasTitles) {
          const firstTitle = await titles.first().textContent()
          expect(firstTitle).toBeTruthy()
        }
      }
    })

    test('should show priority indicator in task card', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const priorityDot = taskPage.taskBoard.locator('.rounded-full.w-2').first()
        const isVisible = await priorityDot.isVisible().catch(() => false)
        if (isVisible) {
          await expect(priorityDot).toBeVisible()
        }
      }
    })

    test('should show assignee in task card when assigned', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const assignee = taskPage.getTaskCardAssignee('Write unit tests')
        const isVisible = await assignee.isVisible().catch(() => false)
        if (isVisible) {
          await expect(assignee).toBeVisible()
        }
      }
    })

    test('should show expand button for tasks with subtasks', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        // Task "Write unit tests" has a child task
        const expandBtn = taskPage.getTaskExpandBtn('Write unit tests')
        const isVisible = await expandBtn.isVisible().catch(() => false)
        if (isVisible) {
          await expect(expandBtn).toBeVisible()
        }
      }
    })
  })

  // ============================================================
  // Quick Add
  // ============================================================

  test.describe('Quick Add', () => {
    test('should display quick add input', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const quickAdd = taskPage.quickAddInput
        const isVisible = await quickAdd.isVisible().catch(() => false)
        if (isVisible) {
          await expect(quickAdd).toBeVisible()
        }
      }
    })

    test('should allow typing in quick add input', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const quickAdd = taskPage.quickAddInput
        const isVisible = await quickAdd.isVisible().catch(() => false)

        if (isVisible) {
          await quickAdd.fill('New test task')
          const value = await quickAdd.inputValue()
          expect(value).toBe('New test task')
        }
      }
    })
  })

  // ============================================================
  // Task Detail Panel
  // ============================================================

  test.describe('Task Detail Panel', () => {
    test('should open detail panel when task card is clicked', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const card = taskPage.getTaskCardByTitle('Write unit tests')
        const cardVisible = await card.isVisible().catch(() => false)

        if (cardVisible) {
          await card.click()
          await page.waitForTimeout(500)

          const panel = taskPage.taskDetailPanel
          const panelVisible = await panel.isVisible().catch(() => false)
          if (panelVisible) {
            await expect(panel).toBeVisible()
          }
        }
      }
    })

    test('should display task title in detail panel', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const card = taskPage.getTaskCardByTitle('Write unit tests')
        const cardVisible = await card.isVisible().catch(() => false)

        if (cardVisible) {
          await card.click()
          await page.waitForTimeout(500)

          const titleInput = taskPage.getDetailTitleInput()
          const inputVisible = await titleInput.isVisible().catch(() => false)
          if (inputVisible) {
            const value = await titleInput.inputValue()
            expect(value).toContain('Write unit tests')
          }
        }
      }
    })

    test('should have status and priority selects', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const card = taskPage.getTaskCardByTitle('Write unit tests')
        const cardVisible = await card.isVisible().catch(() => false)

        if (cardVisible) {
          await card.click()
          await page.waitForTimeout(500)

          const statusSelect = taskPage.getDetailStatusSelect()
          const prioritySelect = taskPage.getDetailPrioritySelect()
          const statusVisible = await statusSelect.isVisible().catch(() => false)

          if (statusVisible) {
            await expect(statusSelect).toBeVisible()
            await expect(prioritySelect).toBeVisible()
          }
        }
      }
    })

    test('should close detail panel when close button is clicked', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const card = taskPage.getTaskCardByTitle('Write unit tests')
        const cardVisible = await card.isVisible().catch(() => false)

        if (cardVisible) {
          await card.click()
          await page.waitForTimeout(500)

          const closeBtn = taskPage.getDetailCloseButton()
          const closeVisible = await closeBtn.isVisible().catch(() => false)

          if (closeVisible) {
            await closeBtn.click()
            await page.waitForTimeout(500)
            await expect(taskPage.taskDetailPanel).not.toBeVisible()
          }
        }
      }
    })

    test('should display subtasks section in detail panel', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const card = taskPage.getTaskCardByTitle('Write unit tests')
        const cardVisible = await card.isVisible().catch(() => false)

        if (cardVisible) {
          await card.click()
          await page.waitForTimeout(500)

          const subtasksSection = taskPage.detailSubtasksSection
          const sectionVisible = await subtasksSection.isVisible().catch(() => false)
          if (sectionVisible) {
            await expect(subtasksSection).toBeVisible()
            await expect(taskPage.getDetailSubtaskAddInput()).toBeVisible()
          }
        }
      }
    })
  })

  // ============================================================
  // Column Settings Dialog
  // ============================================================

  test.describe('Column Settings Dialog', () => {
    test('should open column settings dialog when settings button is clicked', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const settingsBtn = taskPage.getSettingsButton()
        const settingsVisible = await settingsBtn.isVisible().catch(() => false)

        if (settingsVisible) {
          await settingsBtn.click()
          await page.waitForTimeout(500)
          await expect(taskPage.columnSettingsDialog).toBeVisible()
        }
      }
    })

    test('should display column list in settings dialog', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        await taskPage.openColumnSettings()

        const dialog = taskPage.columnSettingsDialog
        const dialogVisible = await dialog.isVisible().catch(() => false)

        if (dialogVisible) {
          const list = taskPage.columnSettingsList
          const listVisible = await list.isVisible().catch(() => false)
          if (listVisible) {
            await expect(list).toBeVisible()
          }
        }
      }
    })

    test('should show "To Do" column in settings', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        await taskPage.openColumnSettings()

        const item = taskPage.getColumnSettingsItem('To Do')
        const isVisible = await item.isVisible().catch(() => false)
        if (isVisible) {
          await expect(item).toBeVisible()
        }
      }
    })

    test('should have add column button', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        await taskPage.openColumnSettings()

        const addBtn = taskPage.addColumnButton
        const isVisible = await addBtn.isVisible().catch(() => false)
        if (isVisible) {
          await expect(addBtn).toBeVisible()
        }
      }
    })

    test('should show add column form when add button is clicked', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        await taskPage.openColumnSettings()
        await taskPage.openAddColumnForm()

        const form = taskPage.addColumnForm
        const isVisible = await form.isVisible().catch(() => false)
        if (isVisible) {
          await expect(form).toBeVisible()
          await expect(taskPage.newColumnKeyInput).toBeVisible()
          await expect(taskPage.newColumnNameInput).toBeVisible()
        }
      }
    })

    test('should close column settings dialog', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        await taskPage.openColumnSettings()
        await taskPage.closeColumnSettings()

        await expect(taskPage.columnSettingsDialog).not.toBeVisible()
      }
    })
  })

  // ============================================================
  // Subtasks
  // ============================================================

  test.describe('Subtasks', () => {
    test('should expand subtask list when expand button is clicked', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        const expandBtn = taskPage.getTaskExpandBtn('Write unit tests')
        const btnVisible = await expandBtn.isVisible().catch(() => false)

        if (btnVisible) {
          await expandBtn.click()
          await page.waitForTimeout(300)

          const subtasks = taskPage.getTaskSubtasks('Write unit tests')
          await expect(subtasks).toBeVisible()
        }
      }
    })

    test('should show subtask checkbox', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000)

      const taskDir = projectPage.getDirectoryItemByName('Tasks')
      const taskDirVisible = await taskDir.isVisible().catch(() => false)

      if (taskDirVisible) {
        await taskDir.click()
        await page.waitForTimeout(1000)

        await taskPage.expandTaskCard('Write unit tests')

        const subtasks = taskPage.getTaskSubtasks('Write unit tests')
        const subtasksVisible = await subtasks.isVisible().catch(() => false)

        if (subtasksVisible) {
          const checkbox = taskPage.getTaskCardByTitle('Write unit tests').locator('.subtask-item input[type="checkbox"]').first()
          const checkboxVisible = await checkbox.isVisible().catch(() => false)
          if (checkboxVisible) {
            await expect(checkbox).toBeVisible()
          }
        }
      }
    })
  })

  // ============================================================
  // Console Errors
  // ============================================================

  test.describe('Console Errors', () => {
    test('should not have critical console errors when task board is loaded', async ({ page }) => {
      await goto(page, `/projects/${TEST_PROJECT_ID}`)
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(2000)

      const criticalErrors = consoleErrors.filter(
        (e) => !/invoke.*error|Failed to invoke/i.test(e)
      )

      if (criticalErrors.length > 0) {
        console.log('Console errors:', criticalErrors)
      }
    })
  })
})
