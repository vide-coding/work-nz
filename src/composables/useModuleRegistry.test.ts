import { describe, it, expect, beforeEach } from 'vitest'
import { ModuleRegistry, BUILTIN_MODULES } from './useModuleRegistry'
import type { Module } from '@/types'

describe('ModuleRegistry', () => {
  let moduleRegistry: ModuleRegistry

  beforeEach(() => {
    // Reset registry state between tests
    ModuleRegistry.reset()
    moduleRegistry = ModuleRegistry.getInstance()
  })

  describe('BUILTIN_MODULES', () => {
    it('should have git, task, and file modules', () => {
      const keys = BUILTIN_MODULES.map((m) => m.key)
      expect(keys).toContain('git')
      expect(keys).toContain('task')
      expect(keys).toContain('file')
    })

    it('should have valid JSON schema for each module', () => {
      BUILTIN_MODULES.forEach((module) => {
        expect(module.configSchema).toBeDefined()
        expect(module.configSchema.type).toBe('object')
        expect(module.configSchema.properties).toBeDefined()
        expect(module.configSchema.required).toBeDefined()
      })
    })

    it('should have capabilities for each module', () => {
      const gitModule = BUILTIN_MODULES.find((m) => m.key === 'git')
      expect(gitModule?.capabilities).toContain('git.clone')
      expect(gitModule?.capabilities).toContain('git.pull')
      expect(gitModule?.capabilities).toContain('git.status')

      const taskModule = BUILTIN_MODULES.find((m) => m.key === 'task')
      expect(taskModule?.capabilities).toContain('task.create')
      expect(taskModule?.capabilities).toContain('task.list')

      const fileModule = BUILTIN_MODULES.find((m) => m.key === 'file')
      expect(fileModule?.capabilities).toContain('file.browse')
      expect(fileModule?.capabilities).toContain('file.read')
    })

    it('should have default config matching schema', () => {
      BUILTIN_MODULES.forEach((module) => {
        expect(module.defaultConfig).toBeDefined()
        // Default config should be valid according to schema
        const validation = moduleRegistry.validateConfig(module.key, module.defaultConfig)
        expect(validation.valid).toBe(true)
      })
    })
  })

  describe('ModuleRegistry', () => {
    it('should get module by key', () => {
      const gitModule = moduleRegistry.get('git')
      expect(gitModule).toBeDefined()
      expect(gitModule?.key).toBe('git')
    })

    it('should return undefined for unknown module', () => {
      const unknownModule = moduleRegistry.get('unknown')
      expect(unknownModule).toBeUndefined()
    })

    it('should get all modules', () => {
      const allModules = moduleRegistry.getAll()
      expect(allModules.length).toBeGreaterThan(0)
    })

    it('should get built-in modules', () => {
      const builtIn = moduleRegistry.getBuiltIn()
      expect(builtIn.every((m) => m.isBuiltIn)).toBe(true)
    })

    it('should check capability presence', () => {
      expect(moduleRegistry.hasCapability('git', 'git.clone')).toBe(true)
      expect(moduleRegistry.hasCapability('git', 'task.create')).toBe(false)
      expect(moduleRegistry.hasCapability('unknown', 'git.clone')).toBe(false)
    })

    it('should get modules by capability', () => {
      const gitModules = moduleRegistry.getByCapability('git.clone')
      expect(gitModules.length).toBe(1)
      expect(gitModules[0].key).toBe('git')

      const taskModules = moduleRegistry.getByCapability('task.list')
      expect(taskModules.length).toBe(1)
      expect(taskModules[0].key).toBe('task')
    })

    describe('validateConfig', () => {
      it('should validate valid config', () => {
        const gitModule = moduleRegistry.get('git')
        const config = {
          autoDetect: true,
          defaultRemote: 'origin',
          autoPull: false,
        }
        const validation = moduleRegistry.validateConfig('git', config)
        expect(validation.valid).toBe(true)
        expect(validation.errors).toBeUndefined()
      })

      it('should reject unknown module', () => {
        const validation = moduleRegistry.validateConfig('unknown', {})
        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain("Module 'unknown' not found")
      })

      it('should reject missing required fields', () => {
        const config = {
          autoDetect: true,
          // missing defaultRemote
        }
        const validation = moduleRegistry.validateConfig('git', config)
        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('Missing required field: defaultRemote')
      })

      it('should reject invalid field types', () => {
        const config = {
          autoDetect: 'not a boolean',
          defaultRemote: 'origin',
          autoPull: false,
        }
        const validation = moduleRegistry.validateConfig('git', config)
        expect(validation.valid).toBe(false)
      })

      it('should reject invalid enum values', () => {
        const config = {
          autoDetect: true,
          defaultRemote: 'origin',
          autoPull: false,
        }
        // This should be valid
        const validation = moduleRegistry.validateConfig('git', config)
        expect(validation.valid).toBe(true)
      })

      it('should validate string length constraints', () => {
        const config = {
          autoDetect: true,
          defaultRemote: '', // Too short - minLength is 1
          autoPull: false,
        }
        const validation = moduleRegistry.validateConfig('git', config)
        expect(validation.valid).toBe(false)
        expect(validation.errors).toContain('defaultRemote must be at least 1 characters')
      })
    })
  })
})
