// Theme and IDE types
export type ThemeMode = 'light' | 'dark' | 'system' | 'custom';

export type SupportedIdeKind = 'vscode' | 'visual_studio' | 'jetbrains' | 'custom';

export type IdeConfig = {
  kind: SupportedIdeKind;
  name: string;
  exePath: string;
  args?: string[];
};

export type WorkspaceSettings = {
  themeMode: ThemeMode;
  customThemeId?: string;
  defaultIde?: IdeConfig;
};

export type WorkspaceInfo = {
  path: string;
  dbPath: string;
  lastOpenedAt: string;
  settings?: WorkspaceSettings;
};

export type ProjectDisplay = {
  themeMode?: Exclude<ThemeMode, 'system'>;
  themeColor?: string;
};

// Git types
export type GitRepository = {
  id: string;
  projectId: string;
  name: string;
  path: string;
  remoteUrl?: string;
  branch?: string;
  lastSyncAt?: string;
  lastStatusCheckedAt?: string;
};

export type NetworkState = 'online' | 'offline' | 'unknown';

export type GitRepoStatus = {
  repoId: string;
  branch?: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  lastCheckedAt: string;
  network: NetworkState;
  lastError?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  projectPath: string;
  display?: ProjectDisplay;
  ideOverride?: IdeConfig;
  updatedAt: string;
};

export type FileNode = {
  path: string;
  name: string;
  kind: 'file' | 'dir';
  children?: FileNode[];
};

export type GitCloneInput = {
  remoteUrl: string;
  targetDirName: string;
  branch?: string;
};

export type GitPullResult = {
  ok: boolean;
  message?: string;
  syncedAt?: string;
};

// Directory types
export type DirectoryTypeKind = 'code' | 'docs' | 'ui_design' | 'project_planning' | 'custom';

export type DirectoryType = {
  id: string;
  kind: DirectoryTypeKind;
  name: string;
  category?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectDirectory = {
  id: string;
  projectId: string;
  dirTypeId: string;
  relativePath: string;
  createdAt: string;
  updatedAt: string;
};

export type PreviewKind = 'image' | 'markdown' | 'text';

// API input types
export type ProjectCreateInput = {
  name: string;
  description?: string;
  display?: ProjectDisplay;
};

export type ProjectUpdateInput = Partial<
  Pick<Project, 'name' | 'description' | 'display' | 'ideOverride'>
>;

export type DirTypeCreateInput = {
  name: string;
  category?: string;
  sortOrder?: number;
};

export type DirTypeUpdateInput = Partial<Pick<DirectoryType, 'name' | 'category' | 'sortOrder'>>;

export type ProjectDirCreateInput = {
  dirTypeId: string;
  relativePath: string;
};

// File system types
export type FsResult = {
  ok: boolean;
  message?: string;
};
