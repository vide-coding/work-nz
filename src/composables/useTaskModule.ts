import { ref, computed } from 'vue'
import { directoryHasCapability } from './useModuleRegistry'
import type { Directory } from '@/types'

/**
 * Task type for the Task module
 */
export interface Task {
  id: string
  directoryId: string
  title: string
  description?: string
  status: string
  priority: string
  assignee?: string
  dueDate?: string
  createdAt: string
  updatedAt: string
}

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
  const tasks = ref<Task[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filter = ref<TaskFilter>({})
  const sort = ref<TaskSort>({ field: 'createdAt', direction: 'desc' })

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

    // Apply sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sort.value.field) {
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
      // TODO: Replace with actual API call when backend implements task endpoints
      // For now, simulate empty tasks
      tasks.value = []
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
  }): Promise<Task | null> {
    if (!hasTaskCapability.value) {
      error.value = 'Task module not enabled for this directory'
      return null
    }

    loading.value = true
    error.value = null
    try {
      // TODO: Replace with actual API call when backend implements task endpoints
      const newTask: Task = {
        id: `task-${Date.now()}`,
        directoryId: directory.id,
        title: input.title,
        description: input.description,
        status: moduleConfig.value?.defaultStatus || 'todo',
        priority: input.priority || 'medium',
        assignee: input.assignee,
        dueDate: input.dueDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      tasks.value.push(newTask)
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

    loading.value = true
    error.value = null
    try {
      const index = tasks.value.findIndex((t) => t.id === taskId)
      if (index === -1) {
        error.value = 'Task not found'
        return null
      }

      const updated: Task = {
        ...tasks.value[index],
        ...patch,
        updatedAt: new Date().toISOString(),
      }
      tasks.value[index] = updated
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update task'
      return null
    } finally {
      loading.value = false
    }
  }

  // Delete a task
  async function deleteTask(taskId: string): Promise<boolean> {
    if (!hasTaskCapability.value) {
      error.value = 'Task module not enabled for this directory'
      return false
    }

    loading.value = true
    error.value = null
    try {
      const index = tasks.value.findIndex((t) => t.id === taskId)
      if (index === -1) {
        error.value = 'Task not found'
        return false
      }

      tasks.value.splice(index, 1)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete task'
      return false
    } finally {
      loading.value = false
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

  return {
    // State
    tasks: filteredTasks,
    allTasks: tasks,
    loading,
    error,
    filter,
    sort,

    // Computed
    hasTaskCapability,
    moduleConfig,
    statusValues,
    priorityValues,

    // Actions
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    setFilter,
    setSort,
    clearFilter,
  }
}
