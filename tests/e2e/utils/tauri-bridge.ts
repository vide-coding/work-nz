/**
 * Tauri WebDriver Bridge
 *
 * Bridges Playwright's CDP-over-WebSocket protocol to Tauri WebDriver HTTP.
 *
 * Playwright connects via WebSocket to this server. This server translates
 * CDP WebSocket frames to W3C WebDriver HTTP calls and returns responses.
 *
 * The bridge also launches the Tauri app via the child_process API (not shell),
 * ensuring the TAURI_WEBDRIVER_PORT env var is properly set.
 */

import { createServer } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { spawn, ChildProcess } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { AddressInfo } from 'node:net'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ============================================================================
// Configuration
// ============================================================================

const TAURI_EXE = join(__dirname, '../../../src-tauri/target/release/pm-app.exe')
const WEBDRIVER_PORT = 9222
const BRIDGE_PORT = 9322 // Local port where this bridge listens
const WEBDRIVER_URL = `http://127.0.0.1:${WEBDRIVER_PORT}`
const CDP_URL_FILE = join(__dirname, '../.cdp-url')
const SETUP_LOCK_FILE = join(__dirname, '../.setup-lock')

// ============================================================================
// CDP Message Types
// ============================================================================

interface CdpMessage {
  id: number
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number; message: string }
}

interface W3CResponse {
  value?: unknown
  sessionId?: string | null
  success?: boolean
}

// ============================================================================
// WebDriver HTTP Client
// ============================================================================

async function webdriverRequest(
  method: string,
  path: string,
  body?: unknown,
  sessionId?: string
): Promise<{ status: number; body: unknown }> {
  const url = sessionId
    ? `${WEBDRIVER_URL}/session/${sessionId}${path}`
    : `${WEBDRIVER_URL}${path}`

  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(url, opts)
  const text = await res.text()
  let body_: unknown
  try { body_ = JSON.parse(text) } catch { body_ = text }
  return { status: res.status, body: body_ }
}

// ============================================================================
// CDP Command to WebDriver Command Mapping
// ============================================================================

function cdpToWebDriver(cmd: CdpMessage, sessionId: string): {
  method: string; path: string; body?: unknown
} | null {
  const { method, params } = cmd
  if (!method) return null

  // Page.navigate -> URL
  if (method === 'Page.navigate') {
    return { method: 'POST', path: '/url', body: { url: (params as { url: string }).url } }
  }
  // Runtime.evaluate -> ExecuteScript
  if (method === 'Runtime.evaluate') {
    const expr = (params as { expression: string }).expression
    return { method: 'POST', path: '/execute/sync', body: { script: expr, args: [] } }
  }
  // DOM.getDocument -> ?
  if (method === 'DOM.getDocument') {
    return { method: 'GET', path: '/source' }
  }
  // DOM.querySelector -> ?
  if (method === 'DOM.querySelector') {
    return { method: 'POST', path: '/element', body: { using: 'css selector', value: (params as { selector: string }).selector } }
  }
  // Input.dispatchEvent -> ?
  if (method === 'Input.dispatchMouseEvent') {
    const p = params as { type: string; x: number; y: number; button?: string; clickCount?: number }
    if (p.type === 'mousePressed') {
      return { method: 'POST', path: '/moveto', body: { x: Math.round(p.x), y: Math.round(p.y) } }
    }
    if (p.type === 'mouseReleased') {
      return { method: 'POST', path: '/click', body: { button: p.button === 'secondary' ? 2 : 0 } }
    }
  }
  // Page.captureScreenshot -> screenshot
  if (method === 'Page.captureScreenshot') {
    return { method: 'GET', path: '/screenshot' }
  }
  // Page.getFrameTree -> ?
  if (method === 'Page.getFrameTree') {
    return { method: 'GET', path: '/window' }
  }
  // Target.getTargets -> ?
  if (method === 'Target.getTargets') {
    return { method: 'GET', path: '/window' }
  }
  // Network.setRequestInterception -> ?
  if (method === 'Network.setRequestInterception') {
    return null // No-op for testing
  }
  // Log.enable -> ?
  if (method === 'Log.enable') {
    return null // No-op
  }
  // Page.setLifecycleEventsEnabled -> ?
  if (method === 'Page.setLifecycleEventsEnabled') {
    return null
  }
  // Page.setAutoAttachToCreatedPages -> ?
  if (method === 'Page.setAutoAttachToCreatedPages') {
    return null
  }
  // Page.bringToFront -> ?
  if (method === 'Page.bringToFront') {
    return null
  }
  // Runtime.executionContextCreated -> ignored (event)
  if (method.startsWith('Runtime.executionContext')) return null
  if (method.startsWith('Log.entryAdded')) return null
  if (method.startsWith('Page.lifecycleEvent')) return null

  // Unknown command — return a null result so the bridge still responds
  console.warn(`[tauri-bridge] Unknown CDP command: ${method}`)
  return null
}

