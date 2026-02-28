<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { open } from "@tauri-apps/plugin-dialog";
import { useLocale } from "../locales/useLocale";
import { workspaceApi, ideApi } from "../composables/useApi";
import type { WorkspaceInfo, WorkspaceSettings, IdeConfig } from "../types";
import {
  FolderOpen,
  Plus,
  Moon,
  Sun,
  Monitor,
  Palette,
  ChevronRight,
} from "lucide-vue-next";

const router = useRouter();
const { locale, changeLocale } = useLocale();

// State
const recentWorkspaces = ref<WorkspaceInfo[]>([]);
const currentWorkspace = ref<WorkspaceInfo | null>(null);
const loading = ref(false);
const error = ref("");
const settings = ref<WorkspaceSettings>({
  themeMode: "system",
});
const supportedIdes = ref<IdeConfig[]>([]);
const selectedIde = ref<string>("vscode");

// Computed
const canEnter = computed(() => currentWorkspace.value !== null);

// Methods
async function loadRecentWorkspaces() {
  try {
    recentWorkspaces.value = await workspaceApi.listRecent();
  } catch (e) {
    console.error("Failed to load recent workspaces:", e);
  }
}

async function loadSettings() {
  try {
    settings.value = await workspaceApi.getSettings();
    if (settings.value.defaultIde) {
      selectedIde.value = settings.value.defaultIde.kind;
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
}

async function loadSupportedIdes() {
  try {
    supportedIdes.value = await ideApi.listSupported();
  } catch (e) {
    console.error("Failed to load supported IDEs:", e);
  }
}

async function selectFolder() {
  try {
    loading.value = true;
    error.value = "";
    const selected = await open({
      directory: true,
      multiple: false,
      title: locale.value === "zh-CN" ? "选择工作区文件夹" : "Select Workspace Folder",
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
    error.value = "";
    const selected = await open({
      directory: true,
      multiple: false,
      title: locale.value === "zh-CN" ? "选择空目录创建工作区" : "Select Empty Directory for Workspace",
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
    error.value = "";
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
    console.error("Failed to update theme:", e);
  }
}

function applyTheme(themeMode: string) {
  const root = document.documentElement;
  if (themeMode === "dark") {
    root.classList.add("dark");
  } else if (themeMode === "light") {
    root.classList.remove("dark");
  } else if (themeMode === "system") {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

async function updateIde(kind: string) {
  try {
    const ide = supportedIdes.value.find((i) => i.kind === kind);
    if (ide) {
      settings.value = await workspaceApi.updateSettings({
        defaultIde: ide,
      });
    }
  } catch (e) {
    console.error("Failed to update IDE:", e);
  }
}

async function enter() {
  if (currentWorkspace.value) {
    router.push("/projects");
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale.value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Lifecycle
onMounted(async () => {
  await loadRecentWorkspaces();
  await loadSettings();
  await loadSupportedIdes();
  applyTheme(settings.value.themeMode);
});
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
    <div class="w-full max-w-2xl">
      <!-- Header -->
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {{ $t("app.title") }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          {{ $t("workspace.description") }}
        </p>
      </div>

      <!-- Main Card -->
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <!-- Recent Workspaces -->
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {{ $t("workspace.recentWorkspaces") }}
          </h2>

          <div v-if="recentWorkspaces.length > 0" class="space-y-2">
            <div
              v-for="ws in recentWorkspaces"
              :key="ws.path"
              class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
              @click="openRecentWorkspace(ws)"
            >
              <div class="flex items-center gap-3">
                <FolderOpen class="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {{ ws.path }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    {{ formatDate(ws.lastOpenedAt) }}
                  </p>
                </div>
              </div>
              <ChevronRight class="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
            {{ $t("workspace.noRecentWorkspaces") }}
          </div>
        </div>

        <!-- Select/Create Workspace -->
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex gap-4">
            <button
              class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
              @click="selectFolder"
              :disabled="loading"
            >
              <FolderOpen class="w-5 h-5" />
              {{ $t("workspace.selectFolder") }}
            </button>
            <button
              class="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors font-medium"
              @click="createWorkspace"
              :disabled="loading"
            >
              <Plus class="w-5 h-5" />
              {{ $t("workspace.createNew") }}
            </button>
          </div>

          <!-- Selected Workspace Info -->
          <div v-if="currentWorkspace" class="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p class="text-sm text-green-800 dark:text-green-200">
              <strong>{{ $t("workspace.selected") }}:</strong> {{ currentWorkspace.path }}
            </p>
            <p class="text-xs text-green-600 dark:text-green-400 mt-1">
              {{ $t("workspace.dbPath") }}: {{ currentWorkspace.dbPath }}
            </p>
          </div>

          <!-- Error -->
          <div v-if="error" class="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-800 dark:text-red-200">{{ error }}</p>
          </div>
        </div>

        <!-- Settings -->
        <div class="p-6 space-y-6">
          <!-- Theme -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {{ $t("workspace.appearance") }}
            </h3>
            <div class="flex gap-2">
              <button
                class="flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors"
                :class="settings.themeMode === 'light' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'"
                @click="updateTheme('light')"
              >
                <Sun class="w-5 h-5" />
                <span class="text-xs">{{ $t("workspace.themeLight") }}</span>
              </button>
              <button
                class="flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors"
                :class="settings.themeMode === 'dark' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'"
                @click="updateTheme('dark')"
              >
                <Moon class="w-5 h-5" />
                <span class="text-xs">{{ $t("workspace.themeDark") }}</span>
              </button>
              <button
                class="flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors"
                :class="settings.themeMode === 'system' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'"
                @click="updateTheme('system')"
              >
                <Monitor class="w-5 h-5" />
                <span class="text-xs">{{ $t("workspace.themeSystem") }}</span>
              </button>
              <button
                class="flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors"
                :class="settings.themeMode === 'custom' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'"
                @click="updateTheme('custom')"
              >
                <Palette class="w-5 h-5" />
                <span class="text-xs">{{ $t("workspace.themeCustom") }}</span>
              </button>
            </div>
          </div>

          <!-- Default IDE -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {{ $t("workspace.defaultIde") }}
            </h3>
            <select
              v-model="selectedIde"
              class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              @change="updateIde(selectedIde)"
            >
              <option value="vscode">VS Code</option>
              <option value="jetbrains">JetBrains</option>
              <option value="visual_studio">Visual Studio</option>
              <option value="custom">{{ $t("workspace.customIde") }}</option>
            </select>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {{ $t("workspace.ideHint") }}
            </p>
          </div>

          <!-- Language -->
          <div>
            <h3 class="text-sm font-medium text-gray-900 dark:text-white mb-3">
              {{ $t("workspace.language") }}
            </h3>
            <div class="flex gap-2">
              <button
                class="px-4 py-2 rounded-lg border transition-colors"
                :class="
                  locale === 'zh-CN'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                "
                @click="changeLocale('zh-CN')"
              >
                {{ $t("app.langZh") }}
              </button>
              <button
                class="px-4 py-2 rounded-lg border transition-colors"
                :class="
                  locale === 'en-US'
                    ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                "
                @click="changeLocale('en-US')"
              >
                {{ $t("app.langEn") }}
              </button>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="p-6 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center">
          <button
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            @click="() => {}"
          >
            {{ $t("workspace.exit") }}
          </button>
          <button
            class="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            @click="enter"
            :disabled="!canEnter || loading"
          >
            {{ $t("workspace.enter") }}
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
