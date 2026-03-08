# Directory Module System

A flexible, pluggable module system for managing directory capabilities in Vibe Kanban.

## Overview

The module system transforms the traditional fixed directory types into a dynamic, extensible architecture. Instead of hardcoded categories like "Code", "Docs", users can enable different modules on directories to provide specific functionality.

## Core Concepts

### Modules

A module is a self-contained functional unit that provides specific capabilities to a directory. Each module defines:

- **Capabilities**: What operations the module supports (e.g., `git.clone`, `task.create`)
- **Configuration Schema**: JSON Schema for module-specific settings
- **Default Configuration**: Sensible defaults for module settings

### Built-in Modules

| Module | Key    | Capabilities                                          |
| ------ | ------ | ----------------------------------------------------- |
| Git    | `git`  | clone, pull, status, log, config                      |
| Tasks  | `task` | create, update, delete, list, status                  |
| Files  | `file` | browse, read, preview, search, create, delete, rename |

### Directories

A directory represents a folder in a project with optional module binding:

```typescript
interface Directory {
  id: string
  projectId: string
  name: string
  relativePath: string
  moduleId?: string // Optional module binding
  moduleConfig?: Record<string, unknown> // Module-specific settings
  sortOrder: number
  createdAt: string
  updatedAt: string
}
```

### Templates

Templates allow users to create reusable directory structures with predefined modules:

```typescript
interface DirectoryTemplate {
  id: string
  name: string
  description?: string
  scope: 'local' | 'project' | 'official'
  projectId?: string
  items: DirectoryTemplateItem[]
  createdAt: string
  updatedAt: string
}
```

## Usage

### Using Composables

#### Module Registry

```typescript
import { moduleRegistry, BUILTIN_MODULES } from '@/composables/useModuleRegistry'

// Get a module
const gitModule = moduleRegistry.get('git')

// Check capabilities
const canClone = moduleRegistry.hasCapability('git', 'git.clone')

// Validate configuration
const validation = moduleRegistry.validateConfig('git', { autoDetect: true })
```

#### Directory Navigation

```typescript
import { useDirectoryNavigation } from '@/composables/useDirectoryNavigation'

const { directories, navItems, currentDirectory, loadDirectories, createDirectory, enableModule } =
  useDirectoryNavigation(projectId)

// Load directories
await loadDirectories()

// Create a new directory with a module
await createDirectory({
  name: 'My Tasks',
  relativePath: 'tasks',
  moduleId: 'builtin:task',
  moduleConfig: { defaultStatus: 'todo' },
})
```

#### Task Module

```typescript
import { useTaskModule } from '@/composables/useTaskModule'

const { tasks, loading, createTask, updateTask, deleteTask, statusValues, priorityValues } =
  useTaskModule(directory)

// Load and manage tasks
await loadTasks()
await createTask({ title: 'New Task', priority: 'high' })
```

#### File Module

```typescript
import { useFileModule } from '@/composables/useFileModule'

const { files, breadcrumbs, loadFiles, navigateTo, createDirectory } = useFileModule(directory)

// Navigate and manage files
await loadFiles('')
await navigateTo('src/components')
await createDirectory('new-folder')
```

#### Template Management

```typescript
import { useDirectoryTemplate } from '@/composables/useDirectoryTemplate'

const { templates, loadTemplates, applyTemplate, createTemplate } = useDirectoryTemplate()

// Load and apply templates
await loadTemplates('official')
const directories = await applyTemplate(templateId, projectId)
```

## Configuration Schema

### Git Module

```json
{
  "type": "object",
  "properties": {
    "autoDetect": {
      "type": "boolean",
      "title": "Auto-detect repositories",
      "default": true
    },
    "defaultRemote": {
      "type": "string",
      "title": "Default remote name",
      "default": "origin",
      "minLength": 1
    },
    "autoPull": {
      "type": "boolean",
      "title": "Auto-pull on startup",
      "default": false
    }
  },
  "required": ["autoDetect", "defaultRemote", "autoPull"]
}
```

### Task Module

```json
{
  "type": "object",
  "properties": {
    "defaultStatus": {
      "type": "string",
      "title": "Default status for new tasks",
      "default": "todo"
    },
    "statusValues": {
      "type": "array",
      "title": "Status values",
      "default": [
        { "id": "todo", "name": "To Do", "color": "#9CA3AF" },
        { "id": "in_progress", "name": "In Progress", "color": "#3B82F6" },
        { "id": "done", "name": "Done", "color": "#10B981" }
      ]
    },
    "priorityValues": {
      "type": "array",
      "title": "Priority values",
      "default": [
        { "id": "low", "name": "Low", "color": "#6B7280" },
        { "id": "medium", "name": "Medium", "color": "#F59E0B" },
        { "id": "high", "name": "High", "color": "#EF4444" },
        { "id": "urgent", "name": "Urgent", "color": "#DC2626" }
      ]
    }
  }
}
```

### File Module

```json
{
  "type": "object",
  "properties": {
    "defaultViewMode": {
      "type": "string",
      "enum": ["list", "grid"],
      "default": "list"
    },
    "showHiddenFiles": {
      "type": "boolean",
      "default": false
    },
    "defaultSortOrder": {
      "type": "string",
      "enum": ["name", "size", "date"],
      "default": "name"
    },
    "fileTypeFilters": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    }
  }
}
```

## Migration from Directory Types

The old system used fixed directory types (`code`, `docs`, `ui_design`, `project_planning`). The new module system provides equivalent functionality:

| Old Type           | New Module     |
| ------------------ | -------------- |
| `code`             | `git` + `file` |
| `docs`             | `file`         |
| `ui_design`        | `file`         |
| `project_planning` | `task`         |

Existing projects will continue to work, and a migration path will be provided to convert old directory types to the new module-based system.

## API Reference

### Frontend APIs

- `useModuleRegistry` - Module registry and validation
- `useDirectoryNavigation` - Directory navigation and management
- `useTaskModule` - Task management for directories
- `useFileModule` - File browsing for directories
- `useDirectoryTemplate` - Template management

### Backend Commands (Tauri)

- `module_list` - List all modules
- `module_get` - Get module by ID
- `module_create` - Create custom module
- `directory_list` - List directories
- `directory_create` - Create directory
- `directory_enable_module` - Enable module on directory
- `directory_disable_module` - Disable module on directory
- `template_list` - List templates
- `template_apply` - Apply template to project

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Vue Components                          │
├─────────────────────────────────────────────────────────────┤
│  TemplateSelector  │  ModuleContentArea  │  DirectoryNav   │
└─────────┬──────────┴─────────┬──────────┴────────┬──────────┘
          │                    │                   │
          ▼                    ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Composables                               │
├─────────────────────────────────────────────────────────────┤
│  useDirectoryTemplate │ useTaskModule │ useFileModule      │
│  useDirectoryNavigation                                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                              │
├─────────────────────────────────────────────────────────────┤
│           moduleApi  │  directoryApi  │  templateApi        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Tauri Backend (Rust)                       │
├─────────────────────────────────────────────────────────────┤
│              Module Commands  │  Database  │  File System   │
└─────────────────────────────────────────────────────────────────┘
```

## Future Enhancements

- Custom module creation via UI
- Module marketplace
- Module dependencies
- Advanced task workflows
- Real-time collaboration
