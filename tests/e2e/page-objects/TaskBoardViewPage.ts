import { Page, Locator, expect } from '@playwright/test'
import { BASE_URL } from '../utils/url-helper'

/**
 * TaskBoardViewPage - Page object for task kanban board view
 *
 * Route: /projects/:projectId (when a directory with task module is selected)
 *
 * Components under test:
 * - TaskBoardView (columns, quick add)
 * - TaskColumn (drag-and-drop columns)
 * - TaskCard (task cards with subtask expand)
 * - TaskDetailPanel (slide-out detail panel)
 * - ColumnSettingsDialog (column customization)
 * - TaskQuickAdd (inline task creation)
 * - SubTaskList / SubTaskItem (subtask management)
 */

export class TaskBoardViewPage {
  constructor(readonly page: Page) {}

  // ============================================================
  // Route / Navigation
  // ============================================================

  async goto(projectId: string) {
    await this.page.goto(`${BASE_URL}/projects/${projectId}`)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.waitForTimeout(500)
  }

  // ============================================================
  // TaskBoardView root
  // ============================================================

  // Root board: TaskBoardView uses "flex flex-col h-full bg-gray-100"
  get taskBoard(): Locator {
    return this.page.locator('.bg-gray-100').first()
  }

  // Board columns container
  get boardColumns(): Locator {
    return this.page.locator('.overflow-x-auto')
  }

  get loadingState(): Locator {
    return this.page.locator('.text-gray-500').first()
  }

  get toolbar(): Locator {
    // The toolbar is the div with "flex items-center justify-end gap-2 px-4 pb-2"
    return this.page.locator('.flex.items-center\\.justify-end')
  }

  // Settings button inside the toolbar (Lucide Settings icon)
  getSettingsButton(): Locator {
    return this.toolbar.locator('button').filter({ has: this.page.locator('svg') })
  }

  // ============================================================
  // Quick Add
  // ============================================================

  // TaskQuickAdd: "w-full px-3.5 py-2 text-sm text-gray-900 border..."
  get quickAddInput(): Locator {
    return this.page.locator('input[placeholder]').first()
  }

  getQuickAddInput(): Locator {
    return this.quickAddInput
  }

  // ============================================================
  // Columns
  // ============================================================

  // TaskColumn outer div: "flex flex-col min-w-[280px] max-w-[320px] flex-1 bg-gray-50 rounded-xl"
  get columns(): Locator {
    return this.page.locator('.bg-gray-50.rounded-xl')
  }

  getColumnByName(name: string): Locator {
    return this.columns.filter({ hasText: name })
  }

  // Column header: "flex items-center gap-2 px-4 py-3 bg-white border-b border-gray-200"
  getColumnHeader(columnName: string): Locator {
    return this.page.locator('.border-b.border-gray-200').filter({ hasText: columnName })
  }

  getColumnAddButton(columnName: string): Locator {
    // Add button in column header (Plus icon)
    return this.getColumnHeader(columnName).locator('button')
  }

  getColumnCountBadge(columnName: string): Locator {
    // Count badge: "text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full"
    return this.getColumnHeader(columnName).locator('.rounded-full')
  }

  // ============================================================
  // Task Cards
  // ============================================================

  // TaskCard outer div: "bg-white border border-gray-200 rounded-lg overflow-hidden"
  get taskCards(): Locator {
    return this.page.locator('.bg-white.border.border-gray-200.rounded-lg').first()
  }

  // Find task card by title text
  getTaskCardByTitle(title: string): Locator {
    // Title is .text-sm.font-medium.text-gray-800 inside a task card
    return this.page
      .locator('.text-sm.font-medium.text-gray-800')
      .filter({ hasText: title })
      .locator('..')
      .locator('..')
  }

  get taskCardTitles(): Locator {
    return this.page.locator('.text-sm.font-medium.text-gray-800')
  }

  // Priority dot: "w-2 h-2 rounded-full" (small colored circle)
  getTaskCardPriority(taskTitle: string): Locator {
    return this.getTaskCardByTitle(taskTitle).locator('.rounded-full.w-2')
  }

  // Assignee text: "text-xs text-gray-500"
  getTaskCardAssignee(taskTitle: string): Locator {
    return this.getTaskCardByTitle(taskTitle).locator('.text-xs.text-gray-500')
  }

  // Expand button: shows child count "N/M" or chevron
  getTaskExpandBtn(taskTitle: string): Locator {
    return this.getTaskCardByTitle(taskTitle).locator('.rounded-full.px-1\\.5')
  }

  // Subtask list inside expanded card
  getTaskSubtasks(taskTitle: string): Locator {
    return this.getTaskCardByTitle(taskTitle).locator('.border-t.border-gray-200')
  }

