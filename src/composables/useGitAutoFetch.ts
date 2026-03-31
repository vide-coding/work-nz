import { ref, watch, onUnmounted } from 'vue'
import { gitApi, projectApi } from './useApi'
import { useSettings } from './useSettings'
import type { GitRepoStatus } from '@/types'

/**
 * Auto-fetch interval in milliseconds (5 minutes)
 */
const AUTO_FETCH_INTERVAL = 5 * 60 * 1000

/**
 * Composable for auto-fetching git repo statuses
 * Manages periodic status checks for all repos in a project
 */
export function useGitAutoFetch(projectId: string) {
  const { globalSettings, workspaceSettings } = useSettings()

  const isAutoFetchEnabled = ref(false)
  const isFetching = ref(false)
  const lastFetchAt = ref<string | null>(null)
  const repoStatuses = ref<Record<string, GitRepoStatus>>({})
  const error = ref<string | null>(null)

  let fetchIntervalId: ReturnType<typeof setInterval> | null = null

  // Check if auto-fetch is enabled in settings
  function checkAutoFetchEnabled(): boolean {
    // Workspace setting takes priority over global setting
    const workspaceSetting = workspaceSettings.value?.autoFetchGitProjects
    if (workspaceSetting !== undefined) {
      return workspaceSetting
    }
    // Fall back to global setting
    const globalSetting = globalSettings.value.autoFetchGitProjects
    if (globalSetting !== undefined) {
      return globalSetting
    }
    // Default to enabled if not set
    return true
  }

  // Fetch status for a single repo
  async function fetchRepoStatus(repoId: string): Promise<GitRepoStatus | null> {
    try {
      const status = await gitApi.repoStatusCheck(repoId)
      repoStatuses.value[repoId] = status
      return status
    } catch (e) {
      console.error(`Failed to fetch status for repo ${repoId}:`, e)
      return null
    }
  }

  // Fetch status for all repos in the project
  async function fetchAllRepoStatuses(): Promise<void> {
    if (!projectId || isFetching.value) return

    isFetching.value = true
    error.value = null

    try {
      // Get all repos for this project
      const repos = await gitApi.repoList(projectId)

      // Fetch status for each repo in parallel
      await Promise.all(repos.map((repo) => fetchRepoStatus(repo.id)))

      lastFetchAt.value = new Date().toISOString()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch repo statuses'
      console.error('Failed to fetch all repo statuses:', e)
    } finally {
      isFetching.value = false
    }
  }

  // Start auto-fetch timer
  function startAutoFetch(): void {
    if (fetchIntervalId) {
      clearInterval(fetchIntervalId)
    }

    if (!isAutoFetchEnabled.value) return

    fetchIntervalId = setInterval(() => {
      fetchAllRepoStatuses()
    }, AUTO_FETCH_INTERVAL)
  }

  // Stop auto-fetch timer
  function stopAutoFetch(): void {
    if (fetchIntervalId) {
      clearInterval(fetchIntervalId)
      fetchIntervalId = null
    }
  }

  // Watch for changes in auto-fetch setting
  watch(
    [globalSettings, workspaceSettings],
    () => {
      isAutoFetchEnabled.value = checkAutoFetchEnabled()
      if (isAutoFetchEnabled.value) {
        startAutoFetch()
      } else {
        stopAutoFetch()
      }
    },
    { immediate: true }
  )

  // Initial fetch
  fetchAllRepoStatuses()

  // Cleanup on unmount
  onUnmounted(() => {
    stopAutoFetch()
  })

  return {
    // State
    isAutoFetchEnabled,
    isFetching,
    lastFetchAt,
    repoStatuses,
    error,

    // Actions
    fetchAllRepoStatuses,
    fetchRepoStatus,
    startAutoFetch,
    stopAutoFetch,
  }
}
