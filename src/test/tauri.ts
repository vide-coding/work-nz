import { mockIPC } from '@tauri-apps/api/mocks'

export type IpcRouteHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>

/**
 * 以“命令名 -> 处理函数”的方式 mock Tauri IPC（invoke）。
 * 未匹配到命令时会抛错，避免静默返回 undefined 导致测试误判通过。
 */
export function mockTauriIpc(routes: Record<string, IpcRouteHandler>): void {
  mockIPC(async (cmd, args) => {
    const handler = routes[cmd]
    if (!handler)
      throw new Error(`未为 IPC 命令提供 mock: ${cmd}`)

    return handler((args ?? {}) as Record<string, unknown>)
  })
}

