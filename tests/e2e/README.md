# E2E Tests for MyFlow (Tauri Desktop App)

This directory contains Playwright-based end-to-end tests for the MyFlow desktop application.
Tests use the **official Tauri 2.0 WebDriver approach** — tests run against the real compiled Tauri application via Chrome DevTools Protocol (CDP).

## Official Tauri WebDriver Testing

This project follows the official Tauri 2.0 WebDriver testing guide:
<https://v2.tauri.app/develop/tests/webdriver/>

Key differences from the old approach (Vite dev server + browser mocks):
- Tests run against the **real Tauri desktop application** (WebView2 on Windows)
- Uses **CDP (Chrome DevTools Protocol)** via `tauri-plugin-webdriver`
- **No browser-side Tauri API mocking** — the real Rust backend handles all commands
- The app must be built before tests can run

## Prerequisites

### 1. Install Playwright Browsers

```bash
pnpm test:e2e:install
```

This installs Playwright's Chromium browser.

### 2. Install Tauri WebDriver (Windows)

```bash
pnpm test:e2e:webdriver
```

This installs the WebView2 driver required for Tauri WebDriver testing.

### 3. Build the Tauri Application

```bash
pnpm test:e2e:build
```

This compiles the Rust backend and creates the desktop application executable at:
```
src-tauri/target/release/pm-app.exe
```

The app **must be built before running tests**. If the executable is missing, the test configuration will fail with a clear error message.

## Running Tests

### Full Workflow

```bash
# 1. Build the app (only needed after code changes)
pnpm test:e2e:build

# 2. Install/update webdriver (only needed once or after updates)
pnpm test:e2e:webdriver

# 3. Run tests
pnpm test:e2e
```

### Run in Headed Mode (See the App Window)

```bash
pnpm test:e2e:headed
```

### Run with Playwright UI (Visual Test Runner)

```bash
pnpm test:e2e:ui
```

### Debug Mode (With Playwright Inspector)

```bash
pnpm test:e2e:debug
```

### Run Specific Test Files

```bash
pnpm test:e2e:workspace
pnpm test:e2e:projects
pnpm test:e2e:settings
pnpm test:e2e:project-workspace
```

### Run Tests by Pattern

```bash
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

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Playwright Test Runner                                  │
│  (connects via CDP to Tauri app)                        │
└──────────┬──────────────────────────────────────────────┘
           │ Chrome DevTools Protocol (CDP)
           │ ws://127.0.0.1:9222/devtools/browser/...
           ▼
┌─────────────────────────────────────────────────────────┐
│  Tauri Desktop Application (WebView2)                    │
│  src-tauri/target/release/pm-app.exe                    │
│  - Vite frontend (Vue 3 + TypeScript)                   │
│  - Rust backend (workspace, projects, git, fs commands)│
│  - Real SQLite database                                │
│  - Real Git operations                                  │
└─────────────────────────────────────────────────────────┘
```

### App Launch Sequence

1. `global-setup.ts` runs before all tests
2. Launches `src-tauri/target/release/pm-app.exe` with `--webdriver-port 9222`
3. App stdout contains: `DevTools listening on ws://127.0.0.1:9222/devtools/browser/...`
4. The URL is captured and stored in `.cdp-url`
5. Playwright connects to the app via CDP
6. Tests navigate to pages using the app's internal routing

### Shutdown Sequence

1. After all tests complete, `global-teardown.ts` runs
2. Kills the Tauri app process
3. Cleans up temporary files (`.cdp-url`, `.test-workspace/`)

## Project Structure

```
tests/e2e/
├── global-setup.ts              # Launches Tauri app before tests
├── global-teardown.ts           # Kills Tauri app after tests
├── launch-tauri.ps1             # PowerShell script to launch app and capture CDP URL
├── launch-tauri.sh              # Bash script to launch app (macOS/Linux)
├── page-objects/                # Page Object Model classes
│   ├── BasePage.ts              # Base page object
│   ├── WorkspacePage.ts         # /workspace route
│   ├── ProjectsPage.ts         # /projects route
│   ├── SettingsPage.ts          # /settings/* routes
│   └── ProjectWorkspacePage.ts  # /projects/:id route
├── specs/                       # Test specifications
│   ├── workspace.spec.ts        # Workspace page tests
│   ├── projects.spec.ts        # Projects page tests
│   ├── settings.spec.ts         # Settings page tests
│   ├── project-workspace.spec.ts # Project workspace tests
│   ├── git-module.spec.ts       # Git module UI tests
│   ├── file-module.spec.ts      # File module UI tests
│   ├── git-module.integration.spec.ts  # Git module integration (real backend)
│   └── file-module.integration.spec.ts  # File module integration (real backend)
└── utils/
    ├── tauri-mocks.ts           # (Deprecated) Console error monitoring utilities
    ├── tauri-launcher.ts        # App launch helper (used by global-setup)
    └── test-helpers.ts          # Common test utilities
```