  // ============================================================
  // Task Detail Panel
  // ============================================================

  // Detail panel: "fixed top-0 right-0 w-[400px] h-screen bg-white"
  get taskDetailPanel(): Locator {
    return this.page.locator('.fixed.top-0.right-0')
  }

  getDetailTitleInput(): Locator {
    return this.taskDetailPanel.locator('input').first()
  }

  getDetailDescription(): Locator {
    return this.taskDetailPanel.locator('textarea').first()
  }

  getDetailStatusSelect(): Locator {
    return this.taskDetailPanel.locator('select').first()
  }

  getDetailPrioritySelect(): Locator {
    return this.taskDetailPanel.locator('select').nth(1)
  }

  // Close button in panel header (X icon)
  getDetailCloseButton(): Locator {
    return this.taskDetailPanel.locator('.text-gray-500 button, button:has(svg)')
  }

  getDetailDeleteButton(): Locator {
    return this.taskDetailPanel.locator('button:has-text("Delete"), button:has-text("删除")')
  }

  // Subtask section: "border-t border-gray-200 px-5 py-4 bg-gray-50"
  get detailSubtasksSection(): Locator {
    return this.taskDetailPanel.locator('.bg-gray-50.border-t')
  }

  getDetailSubtaskItems(): Locator {
    return this.detailSubtasksSection.locator('.bg-white.border')
  }

  // Quick add input in subtasks section
  getDetailSubtaskAddInput(): Locator {
    return this.detailSubtasksSection.locator('input')
  }

  // Add subtask button
  getDetailSubtaskAddButton(): Locator {
    return this.detailSubtasksSection.locator('button:has-text("Add"), button:has-text("添加")')
  }

  // ============================================================
  // Column Settings Dialog
  // ============================================================

  // Dialog backdrop: "fixed inset-0 bg-black/40"
  get columnSettingsDialog(): Locator {
    return this.page.locator('.fixed.inset-0')
  }

  get columnSettingsTitle(): Locator {
    return this.columnSettingsDialog.locator('h3')
  }

  // Dialog inner panel
  get columnSettingsPanel(): Locator {
    return this.columnSettingsDialog.locator('.bg-white.rounded-xl')
  }

  // Column list inside dialog
  get columnSettingsList(): Locator {
    return this.columnSettingsPanel.locator('.flex.flex-col.gap-1\\.5')
  }

  // Single column item: "bg-gray-50 border border-gray-200 rounded-lg"
  getColumnSettingsItem(columnName: string): Locator {
    return this.columnSettingsPanel
      .locator('.bg-gray-50.border.border-gray-200')
      .filter({ hasText: columnName })
  }

  // Visibility toggle button
  getColumnVisibilityButton(columnName: string): Locator {
    const item = this.getColumnSettingsItem(columnName)
    // Button text is either "Visible" / "显示" or "Hidden" / "隐藏"
    return item.locator('button').filter({ hasText: /Visible|Hidden|显示|隐藏/ })
  }

  // Delete button in column item (Trash2 icon)
  getColumnDeleteButton(columnName: string): Locator {
    return this.getColumnSettingsItem(columnName).locator('button:has(svg)')
  }

  // Add column button
  get addColumnButton(): Locator {
    return this.columnSettingsPanel.locator('button').filter({ hasText: 'Add Column' })
  }

  // Add column form
  get addColumnForm(): Locator {
    return this.columnSettingsPanel.locator('.border-dashed')
  }

  // Inputs in add form
  get newColumnKeyInput(): Locator {
    return this.addColumnForm.locator('input').nth(0)
  }

  get newColumnNameInput(): Locator {
    return this.addColumnForm.locator('input').nth(1)
  }

  get newColumnColorInput(): Locator {
    return this.addColumnForm.locator('input[type="color"]')
  }

  get submitAddColumnButton(): Locator {
    return this.addColumnForm.locator('button:has-text("Create")')
  }

  get cancelAddColumnButton(): Locator {
    return this.addColumnForm.locator('button:has-text("Cancel")')
  }

  // Close button in dialog header
  get settingsCloseButton(): Locator {
    return this.columnSettingsPanel.locator('.text-gray-500 button')
  }

  // ============================================================
  // SubTaskList (inside expanded card)
  // ============================================================

  // Subtask items have class "subtask-item" on root div
  getSubtaskCheckbox(parentTitle: string, subtaskTitle: string): Locator {
    return this.getTaskCardByTitle(parentTitle)
      .locator('.subtask-item')
      .filter({ hasText: subtaskTitle })
      .locator('input[type="checkbox"]')
  }

