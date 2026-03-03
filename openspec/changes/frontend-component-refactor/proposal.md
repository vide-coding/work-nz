# 前端项目结构优化提案

## 问题描述

当前前端页面文件过大，存在以下问题：

1. **WorkspaceView.vue** (约 416 行) - 包含工作区选择、别名管理、主题切换等多个功能
2. **ProjectsView.vue** (约 626 行) - 包含项目列表、搜索、排序、创建对话框等功能
3. **ProjectWorkspaceView.vue** (约 1330 行) - 包含项目介绍、代码管理、资源目录、文件浏览等功能

这些问题导致：

- 代码难以维护和阅读
- 组件职责不清晰
- 复用性差
- 测试困难

## 目标

将大型页面文件拆分为多个职责单一的组件，统一布局结构，提取公共组件，使代码结构简洁清晰。

## 原则

1. **适度拆分** - 避免过度拆分导致组件碎片化
2. **职责单一** - 每个组件只负责一个明确的功能
3. **复用优先** - 将重复的逻辑和 UI 提取为公共组件
4. **保持简洁** - 不引入不必要的复杂性

## 范围

### 需要重构的文件

- `src/views/WorkspaceView.vue`
- `src/views/ProjectsView.vue`
- `src/views/ProjectWorkspaceView.vue`

### 新增组件

- 布局组件：`AppLayout.vue`
- 公共组件：
  - `ThemeToggle.vue` (主题切换)
  - `LanguageSelector.vue` (语言选择)
  - `WorkspaceItem.vue` (工作区列表项)
  - `ProjectCard.vue` (项目卡片)
  - `ProjectPreview.vue` (项目预览面板)
  - `FileTree.vue` (文件树浏览)
  - `RepoCard.vue` (仓库卡片)
  - `Dialog/Base.vue` (对话框基础组件)

### 保持不变的文件

- `src/components/SettingsBar.vue` (已有良好组件)
- `src/components/MarkdownRenderer.vue` (已有良好组件)
- `src/composables/*` (逻辑已良好分离)
- `src/router/*`
- `src/types/*`

## 非目标

- 不改变现有功能行为
- 不修改 API 调用逻辑
- 不改变路由结构
- 不修改国际化配置
- 不过度优化性能（保持现有逻辑）

## 预期收益

1. **代码可维护性** - 组件大小控制在 200 行以内
2. **复用性提升** - 公共组件可在多处使用
3. **测试友好** - 小组件更易于单元测试
4. **开发效率** - 清晰的组件结构便于理解和修改
