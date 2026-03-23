import { describe, expect, it } from 'vitest'
import { mockTauriIpc } from '@/test/tauri'
import type { ProjectCreateInput } from '@/types'
import { fsApi, moduleApi, projectApi, workspaceApi } from './useApi'

describe('useApi', () => {
  it('workspaceApi.listRecent 通过 IPC 获取最近工作区', async () => {
    const expected = [{ path: 'D:/ws', alias: 'demo' }]

    mockTauriIpc({
      workspace_list_recent: () => expected,
    })

    await expect(workspaceApi.listRecent()).resolves.toEqual(expected)
  })

  it('projectApi.create 通过 IPC 传递 input 参数', async () => {
    const input: ProjectCreateInput = { name: 'p1', description: 'd1' }
    const expected = { id: 'p1', name: 'p1', description: 'd1' }
    let seenArgs: Record<string, unknown> | undefined

    mockTauriIpc({
      project_create: (args) => {
        seenArgs = args
        return expected
      },
    })

    await expect(projectApi.create(input)).resolves.toEqual(expected)
    expect(seenArgs).toEqual({ input })
  })

  it('fsApi.rename 通过 IPC 传递路径参数', async () => {
    let seenArgs: Record<string, unknown> | undefined

    mockTauriIpc({
      fs_rename: (args) => {
        seenArgs = args
        return { ok: true }
      },
    })

    await expect(fsApi.rename('D:/a.txt', 'D:/b.txt')).resolves.toEqual({ ok: true })
    expect(seenArgs).toEqual({ oldPath: 'D:/a.txt', newPath: 'D:/b.txt' })
  })

  it('moduleApi.validateConfig 通过 IPC 返回校验结果', async () => {
    const expected = { valid: false, errors: ['bad'] }
    let seenArgs: Record<string, unknown> | undefined

    mockTauriIpc({
      module_validate_config: (args) => {
        seenArgs = args
        return expected
      },
    })

    await expect(moduleApi.validateConfig('m1', { a: 1 })).resolves.toEqual(expected)
    expect(seenArgs).toEqual({ id: 'm1', config: { a: 1 } })
  })
})
