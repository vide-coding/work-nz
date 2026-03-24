import { describe, expect, it } from 'vitest'
import { mockTauriIpc } from '@/test/tauri'
import { useSettings } from './useSettings'

describe('useSettings', () => {
  it('loadGlobalSettings 成功时合并默认值并更新状态', async () => {
    const settings = useSettings()

    mockTauriIpc({
      global_settings_get: () => ({ language: 'en-US', themeMode: 'dark' }),
    })

    await settings.loadGlobalSettings()
    expect(settings.globalSettingsLoaded.value).toBe(true)
    expect(settings.globalSettings.value.language).toBe('en-US')
    expect(settings.globalSettings.value.themeMode).toBe('dark')
  })

  it('loadGlobalSettings 失败时回退到默认值', async () => {
    const settings = useSettings()

    mockTauriIpc({
      global_settings_get: () => {
        throw new Error('missing')
      },
    })

    const loaded = await settings.loadGlobalSettings()
    expect(settings.globalSettingsLoaded.value).toBe(true)
    expect(loaded.language).toBe('zh-CN')
  })

  it('updateGlobalSettings 会通过 IPC 持久化 patch', async () => {
    const settings = useSettings()
    let seenArgs: Record<string, unknown> | undefined

    mockTauriIpc({
      global_settings_get: () => ({ language: 'zh-CN' }),
      global_settings_update: (args) => {
        seenArgs = args
        return null
      },
    })

    await settings.loadGlobalSettings()
    await settings.updateGlobalSettings({ language: 'en-US' })

    expect(seenArgs).toEqual({ patch: { language: 'en-US' } })
    expect(settings.globalSettings.value.language).toBe('en-US')
  })
})
