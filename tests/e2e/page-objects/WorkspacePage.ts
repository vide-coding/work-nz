import { test, expect, Page } from '@playwright/test'
import path from 'node:path'

/**
 * Workspace Page - Page Object
 */
export class WorkspacePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/workspace')
  }

  // 等待页面加载完成
  async waitForLoad() {
    await this.page.waitForLoadState('domcontentloaded')
  }

  // 获取页面标题
  getTitle() {
    return this.page.title()
  }

  // 查找主要标题
  getMainHeading() {
    return this.page.locator('h1').first()
  }

  // 查找语言切换按钮
  getLanguageButton() {
    return this.page.getByRole('button', { name: /中文|EN/i })
  }

  // 查找主题切换按钮
  getThemeButton() {
    return this.page.getByRole('button', { name: /System|Light|Dark/i })
  }

  // 查找设置按钮
  getSettingsButton() {
    return this.page.getByRole('button', { name: '设置' })
  }

  // 查找选择工作区按钮
  getSelectWorkspaceButton() {
    return this.page.getByRole('button', { name: /选择或创建工作区/i })
  }

  // 查找进入工作区按钮
  getEnterWorkspaceButton() {
    return this.page.getByRole('button', { name: /进入工作区/i })
  }

  // 切换语言
  async switchLanguage() {
    await this.getLanguageButton().click()
  }

  // 切换主题
  async switchTheme() {
    await this.getThemeButton().click()
  }

  // 打开设置
  async openSettings() {
    await this.getSettingsButton().click()
  }

  // 检查是否有控制台错误（过滤掉已知的 Tauri API 错误）
  async checkConsoleErrors(filterPatterns: RegExp[] = []) {
    const errors: string[] = []
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // 过滤掉已知的非关键错误
        const isFiltered = filterPatterns.some((pattern) => pattern.test(text))
        if (!isFiltered) {
          errors.push(text)
        }
      }
    })
    return errors
  }
}

/**
 * 创建 WorkspacePage 实例
 */
export function createWorkspacePage(page: Page) {
  return new WorkspacePage(page)
}
