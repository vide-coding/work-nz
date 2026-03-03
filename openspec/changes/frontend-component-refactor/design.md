# 前端组件重构设计文档

## 架构设计

### 组件层级结构

```
src/
├── components/
│   ├── layout/
│   │   └── AppLayout.vue           # 页面布局容器
│   ├── common/
│   │   ├── ThemeToggle.vue         # 主题切换按钮
│   │   ├── LanguageSelector.vue    # 语言选择器
│   │   └── BaseDialog.vue          # 对话框基础组件
│   ├── workspace/
│   │   ├── WorkspaceItem.vue       # 工作区列表项
│   │   └── WorkspaceAliasDialog.vue # 别名设置对话框
│   ├── project/
│   │   ├── ProjectCard.vue         # 项目卡片
│   │   ├── ProjectPreview.vue      # 项目预览面板
│   │   ├── ProjectCreateDialog.vue # 创建项目对话框
│   │   └── ProjectToolbar.vue      # 项目列表工具栏
│   ├── repo/
│   │   ├── RepoCard.vue            # 仓库卡片
│   │   ├── RepoCloneDialog.vue     # 克隆仓库对话框
│   │   └── RepoEditDialog.vue      # 编辑仓库对话框
│   └── filetree/
│       ├── FileTree.vue            # 文件树组件
│       ├── FileGrid.vue            # 文件网格视图
│       ├── FileListItem.vue        # 文件列表项
│       └── FilePreview.vue         # 文件预览面板
├── views/
│   ├── WorkspaceView.vue           # 简化后：只负责状态管理
│   ├── ProjectsView.vue            # 简化后：只负责状态管理
│   └── ProjectWorkspaceView.vue    # 简化后：只负责状态管理
```

## 组件详细设计

### 1. AppLayout (布局组件)

**职责**: 提供统一的页面布局结构

```vue
props:
  - variant: 'default' | 'with-sidebar' | 'with-preview'
  - showHeader: boolean
  - showFooter: boolean

slots:
  - header (optional)
  - sidebar (optional)
  - default (main content)
  - preview (optional)
```

### 2. ThemeToggle (公共组件)

**职责**: 主题切换按钮，支持 light/dark/system 模式

```vue
props:
  - modelValue: 'light' | 'dark' | 'system'
  - variant: 'button' | 'icon' | 'select'

emits:
  - update:modelValue
```

### 3. LanguageSelector (公共组件)

**职责**: 语言选择器

```vue
props:
  - modelValue: 'zh-CN' | 'en-US'
  - variant: 'button' | 'select'

emits:
  - update:modelValue
```

### 4. WorkspaceItem (工作区组件)

**职责**: 单个工作区项的展示和操作

```vue
props:
  - workspace: WorkspaceInfo
  - selected: boolean
  - activeMenu: string | null

emits:
  - select
  - rename
  - delete
  - toggle-menu
```

### 5. ProjectCard (项目组件)

**职责**: 项目卡片展示

```vue
props:
  - project: Project
  - selected: boolean
  - status: GitRepoStatus | null

emits:
  - select
  - open
  - hide
```

### 6. ProjectPreview (项目预览组件)

**职责**: 项目详情预览面板

```vue
props:
  - project: Project | null
  - loading: boolean

emits:
  - open-workspace
```

### 7. RepoCard (仓库组件)

**职责**: Git 仓库卡片展示

```vue
props:
  - repo: GitRepository
  - status: GitRepoStatus | null

emits:
  - pull
  - open
  - edit
  - delete
  - view-readme
```

### 8. FileTree (文件树组件)

**职责**: 文件和目录的树形展示

```vue
props:
  - nodes: FileNode[]
  - viewMode: 'grid' | 'list'
  - selectedFile: FileNode | null
  - loading: boolean

emits:
  - select
  - navigate
```

### 9. BaseDialog (对话框基础组件)

**职责**: 统一的对话框样式和交互

```vue
props:
  - modelValue: boolean
  - title: string
  - width: string
  - showClose: boolean

emits:
  - update:modelValue
  - close
```

## 重构策略

### WorkspaceView 重构

**拆分后结构**:
```
WorkspaceView.vue (约 80 行)
├── WorkspaceItem.vue (复用)
├── WorkspaceAliasDialog.vue (提取)
├── ThemeToggle.vue (复用)
└── LanguageSelector.vue (复用)
```

### ProjectsView 重构

**拆分后结构**:
```
ProjectsView.vue (约 100 行)
├── ProjectCard.vue (复用)
├── ProjectPreview.vue (复用)
├── ProjectCreateDialog.vue (提取)
├── ProjectToolbar.vue (提取)
├── ThemeToggle.vue (复用)
└── LanguageSelector.vue (复用)
```

### ProjectWorkspaceView 重构

**拆分后结构**:
```
ProjectWorkspaceView.vue (约 150 行)
├── RepoCard.vue (复用)
├── RepoCloneDialog.vue (提取)
├── RepoEditDialog.vue (提取)
├── FileTree.vue (复用)
├── FilePreview.vue (复用)
├── BaseDialog.vue (复用)
├── ThemeToggle.vue (复用)
└── LanguageSelector.vue (复用)
```

## 状态管理策略

### Props Down, Events Up

所有子组件通过 props 接收数据，通过 emits 向上发送事件，保持单向数据流。

### Composables 复用

现有 composables 已良好分离，重构时保持使用：
- `useApi.ts` - API 调用
- `useLocale.ts` - 国际化

## 技术细节

### TypeScript 接口

所有组件 props 使用 TypeScript 定义，保持类型安全。

### 响应式

继续使用 Vue 3 Composition API 和 `<script setup>` 语法。

### 样式

保持使用 Tailwind CSS，避免引入新的样式方案。

## 组件大小目标

| 组件类型 | 最大行数 |
|----------|----------|
| 页面组件 | 150 行   |
| 业务组件 | 200 行   |
| 公共组件 | 100 行   |
| 布局组件 | 80 行    |

## 兼容性

- 保持现有路由不变
- 保持现有 API 不变
- 保持现有功能行为不变
- 国际化 key 保持不变
