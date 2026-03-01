<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { open } from '@tauri-apps/plugin-dialog'
import { useLocale } from '../locales/useLocale'
import { workspaceApi } from '../composables/useApi'
import type { WorkspaceInfo, WorkspaceSettings } from '../types'
import SettingsBar from '../components/SettingsBar.vue'

const router = useRouter()
const { locale } = useLocale()

// State
const recentWorkspaces = ref<WorkspaceInfo[]>([])
const currentWorkspace = ref<WorkspaceInfo | null>(null)
const loading = ref(false)
const error = ref('')
const settings = ref<WorkspaceSettings>({
  themeMode: 'system',
})

// Menu state
const activeMenuPath = ref<string | null>(null)
const editingWorkspace = ref<WorkspaceInfo | null>(null)
const editAlias = ref('')
const showAliasDialog = ref(false)

// Computed
const canEnter = computed(() => currentWorkspace.value !== null)

// Methods
async function loadRecentWorkspaces() {
  try {
    recentWorkspaces.value = await workspaceApi.listRecent()
  } catch (error) {
    console.error('Failed to load recent workspaces:', error)
  }
}

async function loadSettings() {
  try {
    settings.value = await workspaceApi.getSettings()
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

async function onUpdateTheme(themeMode: 'light' | 'dark' | 'system' | 'custom') {
  await updateTheme(themeMode)
}

async function selectFolder() {
  try {
    loading.value = true
    error.value = ''
    const selected = await open({
      directory: true,
      multiple: false,
      title: locale.value === 'zh-CN' ? '选择工作区文件夹' : 'Select Workspace Folder',
    })

    if (selected) {
      currentWorkspace.value = await workspaceApi.initOrOpen(selected as string)
      // 刷新最近工作区列表
      await loadRecentWorkspaces()
    }
  } catch (error: any) {
    error.value = error.message || String(error)
  } finally {
    loading.value = false
  }
}

// 合并后的按钮功能（原 createWorkspace 功能已合并到 selectFolder）

async function openRecentWorkspace(workspace: WorkspaceInfo) {
  try {
    loading.value = true
    error.value = ''
    currentWorkspace.value = await workspaceApi.initOrOpen(workspace.path)
    // 刷新列表以获取最新状态
    await loadRecentWorkspaces()
  } catch (error: any) {
    error.value = error.message || String(error)
  } finally {
    loading.value = false
  }
}

async function updateTheme(themeMode: string) {
  try {
    settings.value = await workspaceApi.updateSettings({
      themeMode: themeMode as any,
    })
    applyTheme(settings.value.themeMode)
  } catch (error) {
    console.error('Failed to update theme:', error)
  }
}

function applyTheme(themeMode: string) {
  const root = document.documentElement
  if (themeMode === 'dark') {
    root.classList.add('dark')
  } else if (themeMode === 'light') {
    root.classList.remove('dark')
  } else if (themeMode === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}

async function enter() {
  if (currentWorkspace.value) {
    router.push('/projects')
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Menu and alias management
function toggleMenu(path: string, event: Event) {
  event.stopPropagation()
  activeMenuPath.value = activeMenuPath.value === path ? null : path
}

function closeMenu() {
  activeMenuPath.value = null
}

function startRename(workspace: WorkspaceInfo, event: Event) {
  event.stopPropagation()
  editingWorkspace.value = workspace
  editAlias.value = workspace.alias || ''
  showAliasDialog.value = true
  closeMenu()
}

async function saveAlias() {
  if (!editingWorkspace.value) return

  try {
    const alias = editAlias.value.trim() || undefined
    await workspaceApi.updateAlias(editingWorkspace.value.path, alias)
    // 刷新列表
    await loadRecentWorkspaces()
    // 如果当前选中的工作区被修改，也更新它
    if (currentWorkspace.value?.path === editingWorkspace.value?.path) {
      currentWorkspace.value = { ...currentWorkspace.value, alias }
    }
  } catch (err: any) {
    error.value = err.message || String(err)
  } finally {
    showAliasDialog.value = false
    editingWorkspace.value = null
    editAlias.value = ''
  }
}

function cancelAlias() {
  showAliasDialog.value = false
  editingWorkspace.value = null
  editAlias.value = ''
}

async function deleteWorkspace(workspace: WorkspaceInfo, event: Event) {
  event.stopPropagation()

  try {
    await workspaceApi.removeFromRecent(workspace.path)
    // 刷新列表
    await loadRecentWorkspaces()
    // 如果删除的是当前选中的工作区，清空当前选择
    if (currentWorkspace.value?.path === workspace.path) {
      currentWorkspace.value = null
    }
  } catch (err: any) {
    error.value = err.message || String(err)
  } finally {
    closeMenu()
  }
}

// Lifecycle
onMounted(async () => {
  await loadRecentWorkspaces()
  await loadSettings()
  applyTheme(settings.value.themeMode)

  // Close menu when clicking outside
  document.addEventListener('click', closeMenu)
})
</script>

<template>
  <div
    class="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-8 relative"
  >
    <!-- Settings Bar -->
    <SettingsBar
      :theme-mode="settings.themeMode"
      @update:theme="onUpdateTheme"
      class="absolute top-8 right-8"
    />

    <div class="w-full max-w-xl">
      <!-- Header -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ $t('app.title') }}
        </h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          {{ $t('workspace.description') }}
        </p>
      </div>

      <!-- Main Card -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
        <!-- Recent Workspaces -->
        <div v-if="recentWorkspaces.length > 0" class="mb-6">
          <h2 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            {{ $t('workspace.recentWorkspaces') }}
          </h2>
          <div class="space-y-2">
            <div
              v-for="ws in recentWorkspaces"
              :key="ws.path"
              class="relative flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
              :class="[
                currentWorkspace?.path === ws.path
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-500 dark:border-indigo-400'
                  : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent',
              ]"
              @click="openRecentWorkspace(ws)"
            >
              <div class="min-w-0 flex-1">
                <p
                  class="text-sm font-medium truncate"
                  :class="
                    currentWorkspace?.path === ws.path
                      ? 'text-indigo-900 dark:text-indigo-200'
                      : 'text-gray-900 dark:text-white'
                  "
                >
                  {{ ws.alias || ws.path }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ ws.alias ? ws.path : formatDate(ws.lastOpenedAt) }}
                </p>
              </div>

              <!-- Menu Button -->
              <div class="relative ml-2">
                <button
                  class="p-1.5 rounded-md transition-colors"
                  :class="
                    currentWorkspace?.path === ws.path
                      ? 'hover:bg-indigo-200 dark:hover:bg-indigo-800'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                  "
                  @click="toggleMenu(ws.path, $event)"
                >
                  <svg
                    class="w-4 h-4"
                    :class="
                      currentWorkspace?.path === ws.path
                        ? 'text-indigo-700 dark:text-indigo-300'
                        : 'text-gray-600 dark:text-gray-400'
                    "
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"
                    />
                  </svg>
                </button>

                <!-- Dropdown Menu -->
                <div
                  v-if="activeMenuPath === ws.path"
                  class="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-10"
                >
                  <button
                    class="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md"
                    @click="startRename(ws, $event)"
                  >
                    {{ $t('workspace.rename') }}
                  </button>
                  <button
                    class="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 last:rounded-b-md"
                    @click="deleteWorkspace(ws, $event)"
                  >
                    {{ $t('workspace.delete') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Select/Create Workspace -->
        <div class="flex gap-3 mb-6">
          <button
            class="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors font-medium"
            @click="selectFolder"
            :disabled="loading"
          >
            {{ $t('workspace.selectOrCreate') }}
          </button>
        </div>

        <!-- Error -->
        <div
          v-if="error"
          class="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
        >
          <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
        </div>

        <!-- Enter Button -->
        <button
          class="w-full flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          @click="enter"
          :disabled="!canEnter || loading"
        >
          {{ $t('workspace.enter') }}
        </button>
      </div>

      <!-- Alias Dialog -->
      <div
        v-if="showAliasDialog"
        class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        @click="cancelAlias"
      >
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96" @click.stop>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {{ $t('workspace.setAlias') }}
          </h3>
          <input
            v-model="editAlias"
            type="text"
            :placeholder="$t('workspace.aliasPlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            @keyup.enter="saveAlias"
          />
          <div class="flex justify-end gap-2 mt-4">
            <button
              class="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              @click="cancelAlias"
            >
              {{ $t('common.cancel') }}
            </button>
            <button
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
              @click="saveAlias"
            >
              {{ $t('common.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
