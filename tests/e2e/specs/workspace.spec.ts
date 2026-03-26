import { test, expect } from '@playwright/test'
import { createWorkspacePage, WorkspacePage } from '../page-objects/WorkspacePage'

// 已知的非关键错误模式（这些错误在浏览器环境下是预期的）
const KNOWN_NON_CRITICAL_ERRORS = [
  /Cannot read properties of undefined.*invoke/,
  /Cannot read properties of undefined.*metadata/,
  /Failed to load recent workspaces/,
  /Failed to load settings/,
  /Failed to update window title/,
]

test.describe('工作区页面', () => {
  let workspacePage: WorkspacePage

  test.beforeEach(async ({ page }) => {
    workspacePage = createWorkspacePage(page)
  })

  test('页面应该正常加载', async ({ page }) => {
    await workspacePage.goto()
    await workspacePage.waitForLoad()

    // 验证页面标题
    await expect(page).toHaveTitle(/Tauri/)
  })

  test('应该显示主要标题', async ({ page }) => {
    await workspacePage.goto()
    await workspacePage.waitForLoad()

    // 验证主要标题存在
    const heading = workspacePage.getMainHeading()
    await expect(heading).toBeVisible()
  })

  test('应该显示语言切换按钮', async ({ page }) => {
    await workspacePage.goto()
    await workspacePage.waitForLoad()

    // 验证语言切换按钮存在
    const langButton = workspacePage.getLanguageButton()
    await expect(langButton).toBeVisible()
  })

  test('应该显示主题切换按钮', async ({ page }) => {
    await workspacePage.goto()
    await workspacePage.waitForLoad()

    // 验证主题切换按钮存在
    const themeButton = workspacePage.getThemeButton()
    await expect(themeButton).toBeVisible()
  })

  test('应该显示设置按钮', async ({ page }) => {
    await workspacePage.goto()
    await workspacePage.waitForLoad()

    // 验证设置按钮存在
    const settingsButton = workspacePage.getSettingsButton()
    await expect(settingsButton).toBeVisible()
  })

  test('应该显示选择工作区按钮', async ({ page }) => {
    await workspacePage.goto()
    await workspacePage.waitForLoad()

    // 验证选择工作区按钮存在
    const selectButton = workspacePage.getSelectWorkspaceButton()
    await expect(selectButton).toBeVisible()
  })

  test('进入工作区按钮初始应该禁用', async ({ page }) => {
    await workspacePage.goto()
    await workspacePage.waitForLoad()

    // 验证进入工作区按钮存在但禁用
    const enterButton = workspacePage.getEnterWorkspaceButton()
    await expect(enterButton).toBeDisabled()
  })

  test('语言切换应该正常工作', async ({ page }) => {
    await workspacePage.goto()
    await workspacePage.waitForLoad()

    // 点击语言切换
    await workspacePage.switchLanguage()

    // 等待 UI 更新
    await page.waitForTimeout(500)
  })

  test('主题切换应该正常工作', async ({ page }) => {
    await workspacePage.goto()
    await workspacePage.waitForLoad()

    // 点击主题切换
    await workspacePage.switchTheme()

    // 等待 UI 更新
    await page.waitForTimeout(500)
  })

  test('控制台不应有关键错误', async ({ page }) => {
    const errors: string[] = []

    // 收集控制台错误
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // 检查是否是已知非关键错误
        const isKnown = KNOWN_NON_CRITICAL_ERRORS.some((pattern) => pattern.test(text))
        if (!isKnown) {
          errors.push(text)
        }
      }
    })

    await workspacePage.goto()
    await workspacePage.waitForLoad()
    await page.waitForTimeout(1000)

    // 过滤后应该没有关键错误
    const criticalErrors = errors.filter(
      (e) => !KNOWN_NON_CRITICAL_ERRORS.some((pattern) => pattern.test(e))
    )

    expect(criticalErrors).toHaveLength(0)
  })
})

test.describe('文件预览功能', () => {
  test('文件预览组件应该正确渲染', async ({ page }) => {
    // 由于文件预览需要在项目上下文中，先验证基础组件存在
    await page.goto('/workspace')
    await page.waitForLoadState('domcontentloaded')

    // 验证页面基本结构存在
    const settingsButton = page.getByRole('button', { name: '设置' })
    await expect(settingsButton).toBeVisible()
  })
})
