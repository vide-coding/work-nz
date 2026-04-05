import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Directory, Task, TaskColumn } from '@/types'

// Mock taskApi directly to avoid the invoke layer entirely
vi.mock('./useApi', () => ({
  taskApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listChildren: vi.fn(),
    createChild: vi.fn(),
    toggleComplete: vi.fn(),
    deleteChild: vi.fn(),
    listColumns: vi.fn(),
    createColumn: vi.fn(),
    updateColumn: vi.fn(),
    toggleColumnVisibility: vi.fn(),
    deleteColumn: vi.fn(),
  },
}))

vi.mock('./useModuleRegistry', () => ({
  directoryHasCapability: vi.fn(() => true),
}))

import { taskApi } from './useApi'
import { useTaskModule } from './useTaskModule'

// Create a mock task directory
function createMockDirectory(overrides: Partial<Directory> = {}): Directory {
  return {
    id: 'dir-task-1',
    projectId: 'proj-1',
    name: 'Tasks',
    path: '/test/tasks',
    moduleId: 'builtin:task',
    moduleConfig: undefined,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const mockDirectory = createMockDirectory()

// Mock task data — Task 1 is older, Task 2 is newer
const mockTasks: Task[] = [
  {
    id: 'task-1',
    directoryId: mockDirectory.id,
    parentId: null,
    title: 'Task 1',
    description: null,
    status: 'todo',
    priority: 'medium',
    assignee: null,
    dueDate: null,
    sortOrder: 0,
    isCompleted: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'task-2',
    directoryId: mockDirectory.id,
    parentId: null,
    title: 'Task 2',
    description: 'Description',
    status: 'in_progress',
    priority: 'high',
    assignee: 'alice',
    dueDate: '2026-04-10',
    sortOrder: 1,
    isCompleted: false,
    createdAt: '2026-01-02T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  },
]

// Mock columns
const mockColumns: TaskColumn[] = [
  {
    id: 'col-1',
    directoryId: mockDirectory.id,
    statusKey: 'todo',
    name: 'To Do',
    color: '#9CA3AF',
    sortOrder: 0,
    isVisible: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'col-2',
    directoryId: mockDirectory.id,
    statusKey: 'in_progress',
    name: 'In Progress',
    color: '#3B82F6',
    sortOrder: 1,
    isVisible: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'col-3',
    directoryId: mockDirectory.id,
    statusKey: 'done',
    name: 'Done',
    color: '#10B981',
    sortOrder: 2,
    isVisible: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
]

describe('useTaskModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty tasks and columns initially', () => {
      const { tasks, allTasks, columns, loading, error } = useTaskModule(mockDirectory)
      expect(tasks.value).toEqual([])
      expect(allTasks.value).toEqual([])
      expect(columns.value).toEqual([])
      expect(loading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('should return hasTaskCapability true', () => {
      const { hasTaskCapability } = useTaskModule(mockDirectory)
      expect(hasTaskCapability.value).toBe(true)
    })
  })

  describe('loadTasks', () => {
    it('should load tasks from the API', async () => {
      const { tasks, loading, loadTasks } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.list).mockResolvedValueOnce([...mockTasks])

      await loadTasks()

      expect(taskApi.list).toHaveBeenCalledWith(mockDirectory.id)
      expect(tasks.value).toHaveLength(2)
      // Default sort is sortOrder asc: Task 1 (sortOrder=0) comes first
      expect(tasks.value[0].title).toBe('Task 1')
      expect(loading.value).toBe(false)
    })

    it('should set error on failure', async () => {
      const { error, loadTasks } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.list).mockRejectedValueOnce(new Error('API error'))

      await loadTasks()

      expect(error.value).toBe('API error')
    })
  })

  describe('createTask', () => {
    it('should create a task and add it to the list', async () => {
      const { allTasks, loading, createTask } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.create).mockResolvedValueOnce(mockTasks[0])

      const result = await createTask({ title: 'Task 1', status: 'todo' })

      expect(taskApi.create).toHaveBeenCalledWith(
        mockDirectory.id,
        'Task 1',
        undefined,
        undefined,
        undefined,
        undefined,
        'todo'
      )
      expect(result?.title).toBe('Task 1')
      expect(allTasks.value).toHaveLength(1)
      expect(loading.value).toBe(false)
    })

    it('should return null on failure', async () => {
      const { createTask } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.create).mockRejectedValueOnce(new Error('Create failed'))

      const result = await createTask({ title: 'Task 1' })

      expect(result).toBeNull()
    })
  })

  describe('updateTask', () => {
    it('should update a task', async () => {
      const { updateTask, loadTasks } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.list).mockResolvedValueOnce([...mockTasks])
      vi.mocked(taskApi.update).mockResolvedValueOnce({ ...mockTasks[0], title: 'Updated Title' })

      await loadTasks()
      const result = await updateTask('task-1', { title: 'Updated Title' })

      expect(taskApi.update).toHaveBeenCalledWith('task-1', { title: 'Updated Title' })
      expect(result?.title).toBe('Updated Title')
    })
  })

  describe('deleteTask', () => {
    it('should delete a task and remove it from the list', async () => {
      const { allTasks, deleteTask, loadTasks } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.list).mockResolvedValueOnce([...mockTasks])
      vi.mocked(taskApi.delete).mockResolvedValueOnce()

      await loadTasks()
      const result = await deleteTask('task-1')

      expect(taskApi.delete).toHaveBeenCalledWith('task-1')
      expect(result).toBe(true)
    })
  })

  describe('loadColumns', () => {
    it('should load columns from the API', async () => {
      const { columns, columnsLoading, loadColumns } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.listColumns).mockResolvedValueOnce([...mockColumns])

      await loadColumns()

      expect(taskApi.listColumns).toHaveBeenCalledWith(mockDirectory.id)
      expect(columns.value).toHaveLength(3)
      expect(columnsLoading.value).toBe(false)
    })
  })

  describe('createColumn', () => {
    it('should create a new column', async () => {
      const { columns, createColumn } = useTaskModule(mockDirectory)
      const newCol: TaskColumn = {
        id: 'col-new',
        directoryId: mockDirectory.id,
        statusKey: 'review',
        name: 'Review',
        color: '#8B5CF6',
        sortOrder: 3,
        isVisible: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }
      vi.mocked(taskApi.createColumn).mockResolvedValueOnce(newCol)

      const result = await createColumn('review', 'Review', '#8B5CF6')

      expect(taskApi.createColumn).toHaveBeenCalledWith(
        mockDirectory.id,
        'review',
        'Review',
        '#8B5CF6'
      )
      expect(result?.statusKey).toBe('review')
      expect(columns.value).toHaveLength(1)
    })
  })

  describe('updateColumn', () => {
    it('should update a column', async () => {
      const { updateColumn, loadColumns } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.listColumns).mockResolvedValueOnce([...mockColumns])
      vi.mocked(taskApi.updateColumn).mockResolvedValueOnce({
        ...mockColumns[0],
        name: 'New Name',
      })

      await loadColumns()
      const result = await updateColumn('col-1', { name: 'New Name' })

      expect(taskApi.updateColumn).toHaveBeenCalledWith('col-1', { name: 'New Name' })
      expect(result?.name).toBe('New Name')
    })
  })

  describe('toggleColumnVisibility', () => {
    it('should toggle column visibility', async () => {
      const { toggleColumnVisibility, loadColumns } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.listColumns).mockResolvedValueOnce([...mockColumns])
      vi.mocked(taskApi.toggleColumnVisibility).mockResolvedValueOnce({
        ...mockColumns[0],
        isVisible: false,
      })

      await loadColumns()
      await toggleColumnVisibility('col-1')

      expect(taskApi.toggleColumnVisibility).toHaveBeenCalledWith('col-1')
    })
  })

  describe('deleteColumn', () => {
    it('should delete a column', async () => {
      const { columns, deleteColumn, loadColumns } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.listColumns).mockResolvedValueOnce([...mockColumns])
      vi.mocked(taskApi.deleteColumn).mockResolvedValueOnce()

      await loadColumns()
      const result = await deleteColumn('col-1')

      expect(taskApi.deleteColumn).toHaveBeenCalledWith('col-1')
      expect(result).toBe(true)
    })
  })

  describe('columnStatusValues', () => {
    it('should map visible columns to status values', async () => {
      const { statusValues, loadColumns } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.listColumns).mockResolvedValueOnce([...mockColumns])

      await loadColumns()

      // Should only include visible columns (2 out of 3: todo, in_progress)
      expect(statusValues.value).toHaveLength(2)
      expect(statusValues.value.map((v) => v.id)).toEqual(['todo', 'in_progress'])
    })
  })

  describe('visibleColumns', () => {
    it('should only return visible columns', async () => {
      const { visibleColumns, loadColumns } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.listColumns).mockResolvedValueOnce([...mockColumns])

      await loadColumns()

      expect(visibleColumns.value).toHaveLength(2)
      expect(visibleColumns.value.every((c) => c.isVisible)).toBe(true)
    })
  })

  describe('filteredTasks', () => {
    it('should filter tasks by status', async () => {
      const { tasks, setFilter, loadTasks } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.list).mockResolvedValueOnce([...mockTasks])

      await loadTasks()
      setFilter({ status: ['todo'] })

      expect(tasks.value).toHaveLength(1)
      expect(tasks.value[0].status).toBe('todo')
    })

    it('should filter tasks by search text', async () => {
      const { tasks, setFilter, loadTasks } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.list).mockResolvedValueOnce([...mockTasks])

      await loadTasks()
      setFilter({ search: 'Task 1' })

      expect(tasks.value).toHaveLength(1)
      expect(tasks.value[0].title).toBe('Task 1')
    })

    it('should sort tasks by priority', async () => {
      const { tasks, setSort, loadTasks } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.list).mockResolvedValueOnce([...mockTasks])

      await loadTasks()
      setSort({ field: 'priority', direction: 'asc' })

      expect(tasks.value[0].priority).toBe('high')
    })

    it('should clear filters', async () => {
      const { tasks, setFilter, clearFilter, loadTasks } = useTaskModule(mockDirectory)
      vi.mocked(taskApi.list).mockResolvedValueOnce([...mockTasks])

      await loadTasks()
      setFilter({ status: ['todo'] })
      clearFilter()

      expect(tasks.value).toHaveLength(2)
    })
  })

  describe('child tasks', () => {
    it('should load child tasks for a parent', async () => {
      const { childTasksMap, loadChildTasks } = useTaskModule(mockDirectory)
      const childTasks: Task[] = [{ ...mockTasks[0], id: 'child-1', parentId: 'task-1' }]
      vi.mocked(taskApi.listChildren).mockResolvedValueOnce(childTasks)

      await loadChildTasks('task-1')

      expect(childTasksMap.value['task-1']).toHaveLength(1)
      expect(childTasksMap.value['task-1'][0].id).toBe('child-1')
    })

    it('should create a child task', async () => {
      const { childTasksMap, createChildTask } = useTaskModule(mockDirectory)
      const childTask: Task = { ...mockTasks[0], id: 'child-1', parentId: 'task-1' }
      vi.mocked(taskApi.createChild).mockResolvedValueOnce(childTask)

      await createChildTask('task-1', 'New child')

      expect(childTasksMap.value['task-1']).toHaveLength(1)
    })

    it('should delete a child task', async () => {
      const { childTasksMap, loadChildTasks, deleteChildTask } = useTaskModule(mockDirectory)
      const childTasks: Task[] = [{ ...mockTasks[0], id: 'child-1', parentId: 'task-1' }]
      vi.mocked(taskApi.listChildren).mockResolvedValueOnce(childTasks)
      vi.mocked(taskApi.deleteChild).mockResolvedValueOnce()

      await loadChildTasks('task-1')
      await deleteChildTask('child-1')

      expect(childTasksMap.value['task-1']).toHaveLength(0)
    })

    it('should get child counts', async () => {
      const { childTasksMap, getChildCounts, loadChildTasks } = useTaskModule(mockDirectory)
      const childTasks: Task[] = [
        { ...mockTasks[0], id: 'child-1', parentId: 'task-1', isCompleted: true },
        { ...mockTasks[0], id: 'child-2', parentId: 'task-1', isCompleted: false },
      ]
      vi.mocked(taskApi.listChildren).mockResolvedValueOnce(childTasks)

      await loadChildTasks('task-1')

      const counts = getChildCounts('task-1')
      expect(counts.total).toBe(2)
      expect(counts.completed).toBe(1)
    })
  })
})
