import { defineConfig, devices } from '@playwright/test'
import path from 'node:path'

/**
 * Playwright Configuration for Tauri E2E Tests
 *
 * This configuration is designed for testing Tauri 2.0 desktop applications
 * using Playwright's webview support.
 *
 * Key features:
 * - Tests run against the Tauri webview (not a separate server)
 * - Supports both headed and headless modes
 * - Proper timeout handling for Tauri operations
 * - Mock support for Rust backend commands
 */

export default defineConfig({
  // Test directory - Playwright will discover all *.spec.ts files
  testDir: './tests/e2e',

  // Test file patterns (relative to testDir)
  testMatch: '**/*.spec.ts',

  // Fully parallel within a single file, but files run sequentially
  // This prevents state pollution between different test files
  fullyParallel: false,
  // Use workers only for independent test files
  workers: process.env.CI ? 1 : undefined,

  // Fail build on skipped tests (CI mode)
  forbidOnly: !!process.env.CI,

  // Retry failed tests
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Global timeout for all tests
  timeout: 60 * 1000, // 60 seconds

  // Expect timeout (for assertions)
  expect: {
    timeout: 10 * 1000, // 10 seconds
  },

  // Playwright hooks - runs before each test
  globalSetup: undefined,

  // Playwright hooks - runs after each test
  globalTeardown: undefined,

  // Use baseURL from environment or default
  baseURL: process.env.BASE_URL || 'http://localhost:1420',

  // Default viewport
  viewport: { width: 1280, height: 720 },

  // Action timeout - timeout for individual Playwright actions
  actionTimeout: 10 * 1000, // 10 seconds

  // Navigation timeout - timeout for page navigation
  navigationTimeout: 30 * 1000, // 30 seconds

  // Browser testing configuration
  projects: [
    {
      name: 'chromium',
      use: {
        // Use Playwright's bundled Chromium (no Chrome installation required)
        browserName: 'chromium',
        // Capture trace on first retry
        trace: 'on-first-retry',
        // Screenshot on failure
        screenshot: 'only-on-failure',
        headless: true,
      },
    },
  ],

  // WebServer configuration for development
  // For Tauri apps, use 'pnpm tauri dev' (requires compiled Rust backend)
  // For frontend-only testing, use 'pnpm dev'
  webServer: {
    // Command to start dev server (use 'pnpm dev' for frontend-only)
    command: 'pnpm dev',
    // Port to wait for
    port: 1420,
    // Timeout for server to start
    timeout: 120 * 1000, // 2 minutes
    // Reuse existing server if available (skip restart)
    reuseExistingServer: !process.env.CI,
    // Redirect output to avoid noise in test output
    stdout: 'pipe',
    stderr: 'pipe',
    // Environment variables
    env: {
      NODE_ENV: 'test',
    },
  },

  // Output directory for test artifacts
  outputDir: 'test-results',

  // Annotations - tags for tests
  _tag: ['tauri', 'e2e', 'desktop'],
})

/**
 * Environment Variables
 *
 * CI: Set to true when running in CI/CD environment
 * BASE_URL: Override base URL for testing (default: http://localhost:1420)
 * TAURI_DEBUG: Enable debug mode for Tauri
 * PLAYWRIGHT_TIMEOUT: Override default timeout
 *
 * Example:
 *   CI=true pnpm test:e2e
 *   BASE_URL=http://localhost:3000 pnpm test:e2e
 */
