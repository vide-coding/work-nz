import { ref, shallowRef, computed } from 'vue'
import { directoryHasCapability } from './useModuleRegistry'
import { taskApi } from './useApi'
import type { Directory, Task, TaskColumn } from '@/types'

/**
 * Task type for the Task module
 */

/**
 * Task filter options
 */
export interface TaskFilter {
  status?: string[]
  priority?: string[]
  assignee?: string[]
  search?: string
}

/**
 * Task sort options
 */
export interface TaskSort {
  field: 'priority' | 'dueDate' | 'createdAt' | 'status'
  direction: 'asc' | 'desc'
}

/**
 * Composable for Task module operations on a directory
 */
export function useTaskModule(directory: Directory) {
  const tasks = shallowRef<Task[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const filter = ref<TaskFilter>({})
  const sort = ref<TaskSort>({ field: 'sortOrder', direction: 'asc' })

  // Check if directory has task capabilities
  const hasTaskCapability = computed(() => directoryHasCapability(directory, 'task.list'))

  // Get module config
  const moduleConfig = computed(
    () =>
      directory.moduleConfig as
        | {
            defaultStatus?: string
            statusValues?: Array<{ id: string; name: string; color: string }>
            priorityValues?: Array<{ id: string; name: string; color: string }>
          }
        | undefined
  )

  // Filtered and sorted tasks
  const filteredTasks = computed(() => {
    let result = [...tasks.value]

    // Apply filters
    if (filter.value.status?.length) {
      result = result.filter((t) => filter.value.status!.includes(t.status))
    }
    if (filter.value.priority?.length) {
      result = result.filter((t) => filter.value.priority!.includes(t.priority))
    }
    if (filter.value.assignee?.length) {
      result = result.filter((t) => t.assignee && filter.value.assignee!.includes(t.assignee))
    }
    if (filter.value.search) {
      const search = filter.value.search.toLowerCase()
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(search) || t.description?.toLowerCase().includes(search)
      )
    }

    // Apply sort (spread first to avoid mutating the original array)
    return [...result].sort((a, b) => {
      let comparison = 0
      switch (sort.value.field) {
        case 'sortOrder':
          comparison = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
          break
        case 'priority':
          comparison = a.priority.localeCompare(b.priority)
          break
        case 'dueDate':
          comparison = (a.dueDate || '').localeCompare(b.dueDate || '')
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'createdAt':
          comparison = a.createdAt.localeCompare(b.createdAt)
          break
        default:
          comparison = a.createdAt.localeCompare(b.createdAt)
      }
      return sort.value.direction === 'asc' ? comparison : -comparison
    })

    return result
  })

  // Available status values from config or defaults
  const statusValues = computed(
    () =>
      moduleConfig.value?.statusValues ?? [
        { id: 'todo', name: 'To Do', color: '#9CA3AF' },
        { id: 'in_progress', name: 'In Progress', color: '#3B82F6' },
        { id: 'done', name: 'Done', color: '#10B981' },
      ]
  )

  // Available priority values from config or defaults
  const priorityValues = computed(
    () =>
      moduleConfig.value?.priorityValues ?? [
        { id: 'low', name: 'Low', color: '#6B7280' },
        { id: 'medium', name: 'Medium', color: '#F59E0B' },
        { id: 'high', name: 'High', color: '#EF4444' },
        { id: 'urgent', name: 'Urgent', color: '#DC2626' },
      ]
  )

  // Load tasks for the directory
  async function loadTasks() {
    if (!hasTaskCapability.value) {
      error.value = 'Task module not enabled for this directory'
      return
    }

    loading.value = true
    error.value = null
    try {
      const allTasks = await taskApi.list(directory.id)
      tasks.value = allTasks
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load tasks'
    } finally {
      loading.value = false
    }
  }

  // Create a new task
  async function createTask(input: {
    title: string
    description?: string
    priority?: string
    assignee?: string
    dueDate?: string
    status?: string
  }): Promise<Task | null> {
    if (!hasTaskCapability.value) {
      error.value = 'Task module not enabled for this directory'
      return null
    }

    loading.value = true
    error.value = null
    try {
      const newTask = await taskApi.create(
        directory.id,
        input.title,
        input.description,
        input.priority,
        input.assignee,
        input.dueDate,
        input.status
      )
      tasks.value = [...tasks.value, newTask]
      return newTask
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create task'
      return null
    } finally {
      loading.value = false
    }
  }

  // Update an existing task
  async function updateTask(
    taskId: string,
    patch: Partial<
      Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'dueDate'>
    >
  ): Promise<Task | null> {
    if (!hasTaskCapability.value) {
      error.value = 'Task module not enabled for this directory'
      return null
    }

    saving.value = true
    error.value = null
    try {
      const updated = await taskApi.update(taskId, patch)
      const index = tasks.value.findIndex((t) => t.id === taskId)
      if (index !== -1) {
        tasks.value = tasks.value.map((t) => (t.id === taskId ? updated : t))
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update task'
      return null
    } finally {
      saving.value = false
    }
  }

  // Delete a task
  async function deleteTask(taskId: string): Promise<boolean> {
    if (!hasTaskCapability.value) {
      error.value = 'Task module not enabled for this directory'
      return false
    }

    saving.value = true
    error.value = null
    try {
      await taskApi.delete(taskId)
      const index = tasks.value.findIndex((t) => t.id === taskId)
      if (index !== -1) {
        tasks.value = tasks.value.filter((t) => t.id !== taskId)
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete task'
      return false
    } finally {
      saving.value = false
    }
  }

  // Set filter
  function setFilter(newFilter: TaskFilter) {
    filter.value = newFilter
  }

  // Set sort
  function setSort(newSort: TaskSort) {
    sort.value = newSort
  }

  // Clear filter
  function clearFilter() {
    filter.value = {}
  }

  // Reorder a task
  async function reorderTask(taskId: string, newStatus: string, newSortOrder: number): Promise<Task | null> {
    if (!hasTaskCapability.value) return null

    saving.value = true
    error.value = null
    try {
      const updated = await taskApi.reorder(taskId, newStatus, newSortOrder)
      const index = tasks.value.findIndex((t) => t.id === taskId)
      if (index !== -1) {
        tasks.value = tasks.value.map((t) => (t.id === taskId ? updated : t))
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to reorder task'
      return null
    } finally {
      saving.value = false
    }
  }

  // Subtask state: parentId -> child tasks
  const childTasksMap = ref<Record<string, Task[]>>({})

  // Load children for a parent task
  async function loadChildTasks(parentId: string) {
    try {
      const children = await taskApi.listChildren(parentId)
      childTasksMap.value[parentId] = children
    } catch (e) {
      console.error('Failed to load child tasks:', e)
    }
  }

  // Create a child task
  async function createChildTask(parentId: string, title: string): Promise<Task | null> {
    try {
      const child = await taskApi.createChild(parentId, title)
      if (!childTasksMap.value[parentId]) {
        childTasksMap.value[parentId] = []
      }
      childTasksMap.value[parentId].push(child)
      return child
    } catch (e) {
      console.error('Failed to create child task:', e)
      return null
    }
  }

  // Toggle child task completion
  async function toggleChildComplete(childId: string): Promise<Task | null> {
    try {
      const updated = await taskApi.toggleComplete(childId)
      // Find and update in map
      for (const parentId of Object.keys(childTasksMap.value)) {
        const children = childTasksMap.value[parentId]
        const idx = children.findIndex((c) => c.id === childId)
        if (idx !== -1) {
          children[idx] = updated
          childTasksMap.value[parentId] = [...children]
          break
        }
      }
      return updated
    } catch (e) {
      console.error('Failed to toggle child task:', e)
      return null
    }
  }

  // Delete a child task
  async function deleteChildTask(childId: string): Promise<boolean> {
    try {
      await taskApi.deleteChild(childId)
      // Find and remove from map
      for (const parentId of Object.keys(childTasksMap.value)) {
        const children = childTasksMap.value[parentId]
        const idx = children.findIndex((c) => c.id === childId)
        if (idx !== -1) {
          children.splice(idx, 1)
          childTasksMap.value[parentId] = [...children]
          break
        }
      }
      return true
    } catch (e) {
      console.error('Failed to delete child task:', e)
      return false
    }
  }

  // Helper: get child tasks for a parent
  function getChildTasks(parentId: string): Task[] {
    return childTasksMap.value[parentId] || []
  }

  // Helper: get child task counts
  function getChildCounts(parentId: string): { total: number; completed: number } {
    const children = childTasksMap.value[parentId] || []
    return {
      total: children.length,
      completed: children.filter((c) => c.isCompleted).length,
    }
  }

  // Column state
  const columns = ref<TaskColumn[]>([])
  const columnsLoading = ref(false)

  // Visible columns only (sorted by sortOrder)
  const visibleColumns = computed(() =>
    columns.value.filter((c) => c.isVisible).sort((a, b) => a.sortOrder - b.sortOrder)
  )

  // Load column configurations
  async function loadColumns() {
    columnsLoading.value = true
    try {
      const cols = await taskApi.listColumns(directory.id)
      columns.value = cols
    } catch (e) {
      console.error('Failed to load columns:', e)
    } finally {
      columnsLoading.value = false
    }
  }

  // Create a new column
  async function createColumn(statusKey: string, name: string, color: string): Promise<TaskColumn | null> {
    try {
      const col = await taskApi.createColumn(directory.id, statusKey, name, color)
      columns.value = [...columns.value, col]
      return col
    } catch (e) {
      console.error('Failed to create column:', e)
      return null
    }
  }

  // Update a column
  async function updateColumn(id: string, patch: Partial<Pick<TaskColumn, 'name' | 'color' | 'sortOrder'>>): Promise<TaskColumn | null> {
    try {
      const updated = await taskApi.updateColumn(id, patch)
      const idx = columns.value.findIndex((c) => c.id === id)
      if (idx !== -1) {
        columns.value[idx] = updated
      }
      return updated
    } catch (e) {
      console.error('Failed to update column:', e)
      return null
    }
  }

  // Toggle column visibility
  async function toggleColumnVisibility(id: string): Promise<TaskColumn | null> {
    try {
      const updated = await taskApi.toggleColumnVisibility(id)
      const idx = columns.value.findIndex((c) => c.id === id)
      if (idx !== -1) {
        columns.value[idx] = updated
      }
      return updated
    } catch (e) {
      console.error('Failed to toggle column visibility:', e)
      return null
    }
  }

  // Delete a column
  async function deleteColumn(id: string): Promise<boolean> {
    try {
      await taskApi.deleteColumn(id)
      columns.value = columns.value.filter((c) => c.id !== id)
      return true
    } catch (e) {
      console.error('Failed to delete column:', e)
      return false
    }
  }

  // Convert column to status value format for template compatibility (visible columns only)
  const columnStatusValues = computed(() =>
    columns.value.filter((c) => c.isVisible).map((c) => ({
      id: c.statusKey,
      name: c.name,
      color: c.color,
    }))
  )

  return {
    // State
    tasks: filteredTasks,
    allTasks: tasks,
    loading,
    saving,
    error,
    filter,
    sort,
    childTasksMap,
    columns,
    columnsLoading,

    // Computed
    hasTaskCapability,
    moduleConfig,
    statusValues: columnStatusValues,
    visibleColumns,
    priorityValues,

    // Actions
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    reorderTask,
    loadChildTasks,
    createChildTask,
    toggleChildComplete,
    deleteChildTask,
    getChildTasks,
    getChildCounts,
    setFilter,
    setSort,
    clearFilter,
    loadColumns,
    createColumn,
    updateColumn,
    toggleColumnVisibility,
    deleteColumn,
  }
}
