# E2E 测试智能体

## 概述

E2E（端到端）测试智能体通过 Playwright + Tauri WebDriver 对应用进行完整的用户流程测试，验证前端与 Rust 后端的集成。

## 触发条件

- 运行 `pnpm test:e2e` 时触发
- 运行 `pnpm test:e2e:ui` 时触发（交互模式）
- 可选：在提交前运行 `pnpm test:e2e:headed` 进行可视化验证

## 前置条件

### 1. 安装浏览器

```bash
pnpm test:e2e:install
```

### 2. 确认 tauri-plugin-webdriver 已启用

插件仅在 `debug` 构建中启用，确保使用 `cargo tauri dev` 或 `cargo tauri build --debug`。

## 测试任务

### 1. E2E 测试运行

```bash
pnpm test:e2e
```

**通过标准：**
- 所有 Playwright 测试用例通过
- 无关键控制台错误
- Tauri 应用正常启动

### 2. E2E 测试（UI 模式）

```bash
pnpm test:e2e:ui
```

适合调试测试用例，可视化操作过程。

### 3. E2E 测试（有头模式）

```bash
pnpm test:e2e:headed
```

在浏览器有头模式下运行，可观察实际交互。

## 测试文件结构

```
tests/
└── e2e/
    ├── page-objects/          # Page Object 模式
    │   └── WorkspacePage.ts    # 工作区页面对象
    └── specs/                  # 测试用例
        └── workspace.spec.ts   # 工作区测试
```

## 测试规范

### Page Object 模式

每个页面/组件应有对应的 Page Object：

```typescript
// tests/e2e/page-objects/ExamplePage.ts
export class ExamplePage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/example')
  }

  getSubmitButton() {
    return this.page.getByRole('button', { name: '提交' })
  }
}

export function createExamplePage(page: Page) {
  return new ExamplePage(page)
}
```

### 测试用例编写

```typescript
import { test, expect } from '@playwright/test'
import { createExamplePage, ExamplePage } from '../page-objects/ExamplePage'

test.describe('功能描述', () => {
  let examplePage: ExamplePage

  test.beforeEach(async ({ page }) => {
    examplePage = createExamplePage(page)
  })

  test('应该执行某个操作', async () => {
    await examplePage.goto()
    await expect(examplePage.getSubmitButton()).toBeVisible()
  })
})
```

### 定位器优先顺序

1. **角色定位**（最推荐，用户可见）
   ```typescript
   page.getByRole('button', { name: '提交' })
   page.getByRole('textbox', { name: '用户名' })
   ```

2. **文本定位**
   ```typescript
   page.getByText('欢迎登录')
   page.getByLabel('记住密码')
   ```

3. **测试 ID**（需开发者在代码中添加）
   ```typescript
   page.getByTestId('submit-button')
   ```

4. **CSS/ XPath**（最后考虑，容易失效）
   ```typescript
   page.locator('.btn-primary')
   page.locator('//button[@type="submit"]')
   ```

### 已知非关键错误

以下错误在浏览器环境下是预期的，无需阻止测试通过：

```typescript
const KNOWN_NON_CRITICAL_ERRORS = [
  /Cannot read properties of undefined.*invoke/,   // Tauri API 在浏览器中不可用
  /Cannot read properties of undefined.*metadata/, // 窗口 API 在浏览器中不可用
  /Failed to load recent workspaces/,             // 预期行为
  /Failed to load settings/,                       // 预期行为
  /Failed to update window title/,                 // 预期行为
]
```

## 测试覆盖建议

### 必须覆盖
- [ ] 用户登录/登出流程
- [ ] 页面导航
- [ ] 主要 CRUD 操作
- [ ] 表单提交和验证
- [ ] 错误处理

### 建议覆盖
- [ ] 多语言切换
- [ ] 主题切换
- [ ] 文件上传/预览
- [ ] 数据搜索和过滤
- [ ] 分页和排序

## 失败处理

### 截图和追踪

测试失败时，Playwright 自动：
- 截取失败时刻的截图
- 保存完整的执行追踪到 `test-results/`

### 调试步骤

1. 查看截图：`test-results/*/chromium-failure-*.png`
2. 查看追踪：`npx playwright show-trace test-results/*/trace.zip`
3. 运行单个测试：`pnpm test:e2e --grep "测试名称"`
4. 添加 `test.only()` 进行单独调试

## 持续集成

在 CI 环境中运行：

```yaml
# .github/workflows/e2e.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - run: pnpm install
      - run: pnpm test:e2e:install
      - run: pnpm test:e2e
```

## 使用方式

```bash
# 运行所有 E2E 测试
pnpm test:e2e

# 打开 Playwright UI 进行交互式调试
pnpm test:e2e:ui

# 在有头模式下运行（可见浏览器）
pnpm test:e2e:headed

# 安装/更新浏览器
pnpm test:e2e:install

# 运行特定测试
pnpm test:e2e --grep "工作区"

# 生成 HTML 报告
pnpm test:e2e --reporter=html
```

## 报告格式

```
========================================
E2E 测试报告
========================================

测试环境:
  平台: Windows / macOS / Linux
  浏览器: Chromium / Firefox / WebKit
  应用: Tauri v2

测试结果:
  总数: X 个
  通过: X 个
  失败: X 个
  跳过: X 个

时间:
  开始: HH:MM:SS
  结束: HH:MM:SS
  耗时: Xm Xs

详细结果:
  ✅ 工作区页面应该正常加载
  ✅ 语言切换应该正常工作
  ❌ 设置页面导航失败

总体状态: 通过 / 失败
========================================
```