function webDriverToCdp(
  result: unknown,
  cmd: CdpMessage
): CdpMessage {
  if (cmd.method === 'Runtime.evaluate') {
    const r = result as { value?: unknown; result?: { type: string; value?: unknown } }
    const val = r.value ?? r.result?.value ?? undefined
    return { id: cmd.id, result: { result: { type: typeof val, value: val } } }
  }
  if (cmd.method === 'DOM.getDocument') {
    return { id: cmd.id, result: { root: { nodeId: 1, backendNodeId: 1 } } }
  }
  if (cmd.method === 'DOM.querySelector') {
    const r = result as { value?: { ELEMENT?: string } }
    const id = r.value?.ELEMENT ?? ''
    return { id: cmd.id, result: { object: { type: 'node', value: { ELEMENT: id } } } }
  }
  if (cmd.method === 'Page.navigate') {
    return { id: cmd.id, result: { navigation: '0' } }
  }
  if (cmd.method === 'Page.captureScreenshot') {
    const r = result as { value?: string }
    return { id: cmd.id, result: { data: r.value ?? '', timestamp: Date.now() } }
  }
  if (cmd.method === 'Page.getFrameTree') {
    return { id: cmd.id, result: { frameTree: { frames: [{ frameId: 'main', url: 'http://tauri.localhost/', name: '' }] } } }
  }
  if (cmd.method === 'Target.getTargets') {
    return { id: cmd.id, result: { targetInfos: [{ targetId: 'main', type: 'page', url: 'http://tauri.localhost/' }] } }
  }
  return { id: cmd.id, result: {} }
}

// ============================================================================
// WebSocket <-> WebDriver Bridge
// ============================================================================

export interface BridgeResult {
  wsUrl: string
  process: ChildProcess
  port: number
}

