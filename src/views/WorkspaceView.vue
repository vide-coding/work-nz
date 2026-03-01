<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { open } from '@tauri-apps/plugin-dialog';
import { useLocale } from '../locales/useLocale';
import { workspaceApi } from '../composables/useApi';
import type { WorkspaceInfo, WorkspaceSettings } from '../types';
import SettingsBar from '../components/SettingsBar.vue';

const router = useRouter();
const { locale } = useLocale();

// State
const recentWorkspaces = ref<WorkspaceInfo[]>([]);
const currentWorkspace = ref<WorkspaceInfo | null>(null);
const loading = ref(false);
const error = ref('');
const settings = ref<WorkspaceSettings>({
  themeMode: 'system',
});

// Computed
const canEnter = computed(() => currentWorkspace.value !== null);

// Methods
async function loadRecentWorkspaces() {
  try {
    recentWorkspaces.value = await workspaceApi.listRecent();
  } catch (e) {
    console.error('Failed to load recent workspaces:', e);
  }
}

async function loadSettings() {
  try {
    settings.value = await workspaceApi.getSettings();
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

async function onUpdateTheme(themeMode: 'light' | 'dark' | 'system' | 'custom') {
  await updateTheme(themeMode);
}

async function selectFolder() {
  try {
    loading.value = true;
    error.value = '';
    const selected = await open({
      directory: true,
      multiple: false,
      title: locale.value === 'zh-CN' ? '选择工作区文件夹' : 'Select Workspace Folder',
    });

    if (selected) {
      currentWorkspace.value = await workspaceApi.initOrOpen(selected as string);
    }
  } catch (e: any) {
    error.value = e.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function createWorkspace() {
  try {
    loading.value = true;
    error.value = '';
    const selected = await open({
      directory: true,
      multiple: false,
      title:
        locale.value === 'zh-CN' ? '选择空目录创建工作区' : 'Select Empty Directory for Workspace',
    });

    if (selected) {
      currentWorkspace.value = await workspaceApi.initOrOpen(selected as string);
    }
  } catch (e: any) {
    error.value = e.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function openRecentWorkspace(workspace: WorkspaceInfo) {
  try {
    loading.value = true;
    error.value = '';
    currentWorkspace.value = await workspaceApi.initOrOpen(workspace.path);
  } catch (e: any) {
    error.value = e.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function updateTheme(themeMode: string) {
  try {
    settings.value = await workspaceApi.updateSettings({ themeMode: themeMode as any });
    applyTheme(settings.value.themeMode);
  } catch (e) {
    console.error('Failed to update theme:', e);
  }
}

function applyTheme(themeMode: string) {
  const root = document.documentElement;
  if (themeMode === 'dark') {
    root.classList.add('dark');
  } else if (themeMode === 'light') {
    root.classList.remove('dark');
  } else if (themeMode === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}

async function enter() {
  if (currentWorkspace.value) {
    router.push('/projects');
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Lifecycle
onMounted(async () => {
  await loadRecentWorkspaces();
  await loadSettings();
  applyTheme(settings.value.themeMode);
});
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
              class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
              @click="openRecentWorkspace(ws)"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {{ ws.path }}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ formatDate(ws.lastOpenedAt) }}
                </p>
              </div>
              <span
                class="px-3 py-1 text-xs bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded text-gray-600 dark:text-gray-300"
              >
                {{ $t('workspace.open') }}
              </span>
            </div>
          </div>
        </div>

        <!-- Select/Create Workspace -->
        <div class="flex gap-3 mb-6">
          <button
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors font-medium"
            @click="selectFolder"
            :disabled="loading"
          >
            {{ $t('workspace.selectFolder') }}
          </button>
          <button
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md transition-colors font-medium"
            @click="createWorkspace"
            :disabled="loading"
          >
            {{ $t('workspace.createNew') }}
          </button>
        </div>

        <!-- Selected Workspace Info -->
        <div
          v-if="currentWorkspace"
          class="mb-6 p-3 bg-green-50 dark:bg-green-900/20 rounded-md flex items-center gap-2"
        >
          <div class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
            <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="3"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <p class="text-sm text-green-800 dark:text-green-200">
            {{ $t('workspace.validWorkspace') }}
          </p>
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
    </div>
  </div>
</template>
