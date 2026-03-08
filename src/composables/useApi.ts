import { invoke } from '@tauri-apps/api/core'
import type {
  WorkspaceInfo,
  WorkspaceSettings,
  Project,
  ProjectCreateInput,
  ProjectUpdateInput,
  GitRepository,
  GitCloneInput,
  GitPullResult,
  GitRepoStatus,
  FileNode,
  DirectoryType,
  DirTypeCreateInput,
  DirTypeUpdateInput,
  ProjectDirectory,
  ProjectDirCreateInput,
  PreviewKind,
  IdeConfig,
  FsResult,
  // New module system types
  Module,
  ModuleCreateInput,
  ModuleUpdateInput,
  Directory,
  DirectoryCreateInput,
  DirectoryUpdateInput,
  DirectoryTemplate,
  DirectoryTemplateCreateInput,
  DirectoryTemplateUpdateInput,
  TemplateScope,
} from '@/types'

// Workspace API
export const workspaceApi = {
  async initOrOpen(path: string): Promise<WorkspaceInfo> {
    return invoke('workspace_init_or_open', { path })
  },

  async listRecent(): Promise<WorkspaceInfo[]> {
    return invoke('workspace_list_recent')
  },

  async getCurrent(): Promise<WorkspaceInfo | null> {
    return invoke('workspace_get_current')
  },

  async getSettings(): Promise<WorkspaceSettings> {
    return invoke('workspace_settings_get')
  },

  async updateSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
    return invoke('workspace_settings_update', { patch })
  },

  async updateAlias(path: string, alias?: string): Promise<WorkspaceInfo> {
    return invoke('workspace_update_alias', { path, alias })
  },

  async removeFromRecent(path: string): Promise<void> {
    return invoke('workspace_remove_from_recent', { path })
  },
}

// Project API
export const projectApi = {
  async list(): Promise<Project[]> {
    return invoke('projects_list')
  },

  async create(input: ProjectCreateInput): Promise<Project> {
    return invoke('project_create', { input })
  },

  async get(id: string): Promise<Project> {
    return invoke('project_get', { id })
  },

  async update(id: string, patch: ProjectUpdateInput): Promise<Project> {
    return invoke('project_update', { id, patch })
  },

  async delete(id: string): Promise<{ ok: boolean }> {
    return invoke('project_delete', { id })
  },

  async show(id: string): Promise<Project> {
    return invoke('project_show', { id })
  },
}

// Git types
export type GitRepoUpdateInput = {
  name?: string
  description?: string
  ideOverride?: IdeConfig
}

// Git API
export const gitApi = {
  async repoList(projectId: string): Promise<GitRepository[]> {
    return invoke('git_repo_list', { projectId })
  },

  async repoCreate(projectId: string, name: string): Promise<GitRepository> {
    return invoke('git_repo_create', { projectId, name })
  },

  async repoClone(projectId: string, input: GitCloneInput): Promise<GitRepository> {
    return invoke('git_repo_clone', { projectId, input })
  },

  async repoUpdate(repoId: string, patch: GitRepoUpdateInput): Promise<GitRepository> {
    return invoke('git_repo_update', { repoId, patch })
  },

  async extractRepoName(remoteUrl: string): Promise<string> {
    return invoke('git_extract_repo_name', { remoteUrl })
  },

  async repoPull(repoId: string): Promise<GitPullResult> {
    return invoke('git_repo_pull', { repoId })
  },

  async scan(projectId: string): Promise<{ ok: boolean; scanned: string[] }> {
    return invoke('git_repo_scan', { projectId })
  },

  async repoStatusGet(repoId: string): Promise<GitRepoStatus> {
    return invoke('git_repo_status_get', { repoId })
  },

  async repoStatusCheck(repoId: string): Promise<GitRepoStatus> {
    return invoke('git_repo_status_check', { repoId })
  },

  async statusWatchStart(repoId?: string): Promise<{ ok: boolean }> {
    return invoke('git_status_watch_start', { repoId })
  },

  async statusWatchStop(repoId?: string): Promise<{ ok: boolean }> {
    return invoke('git_status_watch_stop', { repoId })
  },
}

// Filesystem API
export const fsApi = {
  async tree(projectId: string, relativeRoot: string): Promise<FileNode> {
    return invoke('project_fs_tree', { id: projectId, relativeRoot })
  },

  async readText(path: string): Promise<{ content: string }> {
    return invoke('fs_read_text', { path })
  },

  async createDir(path: string): Promise<FsResult> {
    return invoke('fs_create_dir', { path })
  },

  async delete(path: string): Promise<FsResult> {
    return invoke('fs_delete', { path })
  },

  async rename(oldPath: string, newPath: string): Promise<FsResult> {
    return invoke('fs_rename', { oldPath, newPath })
  },
}

