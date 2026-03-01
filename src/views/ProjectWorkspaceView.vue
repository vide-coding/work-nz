<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useLocale } from "../locales/useLocale";
import {
  projectApi,
  gitApi,
  fsApi,
  dirTypeApi,
  ideApi,
  workspaceApi,
  previewApi,
} from "../composables/useApi";
import type {
  Project,
  GitRepository,
  GitRepoStatus,
  FileNode,
  DirectoryType,
  ProjectDirectory,
  WorkspaceSettings,
  PreviewKind,
} from "../types";
import {
  ArrowLeft,
  Home,
  Code,
  FileText,
  Image,
  Map,
  Folder,
  GitBranch,
  ExternalLink,
  Trash2,
  ChevronRight,
  Grid,
  List,
  FolderPlus,
  Loader2,
  Edit3,
  Save,
  File,
  Image as ImageIcon,
  FileCode,
} from "lucide-vue-next";

const props = defineProps<{
  id: string;
}>();

const router = useRouter();
const route = useRoute();
const { locale, changeLocale } = useLocale();

// Navigation
type NavItem =
  | "intro"
  | "code"
  | "docs"
  | "ui_design"
  | "project_planning"
  | string;
const currentNav = ref<NavItem>("intro");

// State
const project = ref<Project | null>(null);
const settings = ref<WorkspaceSettings>({ themeMode: "system" });
const loading = ref(false);
const error = ref("");
const isEditing = ref(false);
const editDescription = ref("");

// Git repos
const repos = ref<GitRepository[]>([]);
const repoStatuses = ref<Record<string, GitRepoStatus>>({});
const showCloneDialog = ref(false);
const isCloning = ref(false);
const cloneUrl = ref("");
const cloneTargetDir = ref("");

// Directory types
const dirTypes = ref<DirectoryType[]>([]);
const projectDirs = ref<ProjectDirectory[]>([]);

// File browser
const currentDirPath = ref("");
const fileTree = ref<FileNode[]>([]);
const viewMode = ref<"grid" | "list">("grid");
const selectedFile = ref<FileNode | null>(null);
const fileContent = ref("");
const previewKind = ref<PreviewKind | null>(null);
const isLoadingTree = ref(false);
const isLoadingPreview = ref(false);

// Create folder dialog
const isCreatingFolder = ref(false);
const newFolderName = ref("");

// Initialize project ID from props
const projectId = computed(() => props.id || (route.params.id as string));

// Navigation items
const navItems = computed(() => {
  const items = [
    { id: "intro", labelKey: "workspace.projectIntro", icon: Home },
    { id: "code", labelKey: "workspace.code", icon: Code },
    { id: "docs", labelKey: "workspace.docs", icon: FileText },
    { id: "ui_design", labelKey: "workspace.uiDesign", icon: Image },
    {
      id: "project_planning",
      labelKey: "workspace.projectPlanning",
      icon: Map,
    },
  ];

  // Add custom directory types
  const customTypes = dirTypes.value.filter((t) => t.kind === "custom");
  customTypes.forEach((t) => {
    items.push({ id: t.id, labelKey: t.name, icon: Folder });
  });

  return items;
});

// Computed
const currentDirType = computed(() => {
  return dirTypes.value.find(
    (t) => t.id === currentNav.value || t.kind === currentNav.value,
  );
});

const boundDirs = computed(() => {
  return projectDirs.value.filter((pd) => {
    const dt = dirTypes.value.find((d) => d.id === pd.dirTypeId);
    return dt && (dt.kind === currentNav.value || dt.id === currentNav.value);
  });
});

// Methods
async function loadProject() {
  try {
    loading.value = true;
    error.value = "";
    project.value = await projectApi.get(projectId.value);
    editDescription.value = project.value.description || "";
  } catch (e: any) {
    error.value = e.message || String(e);
  } finally {
    loading.value = false;
  }
}

