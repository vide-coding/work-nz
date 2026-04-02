/**
 * Tauri App Launcher
 *
 * Launches the built Tauri application with WebDriver support and
 * extracts the CDP (Chrome DevTools Protocol) WebSocket URL from stdout.
 *
 * This is the core of the official Tauri 2.0 WebDriver testing approach:
 * https://v2.tauri.app/develop/tests/webdriver/
 */

import { spawn, ChildProcess } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { setTimeout, clearTimeout } from 'node:timers'

// ESM __dirname workaround
const __dirname = dirname(fileURLToPath(import.meta.url))

// ============================================================================
// Configuration
// ============================================================================

/** Path to the Tauri source directory */
const TAURI_DIR = resolve(__dirname, '../../src-tauri')

/** Path to the built Tauri executable */
const EXECUTABLE_PATH = join(__dirname, '../../../src-tauri/target/release/pm-app.exe')

/** File where the WebDriver URL is stored for Playwright to read */
const WEBDRIVER_URL_FILE = join(__dirname, '../.webdriver-url')

/** Default WebDriver port */
const DEFAULT_WEBDRIVER_PORT = 9222

// ============================================================================
// Types
// ============================================================================

export interface LaunchResult {
  /** The WebDriver HTTP URL to connect to */
  webDriverUrl: string
  /** The spawned process */
  process: ChildProcess
  /** The webdriver port */
  port: number
}

export interface LaunchOptions {
  /** Port for WebDriver/ CDP server (default: 9222) */
  port?: number
  /** Working directory for the app (default: temp dir) */
  cwd?: string
  /** Environment variables */
  env?: Record<string, string>
  /** Timeout in ms to wait for CDP URL (default: 30000) */
  timeout?: number
  /** Called with each stdout line for debugging */
  onStdout?: (line: string) => void
  /** Called with each stderr line for debugging */
  onStderr?: (line: string) => void
}

// ============================================================================
// Helper: Extract CDP URL from stdout
// ============================================================================

/**
 * Parse the DevTools WebSocket URL from Tauri app stdout.
 * Tauri logs: "DevTools listening on ws://127.0.0.1:<port>/devtools/browser/<uuid>"
 * (This is no longer used — we use WebDriver HTTP status endpoint now.)
 */
function extractCdpUrl(stdout: string, port: number): string | null {
  return null
}

/**
 * Poll the WebDriver status endpoint until the server is ready.
 * The tauri-plugin-webdriver serves at port 9222 (or custom).
 */
async function waitForWebDriverReady(port: number, timeout: number): Promise<void> {
  const url = `http://127.0.0.1:${port}/status`
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const body = await res.json() as { value?: { ready?: boolean; message?: string } }
        if (body?.value?.ready) {
          return // Server is ready
        }
      }
    } catch {
      // Not ready yet, keep polling
    }
    await sleep(200)
  }

  throw new Error(`WebDriver server at port ${port} did not become ready within ${timeout}ms`)
}

/**
 * Alternative: construct CDP URL from port if app doesn't log it
 * This is a fallback for when the app doesn't output the URL
 */
function constructCdpUrl(port: number, browserId: string): string {
  return `ws://127.0.0.1:${port}/devtools/browser/${browserId}`
}

// ============================================================================
// Main: Launch Tauri App
// ============================================================================

/**
 * Launch the built Tauri application with WebDriver/CDP support.
 *
 * @param options Launch options
 * @returns LaunchResult with CDP URL and process handle
 */
