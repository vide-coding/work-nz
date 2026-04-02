import { defineConfig } from '@playwright/test'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Tauri WebDriver E2E Test Configuration
 *
 * Follows the official Tauri 2.0 WebDriver testing approach:
 * https://v2.tauri.app/develop/tests/webdriver/
 *
 * How it works:
 * 1. global-setup.ts launches the built Tauri app with TAURI_WEBDRIVER_PORT=9222
 *    The tauri-plugin-webdriver registers an HTTP server implementing W3C WebDriver.
 * 2. The WebDriver URL (http://127.0.0.1:9222) is written to .webdriver-url file.
 * 3. Playwright connects to this URL using the `webDriver` option (W3C WebDriver protocol).
 * 4. global-teardown.ts kills the app after tests complete.
 *
 * Prerequisites:
 *   1. pnpm tauri build   # Build the Tauri application (includes webdriver plugin)
 *   2. pnpm test:e2e      # Run the tests
 */

// ============================================================================
// ESM __dirname workaround
// ============================================================================

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ============================================================================
// WebDriver URL Resolution
// ============================================================================

/** File where the WebDriver HTTP URL is stored by global-setup.ts */
const WEBDRIVER_URL_FILE = path.join(__dirname, '.webdriver-url')

/**
 * Read the stored WebDriver URL from the file written by globalSetup.
 */
function getStoredWebDriverUrl(): string | null {
  try {
    if (fs.existsSync(WEBDRIVER_URL_FILE)) {
      const url = fs.readFileSync(WEBDRIVER_URL_FILE, 'utf8').trim()
      if (url && url.startsWith('http://')) {
        return url
      }
    }
  } catch {
    // Ignore
  }
  return null
}

// ============================================================================
// Pre-flight checks
// ============================================================================

function checkTauriBuild(): void {
  const exePath = path.join(__dirname, 'src-tauri/target/release/pm-app.exe')
  const altPath = path.join(__dirname, 'src-tauri/target/release/pm_app.exe')

  if (!fs.existsSync(exePath) && !fs.existsSync(altPath)) {
    throw new Error(
      `Tauri executable not found.\n` +
      `Please run "pnpm tauri build" before running tests.\n` +
      `Expected: ${exePath}`
    )
  }
}

try {
  checkTauriBuild()
} catch (e) {
  console.warn('[playwright.config] Warning:', (e as Error).message)
}

// ============================================================================
// Configuration
// ============================================================================

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',

  // Fully parallel within a file; files run sequentially to avoid state pollution
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  timeout: 60_000,
  expect: { timeout: 10_000 },
  actionTimeout: 10_000,
  navigationTimeout: 30_000,

  // global-setup.ts launches the Tauri app and writes the WebDriver URL
  globalSetup: path.join(__dirname, 'tests/e2e/global-setup.ts'),

  // global-teardown.ts kills the app after tests
  globalTeardown: path.join(__dirname, 'tests/e2e/global-teardown.ts'),

  viewport: { width: 1280, height: 720 },

  // Base URL for the Tauri app — the webview serves at tauri.localhost
  // When Playwright calls page.goto('/projects'), it resolves to
  // http://tauri.localhost/projects, which the WebDriver navigates to.
  baseURL: 'http://localhost:1420',

  // Browser projects — connect to the running Tauri app via W3C WebDriver
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',

        // Connect to Tauri app via W3C WebDriver HTTP server
        // The tauri-plugin-webdriver serves HTTP at port 9222
        // Playwright 1.47+ supports external WebDriver connections via this option
        webDriver: {
          url: getStoredWebDriverUrl() ?? 'http://127.0.0.1:9222',
        },

        trace: 'on-first-retry',
        screenshot: 'only-on-failure',

        // Headless by default; use --headed flag to see the window
        headless: true,
      },
    },
  ],

  outputDir: 'test-results',
})
