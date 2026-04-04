import { Page, Locator, expect } from '@playwright/test'
import { BasePage, createBasePage } from './BasePage'
import { BASE_URL } from '../utils/url-helper'

/**
 * ProjectWorkspacePage - Page object for project workspace view
 *
 * Route: /projects/:id
 */
export class ProjectWorkspacePage {
  readonly base: BasePage

  constructor(readonly page: Page) {
    this.base = createBasePage(page)
  }

  // Header locators
  getGoBackButton(): Locator {
    return this.page.getByRole('button', { name: /切换工作区|Switch Workspace/i })
  }

  getProjectTitle(): Locator {
    return this.page.locator('h2').first()
  }

  getSettingsButton(): Locator {
    return this.page.getByRole('button', { name: '设置' }).or(this.page.getByRole('button', { name: 'Settings', exact: true }))
  }

  getThemeButton(): Locator {
    return this.page.getByRole('button', { name: /System|Light|Dark/i })
  }

  getLanguageButton(): Locator {
    return this.page.getByRole('button', { name: /中文|EN/i })
  }

  // Directory sidebar
  getDirectoriesSection(): Locator {
    return this.page.locator('text=/目录|Directories/i').first()
  }

  getAddDirectoryButton(): Locator {
    return this.page.getByRole('button', { name: /添加|Add/i })
  }

  getDirectoryItems(): Locator {
    return this.page.locator('[class*="draggable"], [class*="directory-item"]')
  }

  getDirectoryItemByName(name: string): Locator {
    return this.page.locator(`text="${name}"`).first()
  }

  // Project intro (home)
  getProjectIntroSection(): Locator {
    return this.page.locator('[class*="ProjectIntro"], [class*="project-intro"]').first()
  }

  getEditProjectButton(): Locator {
    return this.page.getByRole('button', { name: /编辑|Edit/i })
  }

  getOpenInIdeButton(): Locator {
    return this.page.getByRole('button', { name: /用 IDE 打开|Open in IDE/i })
  }

  // Git module
  getGitModuleCloneButton(): Locator {
    return this.page.locator('.git-module__clone-btn')
  }

  getGitModuleRefreshButton(): Locator {
    return this.page.locator('.git-module__refresh-btn')
  }

  getGitModuleTitle(): Locator {
    return this.page.locator('.git-module__title')
  }

  getGitModuleEmptyState(): Locator {
    return this.page.locator('.git-module__empty')
  }

  getGitModuleList(): Locator {
    return this.page.locator('.git-module__list')
  }

  // Git clone dialog
  getCloneRepoDialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /克隆|Clone/i }).first()
  }

  getCloneUrlInput(): Locator {
    return this.page.locator('input').first()
  }

  getCloneTargetDirInput(): Locator {
    return this.page.locator('input[type="text"]').nth(1)
  }

  // File module
  getFileModuleToolbar(): Locator {
    return this.page.locator('.file-module__toolbar')
  }

  getFileModuleBackButton(): Locator {
    return this.page.locator('.file-module__btn-icon').first()
  }

  getFileModuleNewFileButton(): Locator {
    return this.page.locator('.file-module__btn-icon').nth(1)
  }

  getFileModuleNewFolderButton(): Locator {
    return this.page.locator('.file-module__btn-icon').nth(2)
  }

  getFileModuleViewToggle(): Locator {
    return this.page.locator('.file-module__view-toggle')
  }

  getFileModuleGridView(): Locator {
    return this.page.locator('.file-module__grid')
  }

  getFileModuleListView(): Locator {
    return this.page.locator('.file-module__list')
  }

  getFileModuleEmptyState(): Locator {
    return this.page.locator('.file-module__empty')
  }

  getFileModuleContent(): Locator {
    return this.page.locator('.file-module__content')
  }

  getFileModuleFooter(): Locator {
    return this.page.locator('.file-module__footer')
  }

  // File module dialogs
  getCreateFolderDialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /新建文件夹|New Folder|Create Folder/i }).first()
  }

  getCreateDirectoryDialog(): Locator {
    return this.getCreateFolderDialog()
  }

  getCreateFileDialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /新建文件|New File|Create File/i }).first()
  }

  getDirectoryNameInput(): Locator {
    return this.page.locator('[role="dialog"] input[type="text"], [role="dialog"] input:not([type])').first()
  }

  getDeleteDialog(): Locator {
    return this.page.locator('[role="dialog"]').filter({ hasText: /删除|Delete/i }).first()
  }

  // Module content area
  getModuleContentArea(): Locator {
    return this.page.locator('[class*="ModuleContentArea"], [class*="module-content"]').first()
  }

  // Loading and error states
  getLoadingSpinner(): Locator {
    return this.page.locator('[class*="Loader2"], [class*="animate-spin"]').first()
  }

  getErrorMessage(): Locator {
    return this.page.locator('[class*="error"], [class*="red"]').first()
  }

  // Actions
  async goto(projectId: string) {
    await this.page.goto(`${BASE_URL}/projects/${projectId}`)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
    await this.page.waitForTimeout(500)
  }

  async goBack() {
    await this.getGoBackButton().click()
  }

  async switchTheme() {
    await this.getThemeButton().click()
  }

  async switchLanguage() {
    await this.getLanguageButton().click()
  }

  async openSettings() {
    await this.getSettingsButton().click()
  }

  async clickEditProject() {
    await this.getEditProjectButton().click()
  }

  async clickOpenInIde() {
    await this.getOpenInIdeButton().click()
  }

  async clickAddDirectory() {
    await this.getAddDirectoryButton().click()
  }

  async selectDirectory(name: string) {
    await this.getDirectoryItemByName(name).click()
  }

  async clickCloneRepo() {
    await this.getGitModuleCloneButton().click()
  }

  // Assertions
  async expectToBeVisible() {
    await expect(this.getProjectTitle()).toBeVisible()
  }

  async expectDirectoryToBeVisible(name: string) {
    await expect(this.getDirectoryItemByName(name)).toBeVisible()
  }

  async expectNoDirectories() {
    await expect(this.getDirectoryItems()).toHaveCount(0)
  }

  async expectProjectIntroToBeVisible() {
    await expect(this.getProjectIntroSection()).toBeVisible()
  }

  async expectModuleContentToBeVisible() {
    await expect(this.getModuleContentArea()).toBeVisible()
  }
}

/**
 * Create ProjectWorkspacePage instance
 */
export function createProjectWorkspacePage(page: Page) {
  return new ProjectWorkspacePage(page)
}