export async function launchTauriApp(options: LaunchOptions = {}): Promise<LaunchResult> {
  const {
    port = DEFAULT_WEBDRIVER_PORT,
    cwd,
    env = {},
    timeout = 30_000,
    onStdout,
    onStderr,
  } = options

  // Check if executable exists
  if (!existsSync(EXECUTABLE_PATH)) {
    throw new Error(
      `Tauri executable not found at: ${EXECUTABLE_PATH}\n` +
      `Please run "pnpm tauri build" first to compile the application.`
    )
  }

  // Clean up any existing WebDriver URL file
  try {
    unlinkSync(WEBDRIVER_URL_FILE)
  } catch {
    // Ignore if file doesn't exist
  }

  const appEnv = {
    ...process.env,
    ...env,
    // Enable Tauri webdriver plugin server on the specified port
    TAURI_WEBDRIVER_PORT: String(port),
    // Force dark mode off for consistent screenshots in tests
    TAURI_DEV_TOOLS: 'true',
  }

  // Launch the app — port is set via TAURI_WEBDRIVER_PORT env var (not CLI flag)
  const args = [
    '--disable-gpu',
    '--no-sandbox',
  ]

  console.log(`[tauri-launcher] Launching: ${EXECUTABLE_PATH}`)
  console.log(`[tauri-launcher] Args: ${args.join(' ')}`)
  console.log(`[tauri-launcher] Waiting for CDP URL...`)

  const proc = spawn(EXECUTABLE_PATH, args, {
    cwd: cwd || process.cwd(),
    env: appEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: false,
  })

  let stdout = ''
  let stderr = ''
  let resolved = false

  // Set up stdout handler
  proc.stdout?.on('data', (data: Buffer) => {
    const line = data.toString('utf8')
    stdout += line
    onStdout?.(line)
  })

  // Set up stderr handler
  proc.stderr?.on('data', (data: Buffer) => {
    const line = data.toString('utf8')
    stderr += line
    onStderr?.(line)
  })

  // Handle process errors
  proc.on('error', (err) => {
    console.error(`[tauri-launcher] Process error: ${err.message}`)
  })

  proc.on('close', (code) => {
    console.log(`[tauri-launcher] Process exited with code: ${code}`)
    if (code !== 0 && code !== null) {
      console.error(`[tauri-launcher] Stderr: ${stderr}`)
    }
  })

  // Wait for WebDriver HTTP server to be ready
  console.log(`[tauri-launcher] Waiting for WebDriver server on port ${port}...`)

  try {
    await waitForWebDriverReady(port, timeout)
    resolved = true
    console.log(`[tauri-launcher] WebDriver server ready`)
  } catch (err) {
    proc.kill()
    throw new Error(
      `Timeout waiting for WebDriver server on port ${port} after ${timeout}ms.\n` +
      `Stdout: ${stdout}\n` +
      `Stderr: ${stderr}\n` +
      `Error: ${(err as Error).message}`
    )
  }

  const webDriverUrl = `http://127.0.0.1:${port}`
  console.log(`[tauri-launcher] WebDriver URL: ${webDriverUrl}`)

  // Write to file for Playwright to read
  writeFileSync(WEBDRIVER_URL_FILE, webDriverUrl, 'utf8')
  console.log(`[tauri-launcher] WebDriver URL written to: ${WEBDRIVER_URL_FILE}`)

  return {
    webDriverUrl,
    process: proc,
    port,
  }
}

/**
 * Read the WebDriver URL from the file written by launchTauriApp.
 * Used by Playwright config to get the connection URL.
 */
export function getStoredWebDriverUrl(): string | null {
  try {
    if (existsSync(WEBDRIVER_URL_FILE)) {
      return readFileSync(WEBDRIVER_URL_FILE, 'utf8').trim()
    }
  } catch {
    // Ignore errors
  }
  return null
}

/**
 * Kill the running Tauri app process.
 */
export async function killTauriApp(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (proc.pid && !proc.killed) {
      // On Windows, we need to kill the process tree
      try {
        process.kill(proc.pid, 'SIGTERM')
      } catch {
        try {
          process.kill(proc.pid, 0) // Check if alive
        } catch {
          // Already dead
        }
      }
    }
    proc.on('close', () => resolve())
    // Fallback: resolve after 1s even if close event fires before resolve
    const fallback = setTimeout(resolve, 1000)
    proc.on('close', () => clearTimeout(fallback))
  })
}

/**
 * Clean up the WebDriver URL file.
 */
export function cleanupWebDriverUrlFile(): void {
  try {
    unlinkSync(WEBDRIVER_URL_FILE)
  } catch {
    // Ignore
  }
}
