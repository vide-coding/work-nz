// Theme and IDE types
export type ThemeMode = 'light' | 'dark' | 'system' | 'custom'

export type SupportedIdeKind = 'vscode' | 'visual_studio' | 'jetbrains' | 'custom'

export type IdeConfig = {
  kind: SupportedIdeKind
  name: string
  command: string
  args?: string[]
  /** Whether the IDE is available on the system (has a working CLI command) */
  available?: boolean
}

export type WorkspaceSettings = {
  themeMode: ThemeMode
  customThemeId?: string
  defaultIde?: IdeConfig
}

export type WorkspaceInfo = {
  path: string
  dbPath: string
  lastOpenedAt: string
  settings?: WorkspaceSettings
  alias?: string
}

export type ProjectDisplay = {
  themeMode?: Exclude<ThemeMode, 'system'>
  themeColor?: string
}

// Git types
export type GitRepository = {
  id: string
  projectId: string
  name: string
  path: string
  remoteUrl?: string
  branch?: string
  description?: string
  lastSyncAt?: string
  lastStatusCheckedAt?: string
  ideOverride?: IdeConfig
}

export type NetworkState = 'online' | 'offline' | 'unknown'

export type GitRepoStatus = {
  repoId: string
  branch?: string
  dirty: boolean
  ahead: number
  behind: number
  lastCheckedAt: string
  network: NetworkState
  lastError?: string
}

export type Project = {
  id: string
  name: string
  description?: string
  projectPath: string
  display?: ProjectDisplay
  ideOverride?: IdeConfig
  visible: boolean
  updatedAt: string
}

export type FileNode = {
  path: string
  name: string
  kind: 'file' | 'dir'
  children?: FileNode[]
}

export type GitCloneInput = {
  remoteUrl: string
  targetDirName: string
  /** Optional target directory relative path (e.g., "src/my-module"). Defaults to "code" */
  targetDirectory?: string
  branch?: string
  name?: string
}

export type GitPullResult = {
  ok: boolean
  message?: string
  syncedAt?: string
}

// Directory types
export type DirectoryTypeKind = 'code' | 'docs' | 'ui_design' | 'project_planning' | 'custom'

export type DirectoryType = {
  id: string
  kind: DirectoryTypeKind
  name: string
  category?: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type ProjectDirectory = {
  id: string
  projectId: string
  dirTypeId: string
  relativePath: string
  createdAt: string
  updatedAt: string
}

export type PreviewKind = 'image' | 'markdown' | 'text'

// API input types
export type ProjectCreateInput = {
  name: string
  description?: string
  display?: ProjectDisplay
}

export type ProjectUpdateInput = Partial<
  Pick<Project, 'name' | 'description' | 'display' | 'ideOverride'>
>

export type DirTypeCreateInput = {
  name: string
  category?: string
  sortOrder?: number
}

export type DirTypeUpdateInput = Partial<Pick<DirectoryType, 'name' | 'category' | 'sortOrder'>>

export type ProjectDirCreateInput = {
  dirTypeId: string
  relativePath: string
}

// File system types
export type FsResult = {
  ok: boolean
  message?: string
}

/**
 * Module capability string - represents a feature a module provides
 */
export type ModuleCapability =
  | 'git.clone'
  | 'git.pull'
  | 'git.status'
  | 'git.log'
  | 'git.config'
  | 'task.create'
  | 'task.update'
  | 'task.delete'
  | 'task.list'
  | 'task.status'
  | 'file.browse'
  | 'file.read'
  | 'file.preview'
  | 'file.search'
  | 'file.create'
  | 'file.delete'
  | 'file.rename'

/**
 * JSON Schema property definition for module configuration
 */
export interface ModuleConfigProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  title?: string
  description?: string
  default?: unknown
  enum?: unknown[]
  items?: ModuleConfigProperty
  properties?: Record<string, ModuleConfigProperty>
  format?: string
  minLength?: number
  maxLength?: number
  minimum?: number
  maximum?: number
  required?: boolean
}

/**
 * JSON Schema definition for module configuration
 */
export interface ModuleConfigSchema {
  type: 'object'
  title?: string
  description?: string
  properties: Record<string, ModuleConfigProperty>
  required?: string[]
}

/**
 * Module definition - represents a functional module that can be enabled on directories
 */
export interface Module {
  id: string
  key: string
  name: string
  description: string
  version: string
  capabilities: ModuleCapability[]
  configSchema: ModuleConfigSchema
  defaultConfig: Record<string, unknown>
  icon?: string
  isBuiltIn: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Directory - represents a directory in a project with optional module binding
 */
export interface Directory {
  id: string
  projectId: string
  name: string
  relativePath: string
  moduleId?: string
  moduleConfig?: Record<string, unknown>
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * Template scope - defines who can see and use a template
 */
export type TemplateScope = 'local' | 'project' | 'official'

/**
 * Template item - represents a directory within a template
 */
export interface DirectoryTemplateItem {
  name: string
  relativePath: string
  moduleId: string
  moduleConfig?: Record<string, unknown>
}

/**
 * Directory Template - represents a reusable template for creating directories
 */
export interface DirectoryTemplate {
  id: string
  name: string
  description?: string
  scope: TemplateScope
  projectId?: string
  items: DirectoryTemplateItem[]
  createdBy?: string
  createdAt: string
  updatedAt: string
}

// === API Input Types (New) ===

export type ModuleCreateInput = {
  key: string
  name: string
  description: string
  version?: string
  capabilities: ModuleCapability[]
  configSchema: ModuleConfigSchema
  defaultConfig?: Record<string, unknown>
  icon?: string
}

export type ModuleUpdateInput = Partial<
  Pick<
    Module,
    'name' | 'description' | 'version' | 'capabilities' | 'configSchema' | 'defaultConfig' | 'icon'
  >
>

export type DirectoryCreateInput = {
  name: string
  relativePath: string
  moduleId?: string
  moduleConfig?: Record<string, unknown>
  sortOrder?: number
}

export type DirectoryUpdateInput = Partial<
  Pick<Directory, 'name' | 'moduleId' | 'moduleConfig' | 'sortOrder'>
>

export type DirectoryTemplateCreateInput = {
  name: string
  description?: string
  scope: TemplateScope
  projectId?: string
  items: DirectoryTemplateItem[]
}

export type DirectoryTemplateUpdateInput = Partial<
  Pick<DirectoryTemplate, 'name' | 'description' | 'items'>
>
