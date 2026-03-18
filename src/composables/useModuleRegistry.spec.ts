import { describe, it, expect, beforeEach } from 'vitest'
import {
  ModuleRegistry,
  BUILTIN_MODULES,
  moduleRegistry,
  directoryHasCapability,
  getDirectoryCapabilities,
} from './useModuleRegistry'
import type { Module, Directory } from '@/types'

describe('useModuleRegistry', () => {
  beforeEach(() => {
    ModuleRegistry.reset()
  })

  describe('BUILTIN_MODULES', () => {
    it('should have git, task, and file modules', () => {
      expect(BUILTIN_MODULES).toHaveLength(3)
      expect(BUILTIN_MODULES.some((m) => m.key === 'git')).toBe(true)
      expect(BUILTIN_MODULES.some((m) => m.key === 'task')).toBe(true)
      expect(BUILTIN_MODULES.some((m) => m.key === 'file')).toBe(true)
    })

    it('should have valid module structure', () => {
      BUILTIN_MODULES.forEach((module) => {
        expect(module.id).toBeDefined()
        expect(module.key).toBeDefined()
        expect(module.name).toBeDefined()
        expect(module.capabilities).toBeDefined()
        expect(module.capabilities.length).toBeGreaterThan(0)
        expect(module.isBuiltIn).toBe(true)
      })
    })
  })

  describe('ModuleRegistry singleton', () => {
    it('should be a singleton', () => {
      const instance1 = ModuleRegistry.getInstance()
      const instance2 = ModuleRegistry.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should reset singleton', () => {
      const instance1 = ModuleRegistry.getInstance()
      ModuleRegistry.reset()
      const instance2 = ModuleRegistry.getInstance()
      expect(instance1).not.toBe(instance2)
    })

    it('should allow setting custom instance', () => {
      const customRegistry = new ModuleRegistry()
      ModuleRegistry.setInstance(customRegistry)
      expect(ModuleRegistry.getInstance()).toBe(customRegistry)
    })
  })

  describe('ModuleRegistry.register', () => {
    it('should register a new module', () => {
      const registry = new ModuleRegistry()
      const testModule: Module = {
        id: 'test:custom',
        key: 'custom',
        name: 'Custom Module',
        description: 'A custom test module',
        version: '1.0.0',
        capabilities: ['custom.action'],
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      registry.register(testModule)
      expect(registry.get('custom')).toEqual(testModule)
    })

    it('should throw error when registering duplicate key', () => {
      const registry = new ModuleRegistry()
      const testModule: Module = {
        id: 'test:git2',
        key: 'git',
        name: 'Another Git',
        description: 'Duplicate key',
        version: '1.0.0',
        capabilities: [],
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(() => registry.register(testModule)).toThrow(
        "Module with key 'git' is already registered"
      )
    })
  })

  describe('ModuleRegistry.get', () => {
    it('should get module by key', () => {
      const registry = new ModuleRegistry()
      const gitModule = registry.get('git')
      expect(gitModule).toBeDefined()
      expect(gitModule?.key).toBe('git')
    })

    it('should get module by id', () => {
      const registry = new ModuleRegistry()
      const gitModule = registry.get('builtin:git')
      expect(gitModule).toBeDefined()
      expect(gitModule?.key).toBe('git')
    })

    it('should return undefined for non-existent module', () => {
      const registry = new ModuleRegistry()
      expect(registry.get('non-existent')).toBeUndefined()
    })
  })

  describe('ModuleRegistry.unregister', () => {
    it('should unregister a module', () => {
      const registry = new ModuleRegistry()
      const testModule: Module = {
        id: 'test:remove',
        key: 'remove',
        name: 'Remove Me',
        description: 'Will be removed',
        version: '1.0.0',
        capabilities: [],
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      registry.register(testModule)
      expect(registry.get('remove')).toBeDefined()

      registry.unregister('remove')
      expect(registry.get('remove')).toBeUndefined()
    })
  })

  describe('ModuleRegistry.getAll', () => {
    it('should return all registered modules', () => {
      const registry = new ModuleRegistry()
      const allModules = registry.getAll()
      expect(allModules.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('ModuleRegistry.getBuiltIn', () => {
    it('should return only built-in modules', () => {
      const registry = new ModuleRegistry()
      const builtInModules = registry.getBuiltIn()
      builtInModules.forEach((m) => expect(m.isBuiltIn).toBe(true))
    })
  })

  describe('ModuleRegistry.hasCapability', () => {
    it('should return true for valid capability', () => {
      const registry = new ModuleRegistry()
      expect(registry.hasCapability('git', 'git.clone')).toBe(true)
      expect(registry.hasCapability('task', 'task.create')).toBe(true)
    })

    it('should return false for invalid capability', () => {
      const registry = new ModuleRegistry()
      expect(registry.hasCapability('git', 'task.create')).toBe(false)
    })

    it('should return false for non-existent module', () => {
      const registry = new ModuleRegistry()
      expect(registry.hasCapability('non-existent', 'any.capability')).toBe(false)
    })

    it('should work with full module id', () => {
      const registry = new ModuleRegistry()
      expect(registry.hasCapability('builtin:git', 'git.clone')).toBe(true)
    })
  })

  describe('ModuleRegistry.getByCapability', () => {
    it('should return modules with specific capability', () => {
      const registry = new ModuleRegistry()
      const gitModules = registry.getByCapability('git.clone')
      expect(gitModules.some((m) => m.key === 'git')).toBe(true)
    })
  })

  describe('ModuleRegistry.validateConfig', () => {
    it('should validate correct config', () => {
      const registry = new ModuleRegistry()
      const result = registry.validateConfig('git', {
        autoDetect: true,
        defaultRemote: 'origin',
        autoPull: false,
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toBeUndefined()
    })

    it('should return error for missing required field', () => {
      const registry = new ModuleRegistry()
      const result = registry.validateConfig('git', {
        autoDetect: true,
        // missing defaultRemote
      })
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Missing required field: defaultRemote')
    })

    it('should return error for unknown module', () => {
      const registry = new ModuleRegistry()
      const result = registry.validateConfig('non-existent', {})
      expect(result.valid).toBe(false)
      expect(result.errors).toContain("Module 'non-existent' not found")
    })

    it('should validate type mismatches', () => {
      const registry = new ModuleRegistry()
      const result = registry.validateConfig('git', {
        autoDetect: 'yes', // should be boolean
        defaultRemote: 'origin',
        autoPull: false,
      } as any)
      expect(result.valid).toBe(false)
      expect(result.errors?.some((e) => e.includes('Invalid type'))).toBe(true)
    })

    it('should validate string minLength', () => {
      const registry = new ModuleRegistry()
      const result = registry.validateConfig('git', {
        autoDetect: true,
        defaultRemote: '', // minLength is 1
        autoPull: false,
      })
      expect(result.valid).toBe(false)
      expect(result.errors?.some((e) => e.includes('at least 1'))).toBe(true)
    })

    it('should validate enum values', () => {
      const registry = new ModuleRegistry()
      const result = registry.validateConfig('file', {
        defaultViewMode: 'invalid',
        showHiddenFiles: false,
        defaultSortOrder: 'name',
      })
      expect(result.valid).toBe(false)
      expect(result.errors?.some((e) => e.includes('Invalid value'))).toBe(true)
    })
  })

  describe('helper functions', () => {
    describe('directoryHasCapability', () => {
      it('should return true when directory has capability', () => {
        const directory = {
          id: 1,
          projectId: 1,
          name: 'test',
          path: '/test',
          moduleId: 'builtin:git',
          moduleConfig: {},
          order: 0,
          createdAt: '',
          updatedAt: '',
        } as Directory

        expect(directoryHasCapability(directory, 'git.clone')).toBe(true)
      })

      it('should return false when directory has no module', () => {
        const directory = {
          id: 1,
          projectId: 1,
          name: 'test',
          path: '/test',
          moduleId: null,
          order: 0,
          createdAt: '',
          updatedAt: '',
        } as Directory

        expect(directoryHasCapability(directory, 'git.clone')).toBe(false)
      })
    })

    describe('getDirectoryCapabilities', () => {
      it('should return module capabilities', () => {
        const directory = {
          id: 1,
          projectId: 1,
          name: 'test',
          path: '/test',
          moduleId: 'builtin:git',
          moduleConfig: {},
          order: 0,
          createdAt: '',
          updatedAt: '',
        } as Directory

        const capabilities = getDirectoryCapabilities(directory)
        expect(capabilities).toContain('git.clone')
        expect(capabilities).toContain('git.pull')
      })

      it('should return empty array when no module', () => {
        const directory = {
          id: 1,
          projectId: 1,
          name: 'test',
          path: '/test',
          moduleId: null,
          order: 0,
          createdAt: '',
          updatedAt: '',
        } as Directory

        expect(getDirectoryCapabilities(directory)).toEqual([])
      })
    })
  })

  describe('global moduleRegistry instance', () => {
    it('should have built-in modules pre-registered', () => {
      expect(moduleRegistry.get('git')).toBeDefined()
      expect(moduleRegistry.get('task')).toBeDefined()
      expect(moduleRegistry.get('file')).toBeDefined()
    })
  })
})
