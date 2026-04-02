import { Page, Locator, expect } from '@playwright/test'
import { BasePage, createBasePage } from './BasePage'
import { BASE_URL } from '../utils/url-helper'

/**
 * ProjectsPage - Page object for project list view
 *
 * Route: /projects
 */
export class ProjectsPage {
  readonly base: BasePage

  constructor(readonly page: Page) {
    this.base = createBasePage(page)
  }

  // Header locators
  getSwitchWorkspaceButton(): Locator {
    return this.page.getByRole('button', { name: /切换工作区|Switch Workspace/i })
  }

  getSettingsButton(): Locator {
    return this.page.getByRole('button', { name: '设置' }).or(this.page.getByRole('button', { name: 'Settings', exact: true }))
  }

  getThemeButton(): Locator {
    return this.page.locator('button').filter({ hasText: /^(System|Light|Dark)$/ }).first()
  }

  getLanguageButton(): Locator {
    return this.page.locator('button').filter({ hasText: /^(中文|Chinese|EN|English|英文)$/ }).first()
  }

  getNewProjectButton(): Locator {
    return this.page.getByRole('button', { name: /新建项目|New Project/i })
  }

  // Search and filter
  getSearchInput(): Locator {
    return this.page.getByPlaceholder(/搜索项目|Search projects/i)
  }

  getPreviewToggle(): Locator {
    return this.page.locator('[class*="Preview"]').first()
  }

  // Project list
  getProjectList(): Locator {
    return this.page.locator('[class*="grid"], [class*="ProjectCard"]')
  }

  getProjectCards(): Locator {
    return this.page.locator('[class*="ProjectCard"], [class*="project-card"]')
  }

  getProjectCardByName(name: string): Locator {
    return this.page.locator('[class*="ProjectCard"], [class*="project-card"]').filter({ hasText: name }).first()
  }

  // Empty state
  getEmptyState(): Locator {
    return this.page.locator('text=/暂无项目|No projects yet/i')
  }

  getEmptyStateHint(): Locator {
    return this.page.locator('text=/点击上方按钮创建新项目|Click the button above/i')
  }

  // Loading state
  getLoadingSpinner(): Locator {
    return this.page.locator('[class*="Loader2"], [class*="animate-spin"]').first()
  }

  // Dialogs - BaseDialog uses Teleport to body with role="dialog"
  getCreateProjectDialog(): Locator {
    // The dialog is teleported to body and uses Transition + div with role="dialog"
    // Look for the dialog overlay which is a fixed div covering the screen
    return this.page.locator('[role="dialog"]').filter({ hasText: /新建项目|New Project/i }).first()
  }

  getProjectNameInput(): Locator {
    return this.page.locator('[role="dialog"] input[type="text"], input[placeholder*="project name" i]').first()
  }

  getProjectDescriptionInput(): Locator {
    return this.page.locator('[role="dialog"] textarea').first()
  }

  getCreateButton(): Locator {
    return this.page.getByRole('button', { name: /创建|Create/i })
  }

  getCancelButton(): Locator {
    return this.page.getByRole('button', { name: /取消|Cancel/i })
  }

  // Actions
  async goto() {
    await this.page.goto(`${BASE_URL}/projects`)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
    // Wait for projects to potentially load
    await this.page.waitForTimeout(500)
  }

  async clickNewProject() {
    await this.getNewProjectButton().click()
  }

  async fillCreateProjectForm(name: string, description?: string) {
    await this.getProjectNameInput().fill(name)
    if (description) {
      await this.getProjectDescriptionInput().fill(description)
    }
  }

  async submitCreateProject() {
    await this.getCreateButton().click()
  }

  async searchProjects(query: string) {
    await this.getSearchInput().fill(query)
  }

  async switchTheme() {
    await this.getThemeButton().click()
  }

  async switchLanguage() {
    await this.getLanguageButton().click()
  }

  async switchWorkspace() {
    await this.getSwitchWorkspaceButton().click()
  }

  async openSettings() {
    await this.getSettingsButton().click()
  }

  async clickProjectCard(name: string) {
    await this.getProjectCardByName(name).click()
  }

  // Assertions
  async expectToBeVisible() {
    await expect(this.getNewProjectButton()).toBeVisible()
  }

  async expectProjectToBeVisible(name: string) {
    await expect(this.getProjectCardByName(name)).toBeVisible()
  }

  async expectNoProjects() {
    await expect(this.getEmptyState()).toBeVisible()
  }

  async expectCreateDialogToBeVisible() {
    await expect(this.getCreateProjectDialog()).toBeVisible()
  }

  async expectCreateDialogToBeHidden() {
    await expect(this.getCreateProjectDialog()).toBeHidden()
  }
}

/**
 * Create ProjectsPage instance
 */
export function createProjectsPage(page: Page) {
  return new ProjectsPage(page)
}
