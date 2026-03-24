import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockTauriIpc } from '@/test/tauri'
import type { ProjectCreateInput } from '@/types'
import { fsApi, moduleApi, projectApi, workspaceApi } from './useApi'

// Mock the invoke function from Tauri
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'

describe('useApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('workspaceApi', () => {
    it('listRecent should call workspace_list_recent', async () => {
      const expected = [{ path: 'D:/ws', alias: 'demo' }]
      vi.mocked(invoke).mockResolvedValue(expected)

      const result = await workspaceApi.listRecent()

      expect(invoke).toHaveBeenCalledWith('workspace_list_recent')
      expect(result).toEqual(expected)
    })
  })

  describe('projectApi', () => {
    it('create should pass input parameter', async () => {
      const input: ProjectCreateInput = { name: 'p1', description: 'd1' }
      const expected = { id: 'p1', name: 'p1', description: 'd1' }
      vi.mocked(invoke).mockResolvedValue(expected)

      const result = await projectApi.create(input)

      expect(invoke).toHaveBeenCalledWith('project_create', { input })
      expect(result).toEqual(expected)
    })
  })

  describe('moduleApi', () => {
    it('validateConfig should pass id and config', async () => {
      const expected = { valid: false, errors: ['bad'] }
      vi.mocked(invoke).mockResolvedValue(expected)

      const result = await moduleApi.validateConfig('m1', { a: 1 })

      expect(invoke).toHaveBeenCalledWith('module_validate_config', { id: 'm1', config: { a: 1 } })
      expect(result).toEqual(expected)
    })
  })

  describe('fsApi', () => {
    describe('tree', () => {
      it('should call project_fs_tree command', async () => {
        const mockTree = {
          name: 'root',
          path: '',
          kind: 'dir',
          children: [
            { name: 'file.txt', path: 'file.txt', kind: 'file' },
            { name: 'folder', path: 'folder', kind: 'dir', children: [] },
          ],
        }
        vi.mocked(invoke).mockResolvedValue(mockTree)

        const result = await fsApi.tree('project-1', '')

        expect(invoke).toHaveBeenCalledWith('project_fs_tree', {
          projectId: 'project-1',
          relativeRoot: '',
        })
        expect(result).toEqual(mockTree)
      })

      it('should pass relative root path', async () => {
        vi.mocked(invoke).mockResolvedValue({
          name: 'folder',
          path: 'folder',
          kind: 'dir',
          children: [],
        })

        await fsApi.tree('project-1', 'folder')

        expect(invoke).toHaveBeenCalledWith('project_fs_tree', {
          projectId: 'project-1',
          relativeRoot: 'folder',
        })
      })
    })

    describe('readText', () => {
      it('should call fs_read_text command', async () => {
        vi.mocked(invoke).mockResolvedValue({ content: 'Hello World' })

        const result = await fsApi.readText('/path/to/file.txt')

        expect(invoke).toHaveBeenCalledWith('fs_read_text', { path: '/path/to/file.txt' })
        expect(result).toEqual({ content: 'Hello World' })
      })
    })

    describe('createDir', () => {
      it('should call fs_create_dir command with project_id and relative_path', async () => {
        vi.mocked(invoke).mockResolvedValue({ ok: true, path: '/path/to/new-dir' })

        const result = await fsApi.createDir('project-1', 'docs')

        expect(invoke).toHaveBeenCalledWith('fs_create_dir', {
          projectId: 'project-1',
          relativePath: 'docs',
        })
        expect(result).toEqual({ ok: true, path: '/path/to/new-dir' })
      })
    })

    describe('createFile', () => {
      it('should call fs_create_file command with project_id and relative_path', async () => {
        vi.mocked(invoke).mockResolvedValue({ ok: true, path: '/project/docs/readme.md' })

        const result = await fsApi.createFile('project-1', 'docs/readme.md')

        expect(invoke).toHaveBeenCalledWith('fs_create_file', {
          projectId: 'project-1',
          relativePath: 'docs/readme.md',
        })
        expect(result).toEqual({ ok: true, path: '/project/docs/readme.md' })
      })
    })

    describe('delete', () => {
      it('should call fs_delete command', async () => {
        vi.mocked(invoke).mockResolvedValue({ ok: true })

        const result = await fsApi.delete('/path/to/file.txt')

        expect(invoke).toHaveBeenCalledWith('fs_delete', { path: '/path/to/file.txt' })
        expect(result).toEqual({ ok: true })
      })
    })

    describe('rename', () => {
      it('should call fs_rename command with old_path and new_name', async () => {
        vi.mocked(invoke).mockResolvedValue({ ok: true, newPath: '/path/to/new-name.txt' })

        const result = await fsApi.rename('/path/to/old-name.txt', 'new-name.txt')

        expect(invoke).toHaveBeenCalledWith('fs_rename', {
          oldPath: '/path/to/old-name.txt',
          newName: 'new-name.txt',
        })
        expect(result).toEqual({ ok: true, newPath: '/path/to/new-name.txt' })
      })
    })

    describe('openExternal', () => {
      it('should call fs_open_external command', async () => {
        vi.mocked(invoke).mockResolvedValue({ ok: true })

        const result = await fsApi.openExternal('/path/to/file.txt')

        expect(invoke).toHaveBeenCalledWith('fs_open_external', { path: '/path/to/file.txt' })
        expect(result).toEqual({ ok: true })
      })

      it('should work with directory paths', async () => {
        vi.mocked(invoke).mockResolvedValue({ ok: true })

        await fsApi.openExternal('/path/to/folder')

        expect(invoke).toHaveBeenCalledWith('fs_open_external', { path: '/path/to/folder' })
      })
    })

    describe('copyFile', () => {
      it('should call fs_copy_file command with snake_case params', async () => {
        vi.mocked(invoke).mockResolvedValue({ ok: true, path: '/target/file.txt' })

        const result = await fsApi.copyFile('/source/file.txt', '/target/file.txt', false)

        expect(invoke).toHaveBeenCalledWith('fs_copy_file', {
          sourcePath: '/source/file.txt',
          targetPath: '/target/file.txt',
          overwrite: false,
        })
        expect(result).toEqual({ ok: true, path: '/target/file.txt' })
      })

      it('should call fs_copy_file command with overwrite', async () => {
        vi.mocked(invoke).mockResolvedValue({ ok: true, path: '/target/file.txt' })

        const result = await fsApi.copyFile('/source/file.txt', '/target/file.txt', true)

        expect(invoke).toHaveBeenCalledWith('fs_copy_file', {
          sourcePath: '/source/file.txt',
          targetPath: '/target/file.txt',
          overwrite: true,
        })
        expect(result).toEqual({ ok: true, path: '/target/file.txt' })
      })
    })
  })
})
