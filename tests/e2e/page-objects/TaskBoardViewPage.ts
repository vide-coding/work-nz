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

/** Priority dot colors used in task cards */
const PRIORITY_COLORS = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#10B981',
  low: '#9CA3AF',
} as const

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

  get taskBoard(): Locator {
    return this.page.locator('.task-board')
  }

  get boardColumns(): Locator {
    return this.page.locator('.task-board__columns')
  }

  get loadingState(): Locator {
    return this.page.locator('.task-board__loading')
  }

  get errorState(): Locator {
    return this.page.locator('.task-board__error')
  }

  get toolbar(): Locator {
    return this.page.locator('.task-board__toolbar')
  }

  // ============================================================
  // Quick Add
  // ============================================================

  get quickAddInput(): Locator {
    return this.page.locator('.task-quick-add__input, .task-quick-add input')
  }

  getQuickAddInput(): Locator {
    return this.quickAddInput
  }

  // ============================================================
  // Columns
  // ============================================================

  get columns(): Locator {
    return this.page.locator('.task-column')
  }

  getColumnByName(name: string): Locator {
    return this.page.locator('.task-column').filter({ hasText: name })
  }

  get columnCount(): Locator {
    return this.page.locator('.task-board__column-count')
  }

  getSettingsButton(): Locator {
    return this.page.locator('.task-board__settings-btn')
  }

  // Column header elements
  getColumnHeader(columnName: string): Locator {
    return this.page.locator('.task-column__header').filter({ hasText: columnName })
  }

  getColumnAddButton(columnName: string): Locator {
    return this.getColumnHeader(columnName).locator('.task-column__add')
  }

  getColumnCountBadge(columnName: string): Locator {
    return this.getColumnHeader(columnName).locator('.task-column__count')
  }

  get columnList(): Locator {
    return this.page.locator('.task-column__list')
  }

  // ============================================================
  // Task Cards
  // ============================================================

  get taskCards(): Locator {
    return this.page.locator('.task-card')
  }

  getTaskCardByTitle(title: string): Locator {
    return this.page.locator('.task-card__title').filter({ hasText: title }).locator('..').locator('..')
  }

  get taskCardTitles(): Locator {
    return this.page.locator('.task-card__title')
  }

  // Priority dot in task card
  getTaskCardPriority(taskTitle: string): Locator {
    return this.getTaskCardByTitle(taskTitle).locator('.task-card__priority')
  }

  // Assignee in task card
  getTaskCardAssignee(taskTitle: string): Locator {
    return this.getTaskCardByTitle(taskTitle).locator('.task-card__assignee')
  }

  // Expand button (shows subtask progress, e.g. "2/5")
  getTaskExpandBtn(taskTitle: string): Locator {
    return this.getTaskCardByTitle(taskTitle).locator('.task-card__expand-btn')
  }

  // Subtask list (visible after expand)
  getTaskSubtasks(taskTitle: string): Locator {
    return this.getTaskCardByTitle(taskTitle).locator('.task-card__subtasks')
  }

  // ============================================================
  // Task Detail Panel
  // ============================================================

  get taskDetailPanel(): Locator {
    return this.page.locator('.task-detail-panel')
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

  getDetailCloseButton(): Locator {
    return this.taskDetailPanel.locator('.task-detail-panel__close')
  }

  getDetailDeleteButton(): Locator {
    return this.taskDetailPanel.locator('.task-detail-panel__delete')
  }

  // Subtask section in detail panel
  get detailSubtasksSection(): Locator {
    return this.taskDetailPanel.locator('.task-detail-panel__subtasks')
  }

  getDetailSubtaskItems(): Locator {
    return this.detailSubtasksSection.locator('.task-detail-panel__subtask-item')
  }

  getDetailSubtaskAddInput(): Locator {
    return this.detailSubtasksSection.locator('.task-detail-panel__subtasks-input')
  }

  getDetailSubtaskAddButton(): Locator {
    return this.detailSubtasksSection.locator('.task-detail-panel__subtasks-btn')
  }

  // ============================================================
  // Column Settings Dialog
  // ============================================================

  get columnSettingsDialog(): Locator {
    return this.page.locator('.settings-dialog')
  }

  get columnSettingsTitle(): Locator {
    return this.columnSettingsDialog.locator('.settings-dialog__title')
  }

  get columnSettingsList(): Locator {
    return this.columnSettingsDialog.locator('.settings-dialog__list')
  }

  getColumnSettingsItem(columnName: string): Locator {
    return this.columnSettingsDialog.locator('.column-item').filter({ hasText: columnName })
  }

  getColumnVisibilityButton(columnName: string): Locator {
    return this.getColumnSettingsItem(columnName).locator('.column-item__visibility')
  }

  getColumnDeleteButton(columnName: string): Locator {
    return this.getColumnSettingsItem(columnName).locator('.column-item__delete')
  }

  get addColumnButton(): Locator {
    return this.columnSettingsDialog.locator('.add-column-btn')
  }

  get addColumnForm(): Locator {
    return this.columnSettingsDialog.locator('.add-form')
  }

  get newColumnKeyInput(): Locator {
    return this.addColumnForm.locator('.add-form__input').first()
  }

  get newColumnNameInput(): Locator {
    return this.addColumnForm.locator('.add-form__input').nth(1)
  }

  get newColumnColorInput(): Locator {
    return this.addColumnForm.locator('input[type="color"]').first()
  }

  get submitAddColumnButton(): Locator {
    return this.addColumnForm.locator('.add-form__submit')
  }

  get cancelAddColumnButton(): Locator {
    return this.addColumnForm.locator('.add-form__cancel')
  }

  get settingsCloseButton(): Locator {
    return this.columnSettingsDialog.locator('.settings-dialog__close')
  }

  // ============================================================
  // SubTaskList (inside expanded card)
  // ============================================================

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
      .locator('.subtask-item__delete')
  }

  getSubtaskAddInput(parentTitle: string): Locator {
    return this.getTaskCardByTitle(parentTitle).locator('.subtask-list__input')
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
    // Handle confirm dialog
    const dialog = this.page.locator('[role="alertdialog"], [role="dialog"]').first()
    const isVisible = await dialog.isVisible().catch(() => false)
    if (isVisible) {
      await dialog.getByRole('button', { name: /delete|删除|confirm|确定/i }).click()
      await this.page.waitForTimeout(500)
    }
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
