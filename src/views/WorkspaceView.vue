<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { open } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useLocale } from '../locales/useLocale'
import { workspaceApi } from '../composables/useApi'
import type { WorkspaceInfo, WorkspaceSettings } from '../types'
import WorkspaceItem from '../components/workspace/WorkspaceItem.vue'
import WorkspaceAliasDialog from '../components/workspace/WorkspaceAliasDialog.vue'
import ThemeToggle from '../components/common/ThemeToggle.vue'
import LanguageSelector from '../components/common/LanguageSelector.vue'

const router = useRouter()
const { locale, changeLocale } = useLocale()

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
const showAliasDialog = ref(false)

// Computed
const canEnter = computed(() => currentWorkspace.value !== null)

const workspaceDisplayName = computed(() => {
  if (!currentWorkspace.value) return null
  return (
    currentWorkspace.value.alias ||
    currentWorkspace.value.path.split(/[\\/]/).pop() ||
    currentWorkspace.value.path
  )
})

// Update window title
async function updateWindowTitle(title: string | null) {
  try {
    const window = getCurrentWindow()
    await window.setTitle(title || 'Vibe Kanban')
  } catch (e) {
    console.error('Failed to update window title:', e)
  }
}

watch(
  currentWorkspace,
  (ws) => {
    updateWindowTitle(ws ? workspaceDisplayName.value : null)
  },
  { immediate: true }
)

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

async function onUpdateTheme(themeMode: 'light' | 'dark' | 'system') {
  await updateTheme(themeMode)
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
      await loadRecentWorkspaces()
    }
  } catch (error: any) {
    error.value = error.message || String(error)
  } finally {
    loading.value = false
  }
}

async function openRecentWorkspace(workspace: WorkspaceInfo) {
  try {
    loading.value = true
    error.value = ''
    currentWorkspace.value = await workspaceApi.initOrOpen(workspace.path)
    await loadRecentWorkspaces()
  } catch (error: any) {
    error.value = error.message || String(error)
  } finally {
    loading.value = false
  }
}

async function enter() {
  if (currentWorkspace.value) {
    router.push('/projects')
  }
}

// Menu management
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
  showAliasDialog.value = true
  closeMenu()
}

async function saveAlias(alias: string | undefined) {
  if (!editingWorkspace.value) return

  try {
    await workspaceApi.updateAlias(editingWorkspace.value.path, alias)
    await loadRecentWorkspaces()
    if (currentWorkspace.value?.path === editingWorkspace.value?.path) {
      currentWorkspace.value = { ...currentWorkspace.value, alias }
    }
  } catch (err: any) {
    error.value = err.message || String(err)
  } finally {
    editingWorkspace.value = null
  }
}

async function deleteWorkspace(workspace: WorkspaceInfo, event: Event) {
  event.stopPropagation()

  try {
    await workspaceApi.removeFromRecent(workspace.path)
    await loadRecentWorkspaces()
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
  document.addEventListener('click', closeMenu)
})
</script>

<template>
  <div
    class="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-8 relative"
  >
    <!-- Settings Bar -->
    <div class="absolute top-8 right-8 flex items-center gap-2">
      <ThemeToggle
        :model-value="settings.themeMode"
        @update:model-value="onUpdateTheme"
      />
      <LanguageSelector
        :model-value="locale"
        @update:model-value="changeLocale"
      />
    </div>

    <div class="w-full max-w-xl">
      <!-- Header -->
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {{ currentWorkspace ? workspaceDisplayName : $t('app.title') }}
        </h1>
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          {{ currentWorkspace ? currentWorkspace.path : $t('workspace.description') }}
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
            <WorkspaceItem
              v-for="ws in recentWorkspaces"
              :key="ws.path"
              :workspace="ws"
              :selected="currentWorkspace?.path === ws.path"
              :active-menu="activeMenuPath"
              @select="openRecentWorkspace(ws)"
              @toggle-menu="toggleMenu(ws.path, $event)"
              @rename="startRename(ws, $event)"
              @delete="deleteWorkspace(ws, $event)"
            />
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
      <WorkspaceAliasDialog
        v-model="showAliasDialog"
        :workspace="editingWorkspace"
        @save="saveAlias"
      />
    </div>
  </div>
</template>
