import type { Module, ModuleCapability, Directory } from '@/types'

/**
 * Built-in module definitions
 */
export const BUILTIN_MODULES: Module[] = [
  {
    id: 'builtin:git',
    key: 'git',
    name: 'Git',
    description: 'Git repository management with clone, pull, status, and log capabilities',
    version: '1.0.0',
    capabilities: ['git.clone', 'git.pull', 'git.status', 'git.log', 'git.config'],
    configSchema: {
      type: 'object',
      title: 'Git Module Configuration',
      properties: {
        autoDetect: {
          type: 'boolean',
          title: 'Auto-detect repositories',
          description: 'Automatically detect Git repositories in this directory',
          default: true,
        },
        defaultRemote: {
          type: 'string',
          title: 'Default remote name',
          description: 'The default remote to use for pull/fetch operations',
          default: 'origin',
          minLength: 1,
        },
        autoPull: {
          type: 'boolean',
          title: 'Auto-pull on startup',
          description: 'Automatically pull changes when the directory is opened',
          default: false,
        },
      },
      required: ['autoDetect', 'defaultRemote', 'autoPull'],
    },
    defaultConfig: {
      autoDetect: true,
      defaultRemote: 'origin',
      autoPull: false,
    },
    icon: 'git',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin:task',
    key: 'task',
    name: 'Tasks',
    description: 'Task management with status tracking, priorities, and assignments',
    version: '1.0.0',
    capabilities: ['task.create', 'task.update', 'task.delete', 'task.list', 'task.status'],
    configSchema: {
      type: 'object',
      title: 'Task Module Configuration',
      properties: {
        defaultStatus: {
          type: 'string',
          title: 'Default status for new tasks',
          default: 'todo',
        },
        statusValues: {
          type: 'array',
          title: 'Status values',
          description: 'Available status values for tasks',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              color: { type: 'string' },
            },
          } as any,
          default: [
            { id: 'todo', name: 'To Do', color: '#9CA3AF' },
            { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
            { id: 'done', name: 'Done', color: '#10B981' },
          ],
        },
        priorityValues: {
          type: 'array',
          title: 'Priority values',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              color: { type: 'string' },
            },
          } as any,
          default: [
            { id: 'low', name: 'Low', color: '#6B7280' },
            { id: 'medium', name: 'Medium', color: '#F59E0B' },
            { id: 'high', name: 'High', color: '#EF4444' },
            { id: 'urgent', name: 'Urgent', color: '#DC2626' },
          ],
        },
      },
      required: ['defaultStatus'],
    },
    defaultConfig: {
      defaultStatus: 'todo',
      statusValues: [
        { id: 'todo', name: 'To Do', color: '#9CA3AF' },
        { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
        { id: 'done', name: 'Done', color: '#10B981' },
      ],
      priorityValues: [
        { id: 'low', name: 'Low', color: '#6B7280' },
        { id: 'medium', name: 'Medium', color: '#F59E0B' },
        { id: 'high', name: 'High', color: '#EF4444' },
        { id: 'urgent', name: 'Urgent', color: '#DC2626' },
      ],
    },
    icon: 'task',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin:file',
    key: 'file',
    name: 'Files',
    description: 'General file browsing and preview capabilities',
    version: '1.0.0',
    capabilities: [
      'file.browse',
      'file.read',
      'file.preview',
      'file.search',
      'file.create',
      'file.delete',
      'file.rename',
    ],
    configSchema: {
      type: 'object',
      title: 'File Module Configuration',
      properties: {
        defaultViewMode: {
          type: 'string',
          title: 'Default view mode',
          description: 'Preferred view mode for file listing',
          enum: ['list', 'grid'],
          default: 'list',
        },
        showHiddenFiles: {
          type: 'boolean',
          title: 'Show hidden files',
          description: 'Whether to show files starting with dot',
          default: false,
        },
        defaultSortOrder: {
          type: 'string',
          title: 'Default sort order',
          enum: ['name', 'size', 'date'],
          default: 'name',
        },
        fileTypeFilters: {
          type: 'array',
          title: 'File type filters',
          description: 'Which file types to show',
          items: {
            type: 'string',
          },
          default: [],
        },
      },
      required: ['defaultViewMode', 'showHiddenFiles', 'defaultSortOrder'],
    },
    defaultConfig: {
      defaultViewMode: 'list',
      showHiddenFiles: false,
      defaultSortOrder: 'name',
      fileTypeFilters: [],
    },
    icon: 'file',
    isBuiltIn: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

/**
 * Module registry - manages module registration and lookup
 */
export class ModuleRegistry {
  private modules: Map<string, Module> = new Map()
  private static instance: ModuleRegistry

  static getInstance(): ModuleRegistry {
    if (!ModuleRegistry.instance) {
      ModuleRegistry.instance = new ModuleRegistry()
    }
    return ModuleRegistry.instance
  }

  /**
   * Set the instance directly (useful for testing)
   */
  static setInstance(instance: ModuleRegistry): void {
    ModuleRegistry.instance = instance
  }

  /**
   * Reset the registry to initial state (useful for testing)
   */
  static reset(): void {
    ModuleRegistry.instance = new ModuleRegistry()
  }

  constructor() {
    // Register built-in modules
    BUILTIN_MODULES.forEach((module) => this.register(module))
  }

  /**
   * Register a new module
   */
  register(module: Module): void {
    if (this.modules.has(module.key)) {
      throw new Error(`Module with key '${module.key}' is already registered`)
    }
    this.modules.set(module.key, module)
  }

  /**
   * Unregister a module
   */
  unregister(key: string): void {
    this.modules.delete(key)
  }

  /**
   * Get a module by key or full id
   * Accepts either the module key (e.g., 'git') or full id (e.g., 'builtin:git')
   */
  get(keyOrId: string): Module | undefined {
    // First try direct lookup by key
    const byKey = this.modules.get(keyOrId)
    if (byKey) return byKey

    // Try to find by id
    for (const mod of this.modules.values()) {
      if (mod.id === keyOrId) {
        return mod
      }
    }

    return undefined
  }

  /**
   * Get all registered modules
   */
  getAll(): Module[] {
    return Array.from(this.modules.values())
  }

  /**
   * Get all built-in modules
   */
  getBuiltIn(): Module[] {
    return this.getAll().filter((m) => m.isBuiltIn)
  }

  /**
   * Check if a module has a specific capability
   * Accepts either the module key (e.g., 'git') or full id (e.g., 'builtin:git')
   */
  hasCapability(keyOrId: string, capability: ModuleCapability): boolean {
    const module = this.get(keyOrId)
    return module?.capabilities.includes(capability) ?? false
  }

  /**
   * Get all modules with a specific capability
   */
  getByCapability(capability: ModuleCapability): Module[] {
    return this.getAll().filter((m) => m.capabilities.includes(capability))
  }

  /**
   * Validate configuration against module's schema
   */
  validateConfig(
    key: string,
    config: Record<string, unknown>
  ): { valid: boolean; errors?: string[] } {
    const module = this.get(key)
    if (!module) {
      return { valid: false, errors: [`Module '${key}' not found`] }
    }

    const errors: string[] = []
    const schema = module.configSchema

    // Check required fields
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in config)) {
          errors.push(`Missing required field: ${required}`)
        }
      }
    }

    // Validate each property
    for (const [propKey, value] of Object.entries(config)) {
      const prop = schema.properties[propKey]
      if (!prop) {
        errors.push(`Unknown property: ${propKey}`)
        continue
      }

      // Type validation
      const actualType = this.getActualType(value)
      const expectedType = prop.type

      if (!this.isValidType(actualType, expectedType)) {
        errors.push(`Invalid type for ${propKey}: expected ${prop.type}, got ${actualType}`)
        continue
      }

      // Enum validation
      if (prop.enum && !prop.enum.includes(value)) {
        errors.push(`Invalid value for ${propKey}: must be one of ${prop.enum.join(', ')}`)
      }

      // String length validation
      if (prop.type === 'string' && typeof value === 'string') {
        if (prop.minLength !== undefined && value.length < prop.minLength) {
          errors.push(`${propKey} must be at least ${prop.minLength} characters`)
        }
        if (prop.maxLength !== undefined && value.length > prop.maxLength) {
          errors.push(`${propKey} must be at most ${prop.maxLength} characters`)
        }
      }

      // Number range validation
      if (prop.type === 'number' && typeof value === 'number') {
        if (prop.minimum !== undefined && value < prop.minimum) {
          errors.push(`${propKey} must be at least ${prop.minimum}`)
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          errors.push(`${propKey} must be at most ${prop.maximum}`)
        }
      }

      // Array validation with items schema
      if (prop.type === 'array' && Array.isArray(value)) {
        if (prop.items) {
          value.forEach((item, index) => {
            const itemErrors = this.validateAgainstSchema(
              { [propKey]: item },
              { properties: { [propKey]: prop.items } },
              propKey
            )
            itemErrors.forEach((e) => errors.push(`[${index}]: ${e}`))
          })
        }
      }

      // Object validation with nested properties
      if (
        prop.type === 'object' &&
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        if (prop.properties) {
          const nestedErrors = this.validateAgainstSchema(
            value as Record<string, unknown>,
            { type: 'object', properties: prop.properties } as any,
            propKey
          )
          errors.push(...nestedErrors)
        }
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
  }

  /**
   * Get the actual type of a value
   */
  private getActualType(value: unknown): string {
    if (Array.isArray(value)) return 'array'
    if (value === null) return 'null'
    return typeof value
  }

  /**
   * Check if actual type matches expected type
   */
  private isValidType(actualType: string, expectedType: string): boolean {
    if (expectedType === 'object') {
      return actualType === 'object' || actualType === 'array'
    }
    return actualType === expectedType
  }

  /**
   * Validate a config object against a schema (internal helper)
   */
  private validateAgainstSchema(
    config: Record<string, unknown>,
    schema: { properties?: Record<string, unknown> },
    prefix: string = ''
  ): string[] {
    const errors: string[] = []

    for (const [key, value] of Object.entries(config)) {
      const prop = schema.properties?.[key]
      if (!prop || typeof prop !== 'object') continue

      const propConfig = prop as {
        type?: string
        minLength?: number
        maxLength?: number
        minimum?: number
        maximum?: number
        enum?: unknown[]
        items?: unknown
      }
      const actualType = this.getActualType(value)
      const expectedType = propConfig.type || 'object'

      if (!this.isValidType(actualType, expectedType)) {
        errors.push(
          `${prefix ? prefix + '.' : ''}${key}: expected ${propConfig.type}, got ${actualType}`
        )
        continue
      }

      // String validations
      if (propConfig.type === 'string' && typeof value === 'string') {
        if (propConfig.minLength !== undefined && value.length < propConfig.minLength) {
          errors.push(
            `${prefix ? prefix + '.' : ''}${key} must be at least ${propConfig.minLength} characters`
          )
        }
        if (propConfig.maxLength !== undefined && value.length > propConfig.maxLength) {
          errors.push(
            `${prefix ? prefix + '.' : ''}${key} must be at most ${propConfig.maxLength} characters`
          )
        }
      }

      // Number validations
      if (propConfig.type === 'number' && typeof value === 'number') {
        if (propConfig.minimum !== undefined && value < propConfig.minimum) {
          errors.push(`${prefix ? prefix + '.' : ''}${key} must be at least ${propConfig.minimum}`)
        }
        if (propConfig.maximum !== undefined && value > propConfig.maximum) {
          errors.push(`${prefix ? prefix + '.' : ''}${key} must be at most ${propConfig.maximum}`)
        }
      }

      // Enum validations
      if (propConfig.enum && !propConfig.enum.includes(value)) {
        errors.push(
          `${prefix ? prefix + '.' : ''}${key}: must be one of ${(propConfig.enum as unknown[]).join(', ')}`
        )
      }

      // Array items validation
      if (propConfig.type === 'array' && Array.isArray(value) && propConfig.items) {
        value.forEach((item, index) => {
          if (
            propConfig.items &&
            typeof propConfig.items === 'object' &&
            'type' in propConfig.items
          ) {
            const itemProp = propConfig.items as { type: string }
            const itemActualType = this.getActualType(item)
            if (!this.isValidType(itemActualType, itemProp.type)) {
              errors.push(
                `${prefix ? prefix + '.' : ''}${key}[${index}]: expected ${itemProp.type}, got ${itemActualType}`
              )
            }
          }
        })
      }
    }

    return errors
  }
}

// Global registry instance
export const moduleRegistry = ModuleRegistry.getInstance()

/**
 * Helper function to check if a directory has a specific capability
 */
export function directoryHasCapability(
  directory: Directory,
  capability: ModuleCapability
): boolean {
  if (!directory.moduleId) return false
  return moduleRegistry.hasCapability(directory.moduleId, capability)
}

/**
 * Helper function to get capabilities for a directory
 */
export function getDirectoryCapabilities(directory: Directory): ModuleCapability[] {
  if (!directory.moduleId) return []
  const module = moduleRegistry.get(directory.moduleId)
  return module?.capabilities ?? []
}
