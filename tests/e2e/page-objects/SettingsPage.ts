import { Page, Locator, expect } from '@playwright/test'
import { BasePage, createBasePage } from './BasePage'
import { BASE_URL } from '../utils/url-helper'

/**
 * SettingsPage - Page object for settings views
 *
 * Routes: /settings/global, /settings/workspace
 * Note: This app uses URL-based navigation, not tabs
 */
export class SettingsPage {
  readonly base: BasePage

  constructor(readonly page: Page) {
    this.base = createBasePage(page)
  }

  // Header - shows settings type based on URL
  getSettingsHeader(): Locator {
    return this.page.locator('text=/全局设置|Global Settings|工作区设置|Workspace Settings/i').first()
  }

  // Navigation - Back button
  getBackButton(): Locator {
    return this.page.getByRole('button').filter({ has: this.page.locator('[class*="ArrowLeft"]') }).first()
  }

  // Theme settings - uses select dropdown, not radio buttons
  getThemeSelect(): Locator {
    return this.page.locator('select').first()
  }

  // Language settings - uses select dropdown
  getLanguageSelect(): Locator {
    return this.page.locator('select').nth(1)
  }

  // Font size settings
  getFontSizeSelect(): Locator {
    return this.page.locator('select').nth(2)
  }

  // Reset button
  getResetButton(): Locator {
    return this.page.getByRole('button', { name: /重置|Reset/i })
  }

  // Loading state
  getLoadingSpinner(): Locator {
    return this.page.locator('[class*="animate-spin"], [class*="spinner"]').first()
  }

  // Settings sections
  getAppearanceSection(): Locator {
    return this.page.locator('text=/外观|Appearance/i').first()
  }

  getIdeSection(): Locator {
    return this.page.locator('text=/IDE/i').first()
  }

  // Actions
  async gotoGlobal() {
    await this.page.goto(`${BASE_URL}/settings/global`)
  }

  async gotoWorkspace() {
    await this.page.goto(`${BASE_URL}/settings/workspace`)
  }

  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
    // Wait for loading to finish if present
    await this.page.waitForTimeout(500)
  }

  async selectTheme(theme: 'light' | 'dark' | 'system') {
    const select = this.getThemeSelect()
    await select.selectOption(theme)
  }

  async selectLanguage(lang: 'zh-CN' | 'en-US') {
    const select = this.getLanguageSelect()
    await select.selectOption(lang)
  }

  async selectFontSize(size: 'small' | 'medium' | 'large') {
    const select = this.getFontSizeSelect()
    await select.selectOption(size)
  }

  async clickReset() {
    await this.getResetButton().click()
  }

  // Assertions
  async expectToBeVisible() {
    await expect(this.getSettingsHeader()).toBeVisible()
  }

  async expectGlobalSettingsToBeVisible() {
    await expect(this.getSettingsHeader()).toContainText(/全局设置|Global Settings/i)
  }

  async expectWorkspaceSettingsToBeVisible() {
    await expect(this.getSettingsHeader()).toContainText(/工作区设置|Workspace Settings/i)
  }
}

/**
 * Create SettingsPage instance
 */
export function createSettingsPage(page: Page) {
  return new SettingsPage(page)
}