export async function startBridge(): Promise<BridgeResult> {
  // Launch Tauri app with WebDriver
  if (!existsSync(TAURI_EXE)) {
    throw new Error(
      `Tauri executable not found at: ${TAURI_EXE}\n` +
      `Please run "pnpm tauri build" first.`
    )
  }

  const appEnv = { ...process.env, TAURI_WEBDRIVER_PORT: String(WEBDRIVER_PORT), TAURI_DEV_TOOLS: 'true' }
  const proc = spawn(TAURI_EXE, ['--disable-gpu', '--no-sandbox'], {
    env: appEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: false,
  })

  proc.stdout?.on('data', (d: Buffer) => console.log(`[tauri-stdout] ${d.toString().trim()}`))
  proc.stderr?.on('data', (d: Buffer) => console.warn(`[tauri-stderr] ${d.toString().trim()}`))

  // Wait for WebDriver server to be ready
  await waitForWebDriverReady(WEBDRIVER_PORT, 30_000)

  // Create a WebSocket server for Playwright to connect to
  const httpServer = createServer()
  const wss = new WebSocketServer({ server: httpServer })

  // Map from WebSocket to their session ID
  const wsSessionMap = new WeakMap<WebSocket, string>()

  wss.on('connection', async (ws: WebSocket) => {
    let sessionId: string | null = null

    ws.on('message', async (data: Buffer) => {
      let msg: CdpMessage | CdpMessage[]
      try {
        msg = JSON.parse(data.toString('utf8'))
      } catch {
        ws.send(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }

      const commands: CdpMessage[] = Array.isArray(msg) ? msg : [msg]
      const responses: CdpMessage[] = []

      for (const cmd of commands) {
        // Target.create -> create WebDriver session
        if (cmd.method === 'Target.createTarget' || cmd.method === 'IO.resolvePath') {
          if (!sessionId) {
            const { body } = await webdriverRequest('POST', '/session', {
              capabilities: { alwaysMatch: { 'ms:edgeOptions': {} } }
            })
            const b = body as { value?: { sessionId?: string } }
            sessionId = b.value?.sessionId ?? null
            if (sessionId) wsSessionMap.set(ws, sessionId)
          }
          responses.push({ id: cmd.id, result: { targetId: 'main', sessionId } })
          continue
        }

        // Target.closeTarget -> close WebDriver session
        if (cmd.method === 'Target.closeTarget') {
          if (sessionId) {
            await webdriverRequest('DELETE', '', undefined, sessionId)
            sessionId = null
          }
          responses.push({ id: cmd.id, result: {} })
          continue
        }

        if (!sessionId) {
          responses.push({ id: cmd.id, error: { code: -32602, message: 'No session' } })
          ws.send(JSON.stringify(responses))
          continue
        }

        try {
          const wdCmd = cdpToWebDriver(cmd, sessionId)
          if (!wdCmd) {
            responses.push({ id: cmd.id, result: {} })
            ws.send(JSON.stringify(responses))
            return
          }
          const { body } = await webdriverRequest(wdCmd.method, wdCmd.path, wdCmd.body, sessionId)
          const cdpResponse = webDriverToCdp(body, cmd)
          responses.push(cdpResponse)
        } catch (err) {
          console.error(`[tauri-bridge] WD error: ${(err as Error).message}`)
          responses.push({ id: cmd.id, error: { code: -32603, message: (err as Error).message } })
        }
      }

      if (responses.length > 0) {
        ws.send(JSON.stringify(responses.length === 1 ? responses[0] : responses))
      }
    })

    ws.on('error', (err) => {
      console.error(`[tauri-bridge] WS error: ${err.message}`)
    })
  })

  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => resolve())
  })

  const addr = httpServer.address() as AddressInfo
  const wsUrl = `ws://127.0.0.1:${addr.port}`

  console.log(`[tauri-bridge] WebSocket bridge listening at ${wsUrl}`)
  console.log(`[tauri-bridge] Tauri WebDriver at ${WEBDRIVER_URL}`)

  writeFileSync(CDP_URL_FILE, wsUrl, 'utf8')
  writeFileSync(SETUP_LOCK_FILE, String(proc.pid), 'utf8')

  return { wsUrl, process: proc, port: addr.port }
}

async function waitForWebDriverReady(port: number, timeout: number): Promise<void> {
  const url = `http://127.0.0.1:${port}/status`
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) {
        const body = await res.json() as { value?: { ready?: boolean } }
        if (body?.value?.ready) return
      }
    } catch { /* not ready */ }
    await sleep(200)
  }
  throw new Error(`WebDriver server at port ${port} did not become ready within ${timeout}ms`)
}

export async function stopBridge(proc: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    proc.on('close', () => resolve())
    if (proc.pid && !proc.killed) {
      try { process.kill(proc.pid, 'SIGTERM') } catch { /* already dead */ }
    }
    setTimeout(resolve, 1000)
  })
}

// ============================================================================
// Main entry point
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  startBridge()
    .then(({ wsUrl }) => {
      console.log(`[bridge] Ready: ${wsUrl}`)
    })
    .catch((err) => {
      console.error('[bridge] Failed:', err)
      process.exit(1)
    })
}