// Directory Type API
export const dirTypeApi = {
  async list(): Promise<DirectoryType[]> {
    return invoke('dir_types_list')
  },

  async createCustom(input: DirTypeCreateInput): Promise<DirectoryType> {
    return invoke('dir_type_create_custom', { input })
  },

  async update(id: string, patch: DirTypeUpdateInput): Promise<DirectoryType> {
    return invoke('dir_type_update', { id, patch })
  },

  async listProjectDirs(projectId: string): Promise<ProjectDirectory[]> {
    return invoke('project_dirs_list', { projectId })
  },

  async createOrUpdateProjectDir(
    projectId: string,
    input: ProjectDirCreateInput
  ): Promise<ProjectDirectory> {
    return invoke('project_dir_create_or_update', { projectId, input })
  },

  async syncAuto(projectId: string): Promise<{ ok: boolean; synced: string[] }> {
    return invoke('project_dirs_sync_auto', { projectId })
  },
}

// Preview API
export const previewApi = {
  async detect(path: string): Promise<{ kind: PreviewKind }> {
    return invoke('preview_detect', { path })
  },
}

// IDE API
export const ideApi = {
  async listSupported(): Promise<IdeConfig[]> {
    return invoke('ide_list_supported')
  },

  async openRepo(repoId: string, ide?: IdeConfig): Promise<{ ok: boolean; message?: string }> {
    return invoke('ide_open_repo', { repoId, ide })
  },

  async openInTerminal(repoId: string): Promise<{ ok: boolean; message?: string }> {
    return invoke('open_in_terminal', { repoId })
  },

  async preview(repoId: string, ide?: IdeConfig): Promise<IdeConfig | null> {
    return invoke('ide_preview', { repoId, ide })
  },
}

// Module API
export const moduleApi = {
  async list(): Promise<Module[]> {
    return invoke('module_list')
  },

  async get(id: string): Promise<Module> {
    return invoke('module_get', { id })
  },

  async getByKey(key: string): Promise<Module> {
    return invoke('module_get_by_key', { key })
  },

  async create(input: ModuleCreateInput): Promise<Module> {
    return invoke('module_create', { input })
  },

  async update(id: string, patch: ModuleUpdateInput): Promise<Module> {
    return invoke('module_update', { id, patch })
  },

  async delete(id: string): Promise<void> {
    return invoke('module_delete', { id })
  },

  async validateConfig(
    id: string,
    config: Record<string, unknown>
  ): Promise<{ valid: boolean; errors?: string[] }> {
    return invoke('module_validate_config', { id, config })
  },
}

// Directory API
export const directoryApi = {
  async list(projectId: string): Promise<Directory[]> {
    return invoke('directory_list', { projectId })
  },

  async get(id: string): Promise<Directory> {
    return invoke('directory_get', { id })
  },

  async create(projectId: string, input: DirectoryCreateInput): Promise<Directory> {
    return invoke('directory_create', { projectId, input })
  },

  async update(id: string, patch: DirectoryUpdateInput): Promise<Directory> {
    return invoke('directory_update', { id, patch })
  },

  async delete(id: string): Promise<void> {
    return invoke('directory_delete', { id })
  },

  async enableModule(
    id: string,
    moduleId: string,
    config?: Record<string, unknown>
  ): Promise<Directory> {
    return invoke('directory_enable_module', { id, moduleId, config })
  },

  async disableModule(id: string): Promise<Directory> {
    return invoke('directory_disable_module', { id })
  },

  async updateModuleConfig(id: string, config: Record<string, unknown>): Promise<Directory> {
    return invoke('directory_update_module_config', { id, config })
  },

  async reorder(projectId: string, orderedIds: string[]): Promise<Directory[]> {
    return invoke('directory_reorder', { projectId, orderedIds })
  },
}

// Template API
export const templateApi = {
  async list(
    scope?: 'local' | 'project' | 'official',
    projectId?: string
  ): Promise<DirectoryTemplate[]> {
    return invoke('template_list', { scope, projectId })
  },

  async get(id: string): Promise<DirectoryTemplate> {
    return invoke('template_get', { id })
  },

  async create(input: DirectoryTemplateCreateInput): Promise<DirectoryTemplate> {
    return invoke('template_create', { input })
  },

  async update(id: string, patch: DirectoryTemplateUpdateInput): Promise<DirectoryTemplate> {
    return invoke('template_update', { id, patch })
  },

  async delete(id: string): Promise<void> {
    return invoke('template_delete', { id })
  },

  async apply(
    templateId: string,
    projectId: string,
    customizations?: { items?: Array<{ relativePath?: string; name?: string; excluded?: boolean }> }
  ): Promise<Directory[]> {
    return invoke('template_apply', { templateId, projectId, customizations })
  },

  async fromDirectories(
    name: string,
    description: string,
    scope: TemplateScope,
    projectId: string,
    directoryIds: string[]
  ): Promise<DirectoryTemplate> {
    return invoke('template_from_directories', {
      name,
      description,
      scope,
      projectId,
      directoryIds,
    })
  },

  async export(templateId: string): Promise<string> {
    return invoke('template_export', { templateId })
  },

  async import(filePath: string): Promise<DirectoryTemplate> {
    return invoke('template_import', { filePath })
  },
}
