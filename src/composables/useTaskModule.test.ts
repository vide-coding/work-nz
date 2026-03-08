import { describe, it, expect } from 'vitest'
import type { Directory } from '@/types'

// Mock directory for testing
const mockDirectory: Directory = {
  id: 'dir-1',
  projectId: 'proj-1',
  name: 'Test Directory',
  relativePath: 'test',
  moduleId: 'builtin:task',
  moduleConfig: {
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
    ],
  },
  sortOrder: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const mockDirectoryWithoutModule: Directory = {
  id: 'dir-2',
  projectId: 'proj-1',
  name: 'No Module Directory',
  relativePath: 'no-module',
  sortOrder: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe('Task Module Types', () => {
  it('should have valid task module directory', () => {
    expect(mockDirectory.moduleId).toBe('builtin:task')
    expect(mockDirectory.moduleConfig).toBeDefined()
  })

  it('should have valid config schema', () => {
    const config = mockDirectory.moduleConfig as any
    expect(config.defaultStatus).toBe('todo')
    expect(config.statusValues).toHaveLength(3)
    expect(config.priorityValues).toHaveLength(3)
  })

  it('should identify directory without module', () => {
    expect(mockDirectoryWithoutModule.moduleId).toBeUndefined()
  })
})

describe('Task Module Capabilities', () => {
  it('should have task capabilities in module config', () => {
    const config = mockDirectory.moduleConfig as any
    expect(config).toHaveProperty('defaultStatus')
    expect(config).toHaveProperty('statusValues')
    expect(config).toHaveProperty('priorityValues')
  })

  it('should have valid status values', () => {
    const config = mockDirectory.moduleConfig as any
    const statusValues = config.statusValues
    expect(statusValues).toContainEqual(expect.objectContaining({ id: 'todo', name: 'To Do' }))
    expect(statusValues).toContainEqual(
      expect.objectContaining({ id: 'in_progress', name: 'In Progress' })
    )
    expect(statusValues).toContainEqual(expect.objectContaining({ id: 'done', name: 'Done' }))
  })

  it('should have valid priority values', () => {
    const config = mockDirectory.moduleConfig as any
    const priorityValues = config.priorityValues
    expect(priorityValues).toContainEqual(expect.objectContaining({ id: 'low', name: 'Low' }))
    expect(priorityValues).toContainEqual(expect.objectContaining({ id: 'medium', name: 'Medium' }))
    expect(priorityValues).toContainEqual(expect.objectContaining({ id: 'high', name: 'High' }))
  })
})
