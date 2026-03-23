import { afterEach, beforeAll, vi } from 'vitest'
import { randomFillSync } from 'node:crypto'
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks'

/**
 * 为测试环境补齐 WebCrypto 的 getRandomValues（Vitest 的 DOM 环境可能缺失该实现）。
 */
function installWebCryptoPolyfill(): void {
  if (typeof window === 'undefined')
    return

  const hasGetRandomValues = typeof window.crypto?.getRandomValues === 'function'
  if (hasGetRandomValues)
    return

  Object.defineProperty(window, 'crypto', {
    value: {
      // @ts-expect-error test polyfill
      getRandomValues: (buffer: Uint8Array) => randomFillSync(buffer),
    },
  })
}

/**
 * 安装默认的 IPC mock：当测试代码未显式 mock 某个命令时，直接抛错提示。
 */
function installDefaultIpcMock(): void {
  mockIPC((cmd) => {
    throw new Error(`未为 IPC 命令提供 mock: ${cmd}`)
  })
}

beforeAll(() => {
  installWebCryptoPolyfill()
  installDefaultIpcMock()
})

afterEach(() => {
  clearMocks()
  vi.restoreAllMocks()
  installDefaultIpcMock()
})
