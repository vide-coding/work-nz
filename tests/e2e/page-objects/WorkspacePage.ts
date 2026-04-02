import { test, expect, Page, Locator } from '@playwright/test'
import { BasePage, createBasePage } from './BasePage'
import { BASE_URL } from '../utils/url-helper'

/**
 * WorkspacePage - Page object for workspace selection view
 *
 * Route: /workspace
 */
export class WorkspacePage {
  readonly base: BasePage

  constructor(readonly page: Page) {
    this.base = createBasePage(page)
  }

  // Locators
  getMainHeading(): Locator {
    return this.page.locator('h1').first()
  }

  getLanguageButton(): Locator {
    // The button shows "中文" (Chinese) or "EN" / "Chinese" or "English" depending on locale
    // Use a flexible regex to match common language button texts
    return this.page.locator('button').filter({ hasText: /^(中文|Chinese|EN|English|英文)$/ }).first()
  }

  getThemeButton(): Locator {
    // The theme button shows System/Light/Dark
    return this.page.locator('button').filter({ hasText: /^(System|Light|Dark)$/ }).first()
  }

  getSettingsButton(): Locator {
    return this.page.getByRole('button', { name: '设置' }).or(this.page.getByRole('button', { name: 'Settings', exact: true }))
  }

  getSelectOrCreateButton(): Locator {
    return this.page.getByRole('button', { name: /选择或创建工作区|Select or Create Workspace/i })
  }

  getEnterWorkspaceButton(): Locator {
    return this.page.getByRole('button', { name: /进入工作区|Enter Workspace/i })
  }

  getRecentWorkspacesList(): Locator {
    return this.page.locator('[class*="space-y-2"]').first()
  }

  getRecentWorkspaceItems(): Locator {
    return this.page.locator('[class*="WorkspaceItem"], [class*="workspace-item"]')
  }

  getWorkspaceItemByName(name: string): Locator {
    return this.page.locator('text=' + name).first()
  }

  getErrorMessage(): Locator {
    return this.page.locator('[class*="bg-red"], [class*="bg-red-50"], [class*="error"]').first()
  }

  // Actions
  async goto() {
    await this.page.goto(`${BASE_URL}/workspace`)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
    // Wait for page to be fully rendered
    await this.page.waitForTimeout(500)
  }

  async switchLanguage() {
    await this.getLanguageButton().click()
  }

  async switchTheme() {
    await this.getThemeButton().click()
  }

  async openSettings() {
    await this.getSettingsButton().click()
  }

  async selectWorkspace(name: string) {
    await this.getWorkspaceItemByName(name).click()
  }

  async clickEnterWorkspace() {
    await this.getEnterWorkspaceButton().click()
  }

  async clickSelectOrCreate() {
    await this.getSelectOrCreateButton().click()
  }

  // Assertions
  async expectToBeVisible() {
    await expect(this.getMainHeading()).toBeVisible()
  }

  async expectRecentWorkspacesToBeVisible() {
    await expect(this.getRecentWorkspacesList()).toBeVisible()
  }

  async expectEnterButtonToBeEnabled() {
    await expect(this.getEnterWorkspaceButton()).toBeEnabled()
  }

  async expectEnterButtonToBeDisabled() {
    await expect(this.getEnterWorkspaceButton()).toBeDisabled()
  }

  async expectTitleToContain(text: string) {
    await expect(this.getMainHeading()).toContainText(text)
  }
}

/**
 * Create WorkspacePage instance
 */
export function createWorkspacePage(page: Page) {
  return new WorkspacePage(page)
}
