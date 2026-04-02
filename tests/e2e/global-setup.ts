/**
 * Tauri + Vite Dev Server E2E Test Setup
 *
 * Uses the official Tauri 2.0 WebDriver approach combined with the Vite dev server.
 *
 * Architecture:
 * 1. Starts `pnpm dev` (Vite dev server) on port 1420
 * 2. Launches the built Tauri app with devtools enabled, connecting to the dev server
 * 3. The app window loads the frontend from http://localhost:1420
 * 4. Playwright connects to the Tauri WebDriver server at port 9222
 * 5. Tests navigate using URLs like http://tauri.localhost/<route>
 *    (Tauri internally routes these to the dev server)
 */

import * as path from 'node:path'
import * as fs from 'node:fs'
import * as net from 'node:net'
import { spawn, ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SETUP_LOCK_FILE = path.join(__dirname, '../.setup-lock')
const DEV_SERVER_URL = 'http://localhost:1420'

// ============================================================================
// Helpers
// ============================================================================

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    server.listen(port, '127.0.0.1')
  })
}

function killProcess(pid: number): Promise<void> {
  return new Promise((resolve) => {
    try {
      process.kill(pid, 'SIGTERM')
    } catch {
      // ignore
    }
    setTimeout(resolve, 500)
  })
}

// ============================================================================
// Main
// ============================================================================

async function globalSetup(): Promise<string> {
  console.log('='.repeat(70))
  console.log('[global-setup] Tauri + Vite Dev Server E2E Test Setup')
  console.log('='.repeat(70))

  // Check if dev server is already running
  const portAvailable = await isPortAvailable(1420)
  if (!portAvailable) {
    console.log('[global-setup] Dev server already running on port 1420')
  } else {
    // Start the Vite dev server
    console.log('[global-setup] Starting Vite dev server...')
    const devServer = spawn('pnpm', ['dev', '--port', '1420', '--host'], {
      cwd: path.join(__dirname, '../../'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      detached: false,
    })

    devServer.stdout?.on('data', (d: Buffer) => {
      const line = d.toString('utf8').trim()
      if (line) console.log(`[vite-stdout] ${line}`)
    })
    devServer.stderr?.on('data', (d: Buffer) => {
      const line = d.toString('utf8').trim()
      if (line) console.warn(`[vite-stderr] ${line}`)
    })

    // Wait for dev server to be ready
    const start = Date.now()
    while (Date.now() - start < 60_000) {
      try {
        const res = await fetch(DEV_SERVER_URL, { signal: AbortSignal.timeout(1000) })
        if (res.ok) {
          console.log(`[global-setup] Vite dev server ready at ${DEV_SERVER_URL}`)
          break
        }
      } catch {
        // not ready yet
      }
      await sleep(500)
    }
  }

  // Launch the Tauri app with devtools, pointing to the dev server
  const exePath = path.join(__dirname, '../../src-tauri/target/release/pm-app.exe')
  if (!fs.existsSync(exePath)) {
    throw new Error(
      `Tauri executable not found at: ${exePath}\n` +
      `Please run "pnpm tauri build" first.`
    )
  }

  console.log('[global-setup] Launching Tauri application...')
  const proc = spawn(exePath, ['--disable-gpu'], {
    env: {
      ...process.env,
      TAURI_WEBDRIVER_PORT: '9222',
      TAURI_DEV_TOOLS: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: false,
  })

  proc.stdout?.on('data', (d: Buffer) => {
    const line = d.toString('utf8').trim()
    if (line && (line.includes('DevTools') || line.includes('error'))) {
      console.log(`[tauri-stdout] ${line}`)
    }
  })
  proc.stderr?.on('data', (d: Buffer) => {
    const line = d.toString('utf8').trim()
    if (line) console.warn(`[tauri-stderr] ${line}`)
  })

  // Wait for app window to be available (poll WebDriver status)
  const webDriverReady = await waitForWebDriver(9222, 30_000)
  if (!webDriverReady) {
    proc.kill()
    throw new Error('Tauri app WebDriver server did not become ready within 30s')
  }

  console.log('[global-setup] App launched successfully')
  console.log(`[global-setup] Dev server: ${DEV_SERVER_URL}`)
  console.log(`[global-setup] WebDriver: http://127.0.0.1:9222`)
  console.log(`[global-setup] PID: ${proc.pid}`)

  // Write PID to lock file so teardown can kill the app
  fs.writeFileSync(SETUP_LOCK_FILE, String(proc.pid), 'utf8')

  await sleep(1000)

  return DEV_SERVER_URL
}

async function waitForWebDriver(port: number, timeout: number): Promise<boolean> {
  const url = `http://127.0.0.1:${port}/status`
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const body = await res.json() as { value?: { ready?: boolean } }
        if (body?.value?.ready) return true
      }
    } catch { /* not ready */ }
    await sleep(200)
  }
  return false
}

export default globalSetup
