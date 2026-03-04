# 应用设置页面设计文档

## 架构概述

设置页面将采用两种配置层级：

1. **全局设置** - 存储在用户目录下的配置文件中（如 `~/.vibe-kanban/settings.json`），跨工作区共享
2. **工作区设置** - 存储在现有工作区配置中，仅对当前工作区生效

## 组件设计

### 新增组件

```
src/
├── views/
│   └── SettingsView.vue          # 设置页面主视图
├── components/
│   └── settings/
│       ├── SettingsLayout.vue    # 设置页面布局
│       ├── GlobalSettingsPanel.vue  # 全局设置面板
│       ├── WorkspaceSettingsPanel.vue  # 工作区设置面板
│       └── SettingItem.vue       # 通用设置项组件
└── composables/
│   └── useSettings.ts            # 设置管理组合函数
└── types/
    └── settings.ts               # 设置相关类型定义
```

## 路由设计

在现有 router 中添加设置路由：

```typescript
{
  path: '/settings',
  name: 'settings',
  component: () => import('../views/SettingsView.vue'),
  children: [
    {
      path: '',
      redirect: 'global',
    },
    {
      path: 'global',
      name: 'settings-global',
      component: () => import('../components/settings/GlobalSettingsPanel.vue'),
    },
    {
      path: 'workspace',
      name: 'settings-workspace',
      component: () => import('../components/settings/WorkspaceSettingsPanel.vue'),
    },
  ],
}
```

## 设置存储方案

### 全局设置

存储在用户目录下的配置文件中（例如 `~/.vibe-kanban/settings.json`）：

- 主题偏好（light/dark/system）
- 语言设置（zh-CN/en-US）
- 字体大小
- 其他 UI 偏好

前端通过 Tauri invoke 调用 Rust 后端 API 读取和更新配置文件。

### 工作区设置

使用现有的 `workspaceApi.updateSettings` 方法：

- 工作区特定主题覆盖
- 工作区特定语言
- IDE 覆盖设置

## 组件详细设计

### SettingsView.vue

- 页面容器，包含设置导航和内容区域
- 支持响应式布局
- 处理设置保存状态提示

### GlobalSettingsPanel.vue

- 主题设置（复用 ThemeToggle 组件）
- 语言设置（复用 LanguageSelector 组件）
- 字体大小调节
- 重置为默认值按钮

### WorkspaceSettingsPanel.vue

- 显示当前工作区信息
- 工作区特定设置
- 继承全局设置的选项开关
- 重置工作区设置按钮

### SettingItem.vue

通用设置项组件：

```vue
<template>
  <div class="setting-item">
    <div class="setting-label">{{ label }}</div>
    <div class="setting-control">
      <slot></slot>
    </div>
    <div class="setting-description">{{ description }}</div>
  </div>
</template>
```

### useSettings.ts

设置管理组合函数：

```typescript
export function useSettings() {
  // 全局设置
  const globalSettings = ref<GlobalSettings>(...)
  const updateGlobalSettings = async (patch: Partial<GlobalSettings>) => {...}

  // 工作区设置
  const workspaceSettings = ref<WorkspaceSettings>(...)
  const updateWorkspaceSettings = async (patch: Partial<WorkspaceSettings>) => {...}

  // 设置持久化
  const saveSettings = async () => {...}
  const resetSettings = async () => {...}

  return {
    globalSettings,
    workspaceSettings,
    updateGlobalSettings,
    updateWorkspaceSettings,
    saveSettings,
    resetSettings,
  }
}
```

## 类型定义

```typescript
// src/types/settings.ts

export type LanguageCode = 'zh-CN' | 'en-US'
export type ThemeMode = 'light' | 'dark' | 'system'

export type GlobalSettings = {
  themeMode: ThemeMode
  language: LanguageCode
  fontSize: 'small' | 'medium' | 'large'
}

export type WorkspaceSettingsOverride = {
  useGlobalTheme: boolean
  useGlobalLanguage: boolean
  themeMode?: ThemeMode
  language?: LanguageCode
}
```

## 样式设计

- 使用 Tailwind CSS 保持与应用一致的风格
- 设置面板使用卡片式设计
- 分组标题清晰分隔不同设置类别
- 保存状态使用 Toast 提示

## 国际化

在现有 i18n 系统中添加设置相关翻译：

- `settings.title` - 设置
- `settings.global` - 全局设置
- `settings.workspace` - 工作区设置
- `settings.theme` - 主题
- `settings.language` - 语言
- `settings.save` - 保存
- `settings.reset` - 重置

## 访问入口

在现有页面添加设置入口：

1. WorkspaceView - 右上角设置图标
2. ProjectsView - 导航栏设置图标
3. ProjectWorkspaceView - 导航栏设置图标

## 设置生效机制

- 全局设置变更：立即应用到应用
- 工作区设置变更：仅影响当前工作区
- 设置持久化：变更时自动保存
