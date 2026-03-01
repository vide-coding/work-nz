import { invoke } from '@tauri-apps/api/core';
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
} from '../types';

// Workspace API
export const workspaceApi = {
  async initOrOpen(path: string): Promise<WorkspaceInfo> {
    return invoke('workspace_init_or_open', { path });
  },

  async listRecent(): Promise<WorkspaceInfo[]> {
    return invoke('workspace_list_recent');
  },

  async getSettings(): Promise<WorkspaceSettings> {
    return invoke('workspace_settings_get');
  },

  async updateSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
    return invoke('workspace_settings_update', { patch });
  },
};

// Project API
export const projectApi = {
  async list(): Promise<Project[]> {
    return invoke('projects_list');
  },

  async create(input: ProjectCreateInput): Promise<Project> {
    return invoke('project_create', { input });
  },

  async get(id: string): Promise<Project> {
    return invoke('project_get', { id });
  },

  async update(id: string, patch: ProjectUpdateInput): Promise<Project> {
    return invoke('project_update', { id, patch });
  },

  async delete(id: string): Promise<{ ok: boolean }> {
    return invoke('project_delete', { id });
  },
};

// Git API
export const gitApi = {
  async repoList(projectId: string): Promise<GitRepository[]> {
    return invoke('git_repo_list', { projectId });
  },

  async repoCreate(projectId: string, name: string): Promise<GitRepository> {
    return invoke('git_repo_create', { projectId, name });
  },

  async repoClone(projectId: string, input: GitCloneInput): Promise<GitRepository> {
    return invoke('git_repo_clone', { projectId, input });
  },

  async repoPull(repoId: string): Promise<GitPullResult> {
    return invoke('git_repo_pull', { repoId });
  },

  async repoStatusGet(repoId: string): Promise<GitRepoStatus> {
    return invoke('git_repo_status_get', { repoId });
  },

  async repoStatusCheck(repoId: string): Promise<GitRepoStatus> {
    return invoke('git_repo_status_check', { repoId });
  },

  async statusWatchStart(repoId?: string): Promise<{ ok: boolean }> {
    return invoke('git_status_watch_start', { repoId });
  },

  async statusWatchStop(repoId?: string): Promise<{ ok: boolean }> {
    return invoke('git_status_watch_stop', { repoId });
  },
};

// Filesystem API
export const fsApi = {
  async tree(projectId: string, relativeRoot: string): Promise<FileNode> {
    return invoke('project_fs_tree', { id: projectId, relativeRoot });
  },

  async readText(path: string): Promise<{ content: string }> {
    return invoke('fs_read_text', { path });
  },

  async createDir(path: string): Promise<FsResult> {
    return invoke('fs_create_dir', { path });
  },

  async delete(path: string): Promise<FsResult> {
    return invoke('fs_delete', { path });
  },

  async rename(oldPath: string, newPath: string): Promise<FsResult> {
    return invoke('fs_rename', { oldPath, newPath });
  },
};

// Directory Type API
export const dirTypeApi = {
  async list(): Promise<DirectoryType[]> {
    return invoke('dir_types_list');
  },

  async createCustom(input: DirTypeCreateInput): Promise<DirectoryType> {
    return invoke('dir_type_create_custom', { input });
  },

  async update(id: string, patch: DirTypeUpdateInput): Promise<DirectoryType> {
    return invoke('dir_type_update', { id, patch });
  },

  async listProjectDirs(projectId: string): Promise<ProjectDirectory[]> {
    return invoke('project_dirs_list', { projectId });
  },

  async createOrUpdateProjectDir(
    projectId: string,
    input: ProjectDirCreateInput
  ): Promise<ProjectDirectory> {
    return invoke('project_dir_create_or_update', { projectId, input });
  },
};

// Preview API
export const previewApi = {
  async detect(path: string): Promise<{ kind: PreviewKind }> {
    return invoke('preview_detect', { path });
  },
};

// IDE API
export const ideApi = {
  async listSupported(): Promise<IdeConfig[]> {
    return invoke('ide_list_supported');
  },

  async openRepo(repoId: string, ide?: IdeConfig): Promise<{ ok: boolean; message?: string }> {
    return invoke('ide_open_repo', { repoId, ide });
  },
};