## Page Object Model

Tests use the Page Object Model pattern:

```typescript
import { test, expect } from '@playwright/test'
import { createWorkspacePage } from '../page-objects'

test('my test', async ({ workspacePage }) => {
  await workspacePage.goto()
  // ...
})
```

## Console Error Monitoring

Tests monitor console errors using `setupConsoleErrorListener` from `tauri-mocks.ts`:

```typescript
import { setupConsoleErrorListener } from '../utils/tauri-mocks'

test('no critical errors', async ({ page }) => {
  const { errors, cleanup } = setupConsoleErrorListener(page)
  await page.goto('/workspace')
  // ... assertions ...
  cleanup()

  // Filter known non-critical errors
  const critical = errors.filter(
    (e) => !KNOWN_NON_CRITICAL_ERRORS.some((p) => p.test(e))
  )
  expect(critical).toHaveLength(0)
})
```

## Known Non-Critical Errors

The following errors are expected and do not fail tests:
- `invoke.*error` — Tauri command returned an error (app handles gracefully)
- `ENOENT|no such file` — File not found (expected when no data exists)
- `git.*error` — Git operation error (expected when no repos exist)
- `network.*error` — Network error (offline scenarios)
- `permission.*denied` — Permission denied (desktop app permission model)
- `database.*not found` — Database not found (app creates it automatically)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CI` | Running in CI environment | `false` |
| `BASE_URL` | Override base URL | `http://localhost:9222` |
| `TAURI_WEBDRIVER_PORT` | WebDriver/CDP port | `9222` |

## Troubleshooting

### "Tauri executable not found"

Run `pnpm test:e2e:build` to compile the application.

### "Timeout waiting for Tauri app to start"

1. Check if another Tauri app is running (port conflict)
2. Run in headed mode to see what's happening: `pnpm test:e2e:headed`
3. Try killing any existing Tauri processes
4. Check that the app builds and runs manually: `cd src-tauri && cargo run`

### " CDP URL not found in stdout"

The app may not be logging the DevTools URL. Check:
1. `devtools: true` is set in `src-tauri/tauri.conf.json`
2. `tauri-plugin-webdriver` is initialized in `src-tauri/src/lib.rs`
3. `core:webdriver:default` permission is in `src-tauri/capabilities/default.json`

### "WebView2 not found" (Windows)

Run `pnpm test:e2e:webdriver` to install the WebView2 driver.

### "Page did not load" errors

1. Check if the Tauri app is running correctly manually: `src-tauri/target/release/pm-app.exe`
2. Check if devtools are enabled: `devtools: true` in tauri.conf.json
3. Try running in headed mode: `pnpm test:e2e:headed`

### Console errors in tests

Some console errors are expected in real Tauri apps. The `KNOWN_NON_CRITICAL_ERRORS` list in `tauri-mocks.ts` filters common non-critical errors. If you see unexpected errors:

1. Check if the error is a genuine bug or expected behavior
2. If expected, add it to `KNOWN_NON_CRITICAL_ERRORS`
3. If it's a genuine bug, investigate the cause

## CI/CD Integration

In CI environments:
- Tests run sequentially (1 worker)
- 2 retries for failed tests
- No reuse of existing server

```bash
CI=true pnpm test:e2e
```

## Writing New Tests

### Creating a New Test File

1. Create a new spec file in `tests/e2e/specs/`
2. Import page objects
3. Use `test.describe` to group related tests

```typescript
import { test, expect } from '@playwright/test'
import { createMyPage, MyPage } from '../page-objects'

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    const myPage = createMyPage(page)
    await myPage.goto()
    // ...
  })
})
```

### Console Error Monitoring

Always set up console error monitoring in `beforeEach`:

```typescript
test.beforeEach(async ({ page }) => {
  const { errors, cleanup } = setupConsoleErrorListener(page)
  // Store cleanup for afterEach
})
```

## Differences from Old Approach

| Aspect | Old (Vite + Mocks) | New (Tauri WebDriver) |
|--------|-------------------|----------------------|
| Backend | Mocked in browser | Real Rust backend |
| App | Vite dev server | Built Tauri app |
| Browser | Playwright Chromium | Tauri WebView2 |
| Data | Hardcoded mocks | Real app data |
| Coverage | Frontend only | Full stack |
| Setup | `pnpm dev` | `pnpm tauri build` |
| Speed | Fast (no build) | Slow (builds app) |