async function loadSettings() {
  try {
    settings.value = await workspaceApi.getSettings();
    applyTheme(settings.value.themeMode);
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
}

async function loadDirTypes() {
  try {
    dirTypes.value = await dirTypeApi.list();
  } catch (e) {
    console.error("Failed to load directory types:", e);
  }
}

async function loadProjectDirs() {
  try {
    projectDirs.value = await dirTypeApi.listProjectDirs(projectId.value);
  } catch (e) {
    console.error("Failed to load project directories:", e);
  }
}

async function loadRepos() {
  try {
    repos.value = await gitApi.repoList(projectId.value);
    // Load status for each repo
    const statuses: Record<string, GitRepoStatus> = {};
    for (const repo of repos.value) {
      try {
        const status = await gitApi.repoStatusGet(repo.id);
        statuses[repo.id] = status;
      } catch (e) {
        console.error("Failed to get repo status:", e);
      }
    }
    repoStatuses.value = statuses;
  } catch (e) {
    console.error("Failed to load repos:", e);
  }
}

async function cloneRepo() {
  if (!cloneUrl.value.trim() || !cloneTargetDir.value.trim()) return;

  try {
    isCloning.value = true;
    error.value = "";
    const repo = await gitApi.repoClone(projectId.value, {
      remoteUrl: cloneUrl.value.trim(),
      targetDirName: cloneTargetDir.value.trim(),
    });
    repos.value.push(repo);
    cloneUrl.value = "";
    cloneTargetDir.value = "";
  } catch (e: any) {
    error.value = e.message || String(e);
  } finally {
    isCloning.value = false;
  }
}

async function pullRepo(repo: GitRepository) {
  try {
    const result = await gitApi.repoPull(repo.id);
    if (result.ok) {
      await loadRepos();
    } else {
      error.value = result.message || "Pull failed";
    }
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

async function openInIde(repo: GitRepository) {
  try {
    await ideApi.openRepo(
      repo.id,
      project.value?.ideOverride || settings.value.defaultIde,
    );
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

async function deleteRepo(_repo: GitRepository) {
  if (
    !confirm(
      locale.value === "zh-CN"
        ? "确定删除此仓库吗？"
        : "Are you sure you want to delete this repository?",
    )
  ) {
    return;
  }

  try {
    // Note: Backend should have a delete repo method
    await loadRepos();
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

async function updateProject() {
  if (!project.value) return;

  try {
    await projectApi.update(projectId.value, {
      description: editDescription.value,
    });
    project.value.description = editDescription.value;
    isEditing.value = false;
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

async function bindDirectory() {
  try {
    if (!currentDirType.value) return;

    const dirPath = currentDirType.value.kind + "s";
    await dirTypeApi.createOrUpdateProjectDir(projectId.value, {
      dirTypeId: currentDirType.value.id,
      relativePath: dirPath,
    });
    await loadProjectDirs();
    await loadFileTree(dirPath);
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

async function loadFileTree(relativePath: string) {
  try {
    isLoadingTree.value = true;
    currentDirPath.value = relativePath;
    const tree = await fsApi.tree(projectId.value, relativePath);
    fileTree.value = tree.children || [];
    selectedFile.value = null;
    fileContent.value = "";
  } catch (e: any) {
    // Directory might not exist yet
    fileTree.value = [];
    currentDirPath.value = relativePath;
  } finally {
    isLoadingTree.value = false;
  }
}

async function selectFile(node: FileNode) {
  if (node.kind === "dir") {
    await loadFileTree(currentDirPath.value + "/" + node.name);
    return;
  }

  selectedFile.value = node;
  isLoadingPreview.value = true;

  try {
    // Detect preview kind
    const fullPath = currentDirPath.value + "/" + node.name;
    const detected = await previewApi.detect(fullPath);
    previewKind.value = detected.kind;

    // Load content if text/markdown
    if (detected.kind === "text" || detected.kind === "markdown") {
      const result = await fsApi.readText(fullPath);
      fileContent.value = result.content;
    } else {
      fileContent.value = "";
    }
  } catch (e) {
    console.error("Failed to load file preview:", e);
    fileContent.value = "";
    previewKind.value = null;
  } finally {
    isLoadingPreview.value = false;
  }
}

async function createFolder() {
  if (!newFolderName.value.trim()) return;

  try {
    const fullPath = currentDirPath.value + "/" + newFolderName.value.trim();
    await fsApi.createDir(fullPath);
    await loadFileTree(currentDirPath.value);
    newFolderName.value = "";
    isCreatingFolder.value = false;
  } catch (e: any) {
    error.value = e.message || String(e);
  }
}

function navigateToParent() {
  const parts = currentDirPath.value.split("/");
  if (parts.length > 1) {
    parts.pop();
    loadFileTree(parts.join("/"));
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

async function updateTheme(themeMode: "light" | "dark" | "system" | "custom") {
  try {
    settings.value = await workspaceApi.updateSettings({ themeMode });
    applyTheme(themeMode);
  } catch (e) {
    console.error("Failed to update theme:", e);
  }
}

function getFileIcon(node: FileNode) {
  if (node.kind === "dir") return Folder;
  const ext = node.name.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "svg", "webp"].includes(ext || ""))
    return ImageIcon;
  if (
    ["md", "txt", "json", "js", "ts", "vue", "css", "html"].includes(ext || "")
  )
    return FileCode;
  return File;
}

// Watch navigation changes
watch(currentNav, async (newNav) => {
  if (newNav === "intro") {
    await loadProject();
  } else if (newNav === "code") {
    await loadRepos();
  } else {
    // Resource directory
    const dt = dirTypes.value.find((t) => t.id === newNav || t.kind === newNav);
    if (dt) {
      const pd = projectDirs.value.find((p) => p.dirTypeId === dt.id);
      if (pd) {
        await loadFileTree(pd.relativePath);
      }
    }
  }
});

// Lifecycle
onMounted(async () => {
  await loadSettings();
  await loadProject();
  await loadDirTypes();
  await loadProjectDirs();
  await loadRepos();
});
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
    <!-- Top Bar -->
    <header
      class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3"
    >
      <div class="flex items-center justify-between">
        <!-- Breadcrumb -->
        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            @click="router.push('/projects')"
          >
            <ArrowLeft class="w-4 h-4" />
            {{ $t("projects.title") }}
          </button>
          <ChevronRight class="w-4 h-4 text-gray-400" />
          <span class="text-sm font-medium text-gray-900 dark:text-white">
            {{ project?.name || $t("workspace.projectWorkspace") }}
          </span>
        </div>

        <!-- Right Actions -->
        <div class="flex items-center gap-3">
          <!-- Theme -->
          <div
            class="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1"
          >
            <button
              class="p-1.5 rounded-md transition-colors"
              :class="
                settings.themeMode === 'light'
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              "
              @click="updateTheme('light')"
            >
              <svg
                class="w-4 h-4 text-gray-600 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </button>
            <button
              class="p-1.5 rounded-md transition-colors"
              :class="
                settings.themeMode === 'dark'
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              "
              @click="updateTheme('dark')"
            >
              <svg
                class="w-4 h-4 text-gray-600 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            </button>
            <button
              class="p-1.5 rounded-md transition-colors"
              :class="
                settings.themeMode === 'system'
                  ? 'bg-white dark:bg-gray-600 shadow-sm'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-600'
              "
              @click="updateTheme('system')"
            >
              <svg
                class="w-4 h-4 text-gray-600 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </button>
          </div>

          <!-- Language -->
          <select
            v-model="locale"
            class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-300"
            @change="changeLocale(locale as 'zh-CN' | 'en-US')"
          >
            <option value="zh-CN">中文</option>
            <option value="en-US">EN</option>
          </select>

          <!-- Open in IDE -->
          <button
            class="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
            @click="() => {}"
          >
            <ExternalLink class="w-4 h-4" />
            {{ $t("workspace.openInIde") }}
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sidebar -->
      <aside
        class="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-auto"
      >
        <nav class="p-4 space-y-1">
          <button
            v-for="item in navItems"
            :key="item.id"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left"
            :class="
              currentNav === item.id
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            "
            @click="currentNav = item.id"
          >
            <component :is="item.icon" class="w-5 h-5" />
            <span class="text-sm font-medium">{{ $t(item.labelKey) }}</span>
          </button>
        </nav>
      </aside>

      <!-- Content Area -->
      <main class="flex-1 overflow-auto">
        <!-- Project Introduction -->
        <div v-if="currentNav === 'intro'" class="p-6">
          <div class="max-w-4xl mx-auto">
            <!-- Header -->
            <div class="flex items-start justify-between mb-6">
              <div class="flex items-center gap-4">
                <div
                  class="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold"
                  :style="{
                    backgroundColor: project?.display?.themeColor || '#4F46E5',
                  }"
                >
                  {{ project?.name?.charAt(0).toUpperCase() }}
                </div>
                <div>
                  <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                    {{ project?.name }}
                  </h1>
                  <p
                    v-if="!isEditing"
                    class="text-gray-600 dark:text-gray-400 mt-1"
                  >
                    {{ project?.description || $t("projects.noDescription") }}
                  </p>
                </div>
              </div>

              <button
                v-if="!isEditing"
                class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                @click="isEditing = true"
              >
                <Edit3 class="w-4 h-4" />
                {{ $t("common.edit") }}
              </button>
            </div>

            <!-- Edit Mode -->
            <div
              v-if="isEditing"
              class="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <textarea
                v-model="editDescription"
                rows="4"
                class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 resize-none"
                :placeholder="$t('projects.descriptionPlaceholder')"
              ></textarea>
              <div class="flex justify-end gap-2 mt-3">
                <button
                  class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  @click="isEditing = false"
                >
                  {{ $t("common.cancel") }}
                </button>
                <button
                  class="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  @click="updateProject"
                >
                  <Save class="w-4 h-4" />
                  {{ $t("common.save") }}
                </button>
              </div>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-3 gap-4">
              <!-- Code Stats -->
              <div
                class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
              >
                <div class="flex items-center gap-3 mb-4">
                  <div class="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Code class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span class="font-medium text-gray-900 dark:text-white">{{
                    $t("workspace.codeOverview")
                  }}</span>
                </div>
                <p class="text-3xl font-bold text-gray-900 dark:text-white">
                  {{ repos.length }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t("workspace.repositories") }}
                </p>
              </div>

              <!-- Docs Stats -->
              <div
                class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
              >
                <div class="flex items-center gap-3 mb-4">
                  <div class="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <FileText
                      class="w-5 h-5 text-green-600 dark:text-green-400"
                    />
                  </div>
                  <span class="font-medium text-gray-900 dark:text-white">{{
                    $t("workspace.docsOverview")
                  }}</span>
                </div>
                <p class="text-3xl font-bold text-gray-900 dark:text-white">
                  {{
                    projectDirs.filter((pd) =>
                      dirTypes.find(
                        (d) => d.id === pd.dirTypeId && d.kind === "docs",
                      ),
                    ).length
                  }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t("workspace.directories") }}
                </p>
              </div>

              <!-- UI Design Stats -->
              <div
                class="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
              >
                <div class="flex items-center gap-3 mb-4">
                  <div
                    class="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg"
                  >
                    <Image
                      class="w-5 h-5 text-purple-600 dark:text-purple-400"
                    />
                  </div>
                  <span class="font-medium text-gray-900 dark:text-white">{{
                    $t("workspace.designOverview")
                  }}</span>
                </div>
                <p class="text-3xl font-bold text-gray-900 dark:text-white">
                  {{
                    projectDirs.filter((pd) =>
                      dirTypes.find(
                        (d) => d.id === pd.dirTypeId && d.kind === "ui_design",
                      ),
                    ).length
                  }}
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t("workspace.directories") }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Code Management -->
        <div v-else-if="currentNav === 'code'" class="p-6">
          <div class="max-w-4xl mx-auto">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-xl font-bold text-gray-900 dark:text-white">
                {{ $t("workspace.codeRepositories") }}
              </h2>
              <button
                class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                @click="showCloneDialog = true"
              >
                <GitBranch class="w-4 h-4" />
                {{ $t("workspace.cloneNewRepo") }}
              </button>
            </div>

            <!-- Repo List -->
            <div
              v-if="repos.length === 0"
              class="text-center py-12 text-gray-500 dark:text-gray-400"
            >
              <GitBranch class="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{{ $t("workspace.noRepos") }}</p>
              <p class="text-sm mt-2">{{ $t("workspace.noReposHint") }}</p>
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="repo in repos"
                :key="repo.id"
                class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
              >
                <div class="flex items-start justify-between">
                  <div class="flex items-start gap-3">
                    <div class="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                      <GitBranch
                        class="w-5 h-5 text-gray-600 dark:text-gray-400"
                      />
                    </div>
                    <div>
                      <h3 class="font-medium text-gray-900 dark:text-white">
                        {{ repo.name }}
                      </h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400">
                        {{ repo.path }}
                      </p>
                      <div class="flex items-center gap-3 mt-2">
                        <span
                          v-if="repo.branch"
                          class="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
                        >
                          {{ repo.branch }}
                        </span>
                        <span
                          v-if="repoStatuses[repo.id]?.dirty"
                          class="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded"
                        >
                          {{ $t("workspace.dirty") }}
                        </span>
                        <span
                          v-if="(repoStatuses[repo.id]?.behind || 0) > 0"
                          class="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded"
                        >
                          {{
                            $t("workspace.behind", {
                              n: repoStatuses[repo.id]?.behind,
                            })
                          }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      @click="pullRepo(repo)"
                      :title="$t('workspace.pull')"
                    >
                      <GitPull class="w-4 h-4" />
                    </button>
                    <button
                      class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      @click="openInIde(repo)"
                      :title="$t('workspace.openInIde')"
                    >
                      <ExternalLink class="w-4 h-4" />
                    </button>
                    <button
                      class="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      @click="deleteRepo(repo)"
                      :title="$t('common.delete')"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Clone Dialog -->
          <div
            v-if="showCloneDialog"
            class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            @click.self="showCloneDialog = false"
          >
            <div
              class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md mx-4"
            >
              <div class="p-6">
                <h3
                  class="text-lg font-bold text-gray-900 dark:text-white mb-4"
                >
                  {{ $t("workspace.cloneRepo") }}
                </h3>

                <div class="space-y-4">
                  <div>
                    <label
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {{ $t("workspace.repoUrl") }}
                    </label>
                    <input
                      v-model="cloneUrl"
                      type="text"
                      class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://github.com/..."
                    />
                  </div>

                  <div>
                    <label
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      {{ $t("workspace.targetDir") }}
                    </label>
                    <input
                      v-model="cloneTargetDir"
                      type="text"
                      class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                      placeholder="my-repo"
                    />
                  </div>

                  <div
                    v-if="error"
                    class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                  >
                    <p class="text-sm text-red-600 dark:text-red-400">
                      {{ error }}
                    </p>
                  </div>
                </div>
              </div>

              <div
                class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-xl"
              >
                <button
                  class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  @click="showCloneDialog = false"
                >
                  {{ $t("common.cancel") }}
                </button>
                <button
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  @click="cloneRepo"
                  :disabled="
                    !cloneUrl.trim() || !cloneTargetDir.trim() || isCloning
                  "
                >
                  {{ isCloning ? $t("common.cloning") : $t("workspace.clone") }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Resource Directory (Docs, UI Design, Project Planning) -->
        <div v-else class="flex flex-col h-full">
          <!-- Toolbar -->
          <div
            class="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"
          >
            <div class="flex items-center gap-4">
              <!-- Bind directory if not bound -->
              <button
                v-if="boundDirs.length === 0"
                class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                @click="bindDirectory"
              >
                <FolderPlus class="w-4 h-4" />
                {{ $t("workspace.bindDirectory") }}
              </button>

              <!-- Current path -->
              <div v-if="currentDirPath" class="flex items-center gap-2">
                <button
                  class="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  @click="navigateToParent"
                >
                  <ArrowLeft class="w-4 h-4 text-gray-500" />
                </button>
                <span class="text-sm text-gray-600 dark:text-gray-400">{{
                  currentDirPath
                }}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                @click="isCreatingFolder = true"
                :title="$t('workspace.newFolder')"
              >
                <FolderPlus class="w-5 h-5" />
              </button>
              <div
                class="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1"
              >
                <button
                  class="p-1.5 rounded-md transition-colors"
                  :class="
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-gray-600 shadow-sm'
                      : ''
                  "
                  @click="viewMode = 'grid'"
                >
                  <Grid class="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
                <button
                  class="p-1.5 rounded-md transition-colors"
                  :class="
                    viewMode === 'list'
                      ? 'bg-white dark:bg-gray-600 shadow-sm'
                      : ''
                  "
                  @click="viewMode = 'list'"
                >
                  <List class="w-4 h-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
          </div>

          <!-- File Browser -->
          <div class="flex-1 flex overflow-hidden">
            <!-- File List -->
            <div class="flex-1 overflow-auto p-6">
              <div
                v-if="isLoadingTree"
                class="flex items-center justify-center h-full"
              >
                <Loader2 class="w-8 h-8 text-indigo-600 animate-spin" />
              </div>

              <div
                v-else-if="fileTree.length === 0"
                class="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400"
              >
                <Folder class="w-16 h-16 mb-4 opacity-50" />
                <p class="text-lg">{{ $t("workspace.emptyDirectory") }}</p>
                <button
                  class="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                  @click="isCreatingFolder = true"
                >
                  <FolderPlus class="w-4 h-4" />
                  {{ $t("workspace.createFolder") }}
                </button>
              </div>

              <!-- Grid View -->
              <div
                v-else-if="viewMode === 'grid'"
                class="grid grid-cols-4 gap-4"
              >
                <div
                  v-for="node in fileTree"
                  :key="node.path"
                  class="flex flex-col items-center p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-500 cursor-pointer transition-colors"
                  @click="selectFile(node)"
                >
                  <component
                    :is="getFileIcon(node)"
                    class="w-12 h-12 text-gray-400 mb-2"
                  />
                  <span
                    class="text-sm text-gray-900 dark:text-white text-center truncate w-full"
                    >{{ node.name }}</span
                  >
                </div>
              </div>

              <!-- List View -->
              <div v-else class="space-y-1">
                <div
                  v-for="node in fileTree"
                  :key="node.path"
                  class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  @click="selectFile(node)"
                >
                  <component
                    :is="getFileIcon(node)"
                    class="w-5 h-5 text-gray-400"
                  />
                  <span class="text-sm text-gray-900 dark:text-white flex-1">{{
                    node.name
                  }}</span>
                  <span class="text-xs text-gray-500">{{
                    node.kind === "dir"
                      ? $t("workspace.folder")
                      : $t("workspace.file")
                  }}</span>
                </div>
              </div>
            </div>

            <!-- Preview Panel -->
            <aside
              v-if="selectedFile"
              class="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-auto"
            >
              <div class="p-4">
                <div class="flex items-center gap-3 mb-4">
                  <component
                    :is="getFileIcon(selectedFile)"
                    class="w-8 h-8 text-gray-400"
                  />
                  <div class="flex-1 min-w-0">
                    <p
                      class="font-medium text-gray-900 dark:text-white truncate"
                    >
                      {{ selectedFile.name }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{
                        selectedFile.kind === "dir"
                          ? $t("workspace.folder")
                          : $t("workspace.file")
                      }}
                    </p>
                  </div>
                </div>

                <!-- Preview Content -->
                <div
                  v-if="isLoadingPreview"
                  class="flex items-center justify-center py-8"
                >
                  <Loader2 class="w-6 h-6 text-indigo-600 animate-spin" />
                </div>

                <div
                  v-else-if="previewKind === 'image'"
                  class="bg-gray-100 dark:bg-gray-700 rounded-lg p-4"
                >
                  <p class="text-sm text-gray-500 text-center">
                    {{ $t("workspace.imagePreview") }}
                  </p>
                </div>

                <div
                  v-else-if="
                    previewKind === 'markdown' || previewKind === 'text'
                  "
                  class="prose dark:prose-invert max-w-none"
                >
                  <pre
                    class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96"
                    >{{ fileContent }}</pre
                  >
                </div>

                <div
                  v-else
                  class="text-center py-8 text-gray-500 dark:text-gray-400"
                >
                  <p>{{ $t("workspace.noPreview") }}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>

    <!-- Create Folder Dialog -->
    <div
      v-if="isCreatingFolder"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="isCreatingFolder = false"
    >
      <div
        class="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm mx-4"
      >
        <div class="p-6">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">
            {{ $t("workspace.createFolder") }}
          </h3>
          <input
            v-model="newFolderName"
            type="text"
            class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            :placeholder="$t('workspace.folderName')"
            @keyup.enter="createFolder"
          />
        </div>
        <div
          class="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3 rounded-b-xl"
        >
          <button
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            @click="isCreatingFolder = false"
          >
            {{ $t("common.cancel") }}
          </button>
          <button
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            @click="createFolder"
            :disabled="!newFolderName.trim()"
          >
            {{ $t("common.create") }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
