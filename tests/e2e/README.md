# E2E Tests for MyFlow (Tauri Desktop App)

This directory contains Playwright-based end-to-end tests for the MyFlow desktop application.

## Project Structure

```
tests/e2e/
├── page-objects/           # Page Object Model classes
│   ├── BasePage.ts         # Base page object with common methods
│   ├── WorkspacePage.ts    # Workspace selection page (/workspace)
│   ├── ProjectsPage.ts     # Projects list page (/projects)
│   ├── SettingsPage.ts     # Settings pages (/settings/*)
│   └── ProjectWorkspacePage.ts  # Project workspace page (/projects/:id)
├── specs/                  # Test specifications
│   ├── workspace.spec.ts   # Workspace page tests
│   ├── projects.spec.ts    # Projects page tests
│   ├── settings.spec.ts    # Settings page tests
│   └── project-workspace.spec.ts  # Project workspace tests
├── utils/                  # Test utilities
│   ├── tauri-mocks.ts      # Tauri backend mocking utilities
│   └── test-helpers.ts     # Common test helper functions
└── fixtures/               # Playwright test fixtures
    └── index.ts            # Typed fixtures for pages
```

## Running Tests

### Prerequisites

1. Install Playwright browsers:
```bash
pnpm test:e2e:install
```

### Run All E2E Tests

```bash
# Run in headless mode (default)
pnpm test:e2e

# Run with UI (recommended for debugging)
pnpm test:e2e:ui

# Run headed (see browser window)
pnpm test:e2e:headed
```

### Run Specific Test Files

```bash
# Run only workspace tests
pnpm test:e2e:workspace

# Run only projects tests
pnpm test:e2e:projects

# Run only settings tests
pnpm test:e2e:settings

# Run only project workspace tests
pnpm test:e2e:project-workspace
```

### Run Tests by Pattern

```bash
# Run tests matching a pattern
pnpm test:e2e:grep "should load"
```

### List Available Tests

```bash
pnpm test:e2e:list
```

### View Test Report

```bash
pnpm test:e2e:show-report
```

## Test Architecture

### Page Object Model

Tests use the Page Object Model pattern for better maintainability:

```typescript
import { createWorkspacePage, WorkspacePage } from '../page-objects'

test('my test', async ({ page }) => {
  const workspacePage = createWorkspacePage(page)
  await workspacePage.goto()
  // ...
})
```

Or use fixtures for cleaner test code:

```typescript
test('my test', async ({ workspacePage }) => {
  await workspacePage.goto()
  // ...
})
```

### Tauri Mocking

For testing without a running Tauri backend, use the mocking utilities:

```typescript
import { mockWorkspaceApi, mockProjectApi } from '../utils/tauri-mocks'

test('my test', async ({ page }) => {
  // Mock workspace API responses
  await mockWorkspaceApi(page, {
    recentWorkspaces: [{ path: '/test', alias: 'Test' }],
    settings: { themeMode: 'dark' }
  })

  // Test with mocked data
  await page.goto('/workspace')
  // ...
})
```

### Known Non-Critical Errors

The test suite filters out known Tauri API errors that occur in browser environments:

```typescript
import { KNOWN_NON_CRITICAL_ERRORS } from '../utils/tauri-mocks'
```

These errors are expected and don't fail tests:
- `Cannot read properties of undefined.*invoke`
- `Failed to load recent workspaces`
- `Failed to update window title`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CI` | Running in CI environment | `false` |
| `BASE_URL` | Override base URL | `http://localhost:1420` |
| `TAURI_DEBUG` | Enable Tauri debug mode | `true` |

## Troubleshooting

### Tests timeout or fail to start

1. Make sure no other process is using port 1420
2. Check if Tauri dev server starts correctly manually: `pnpm tauri dev`
3. Try reinstalling Playwright: `pnpm test:e2e:install`

### Console errors in tests

Some console errors are filtered as known non-critical errors. If you see unexpected errors:

1. Check the `KNOWN_NON_CRITICAL_ERRORS` list in `tauri-mocks.ts`
2. Add new known errors if they're not critical

### "Page did not load" errors

The Tauri app requires the Rust backend to be running. Make sure:

1. `pnpm tauri dev` works manually
2. The webServer configuration in `playwright.config.ts` is correct

## Writing New Tests

### Creating a New Test File

1. Create a new spec file in `tests/e2e/specs/`
2. Import page objects and utilities
3. Use `test.describe` to group related tests

```typescript
import { test, expect } from '@playwright/test'
import { createMyPage, MyPage } from '../page-objects'

test.describe('My Feature', () => {
  let myPage: MyPage

  test.beforeEach(async ({ page }) => {
    myPage = createMyPage(page)
  })

  test('should do something', async () => {
    await myPage.goto()
    // ...
  })
})
```

### Creating a New Page Object

1. Create a new class in `tests/e2e/page-objects/`
2. Extend `BasePage` for common functionality
3. Export a factory function `createXxxPage(page: Page)`

```typescript
import { Page, Locator } from '@playwright/test'
import { BasePage, createBasePage } from './BasePage'

export class MyPage {
  readonly base: BasePage

  constructor(readonly page: Page) {
    this.base = createBasePage(page)
  }

  getMyButton(): Locator {
    return this.page.getByRole('button', { name: 'My Button' })
  }

  async clickMyButton() {
    await this.getMyButton().click()
  }
}

export function createMyPage(page: Page) {
  return new MyPage(page)
}
```

## CI/CD Integration

In CI environments, tests run with:
- Sequential execution (1 worker)
- 2 retries for failed tests
- No reuse of existing server

```bash
CI=true pnpm test:e2e
```
