/**
 * Global Teardown for Tauri WebDriver E2E Tests
 *
 * This file runs ONCE after all tests complete. It:
 * 1. Kills the Tauri application process
 * 2. Cleans up the CDP URL file
 * 3. Cleans up any test workspaces
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const WEBDRIVER_URL_FILE = path.join(__dirname, '../.webdriver-url')
const SETUP_LOCK_FILE = path.join(__dirname, '../.setup-lock')
const TEST_WORKSPACE_DIR = path.join(__dirname, '../.test-workspace')

/**
 * Kill the Tauri app process by PID stored in the lock file.
 */
async function killAppByLock(): Promise<void> {
  try {
    if (fs.existsSync(SETUP_LOCK_FILE)) {
      const pid = parseInt(fs.readFileSync(SETUP_LOCK_FILE, 'utf8').trim(), 10)
      if (pid && !isNaN(pid)) {
        console.log(`[global-teardown] Killing Tauri app process (PID: ${pid})`)
        try {
          // On Windows, use taskkill to kill process tree
          await new Promise<void>((resolve, reject) => {
            const kill = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
              windowsHide: true,
            })
            kill.on('close', (code) => {
              if (code === 0 || code === 128) {
                // 128 = process not found
                resolve()
              } else {
                // Try alternative
                try {
                  process.kill(pid, 'SIGTERM')
                } catch {
                  // Already dead
                }
                resolve()
              }
            })
            kill.on('error', () => {
              resolve() // Ignore errors
            })
            setTimeout(resolve, 2000) // Fallback
          })
        } catch {
          // Ignore
        }
      }
    }
  } catch {
    // Ignore
  }
}

/**
 * Clean up all temporary files created during tests.
 */
function cleanupTempFiles(): void {
  const filesToClean = [WEBDRIVER_URL_FILE, SETUP_LOCK_FILE]

  for (const file of filesToClean) {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
        console.log(`[global-teardown] Removed: ${file}`)
      }
    } catch {
      // Ignore cleanup errors
    }
  }

  // Clean up test workspace if it exists
  try {
    if (fs.existsSync(TEST_WORKSPACE_DIR)) {
      fs.rmSync(TEST_WORKSPACE_DIR, { recursive: true, force: true })
      console.log(`[global-teardown] Removed test workspace: ${TEST_WORKSPACE_DIR}`)
    }
  } catch {
    // Ignore
  }
}

async function globalTeardown(): Promise<void> {
  console.log('='.repeat(70))
  console.log('[global-teardown] Cleaning up Tauri WebDriver E2E Test Setup')
  console.log('='.repeat(70))

  await killAppByLock()
  cleanupTempFiles()

  console.log('[global-teardown] Cleanup complete')
}

export default globalTeardown