  getSubtaskDeleteButton(parentTitle: string, subtaskTitle: string): Locator {
    return this.getTaskCardByTitle(parentTitle)
      .locator('.subtask-item')
      .filter({ hasText: subtaskTitle })
      .locator('button')
  }

  getSubtaskAddInput(parentTitle: string): Locator {
    return this.getTaskCardByTitle(parentTitle).locator('input')
  }

  // ============================================================
  // Common dialog
  // ============================================================

  getDialog(titlePattern: string | RegExp): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: titlePattern }).first()
  }

  // ============================================================
  // Actions
  // ============================================================

  async openColumnSettings() {
    await this.getSettingsButton().click()
    await this.page.waitForTimeout(300)
  }

  async closeColumnSettings() {
    await this.settingsCloseButton.click()
    await this.page.waitForTimeout(300)
  }

  async clickTaskCard(title: string) {
    await this.getTaskCardByTitle(title).click()
    await this.page.waitForTimeout(300)
  }

  async closeDetailPanel() {
    await this.getDetailCloseButton().click()
    await this.page.waitForTimeout(300)
  }

  async expandTaskCard(title: string) {
    const btn = this.getTaskExpandBtn(title)
    const isVisible = await btn.isVisible().catch(() => false)
    if (isVisible) {
      await btn.click()
      await this.page.waitForTimeout(300)
    }
  }

  async quickAddTask(title: string) {
    await this.quickAddInput.fill(title)
    await this.quickAddInput.press('Enter')
    await this.page.waitForTimeout(500)
  }

  async addSubtaskToCard(parentTitle: string, subtaskTitle: string) {
    await this.expandTaskCard(parentTitle)
    await this.getSubtaskAddInput(parentTitle).fill(subtaskTitle)
    await this.getSubtaskAddInput(parentTitle).press('Enter')
    await this.page.waitForTimeout(500)
  }

  async openAddColumnForm() {
    await this.addColumnButton.click()
    await this.page.waitForTimeout(200)
  }

  async submitNewColumn(statusKey: string, name: string, color = '#6366F1') {
    await this.newColumnKeyInput.fill(statusKey)
    await this.newColumnNameInput.fill(name)
    await this.newColumnColorInput.fill(color)
    await this.submitAddColumnButton.click()
    await this.page.waitForTimeout(500)
  }

  async toggleColumnVisibility(columnName: string) {
    await this.getColumnVisibilityButton(columnName).click()
    await this.page.waitForTimeout(300)
  }

  async deleteColumn(columnName: string) {
    await this.getColumnDeleteButton(columnName).click()
    await this.getColumnDeleteButton(columnName).click()
    await this.page.waitForTimeout(500)
  }

  async toggleTaskSubtask(parentTitle: string, subtaskTitle: string) {
    const checkbox = this.getSubtaskCheckbox(parentTitle, subtaskTitle)
    await checkbox.click()
    await this.page.waitForTimeout(300)
  }

  // ============================================================
  // Assertions
  // ============================================================

  async expectTaskBoardVisible() {
    await expect(this.taskBoard).toBeVisible()
  }

  async expectColumnsVisible(count?: number) {
    if (count !== undefined) {
      await expect(this.columns).toHaveCount(count)
    } else {
      await expect(this.columns.first()).toBeVisible()
    }
  }

  async expectTaskCardVisible(title: string) {
    await expect(this.getTaskCardByTitle(title)).toBeVisible()
  }

  async expectTaskCardNotVisible(title: string) {
    await expect(this.getTaskCardByTitle(title)).not.toBeVisible()
  }

  async expectDetailPanelVisible() {
    await expect(this.taskDetailPanel).toBeVisible()
  }

  async expectDetailPanelHidden() {
    await expect(this.taskDetailPanel).not.toBeVisible()
  }

  async expectColumnSettingsOpen() {
    await expect(this.columnSettingsDialog).toBeVisible()
  }

  async expectColumnSettingsClosed() {
    await expect(this.columnSettingsDialog).not.toBeVisible()
  }

  async expectColumnVisible(columnName: string) {
    await expect(this.getColumnByName(columnName)).toBeVisible()
  }

  async expectColumnHidden(columnName: string) {
    await expect(this.getColumnByName(columnName)).not.toBeVisible()
  }

  async expectSubtasksExpanded(parentTitle: string) {
    await expect(this.getTaskSubtasks(parentTitle)).toBeVisible()
  }

  async expectNoLoading() {
    await expect(this.loadingState).not.toBeVisible()
  }
}

/**
 * Create TaskBoardViewPage instance
 */
export function createTaskBoardViewPage(page: Page) {
  return new TaskBoardViewPage(page)
}
