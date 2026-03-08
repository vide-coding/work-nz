## 为什么要进行重构

当前系统使用固定的五种目录类型（`code`, `docs`, `ui_design`, `project_planning`, `custom`），这种设计限制了用户根据实际需求灵活组织项目资源的能力。目录类型与功能的强耦合使得新增类型需要修改代码，不符合开闭原则。需要将系统从固定的类型系统转变为灵活的模块系统，让用户能够自由定义目录功能。

## 有哪些变化

- **移除预定义目录类型**：删除 `docs`, `ui_design`, `project_planning`, `custom` 四种固定类型，仅保留 `code` 作为内置模块
- **引入模块化架构**：定义模块系统，每个模块通过 JSON Schema 描述配置结构和能力
- **目录与模块绑定**：用户创建目录时选择一个模块启用，目录继承该模块的功能
- **模块互斥机制**：一个目录只能同时启用一个模块，保证职责单一
- **目录模板系统**：支持将目录配置保存为模板，创建项目时可选择模板快速初始化目录结构
- **模板共享机制**：模板可在项目间共享，支持本地模板和导出/导入

**破坏性变更**:

- `DirectoryTypeKind` 类型枚举值从 5 个减少到 1 个（仅保留 `code`）
- `DirectoryType` 表结构变更为 `Module` 和 `Directory` 两个独立概念
- `ProjectDirectory` 的 `dirTypeId` 字段变更为 `moduleId`
- 现有项目的 `docs`, `ui_design`, `project_planning` 类型数据需要迁移

## 新增能力

### 新增能力

- `directory-module-system`: 模块化目录系统，支持模块的定义、注册、配置和启用
- `directory-template-system`: 目录模板系统，支持模板的创建、应用、导出和共享
- `git-module`: Git模块，提供Git仓库的克隆、拉取、状态查看等能力
- `task-module`: 任务模块，提供计划管理和任务追踪能力
- `file-module`: 文件模块，提供通用的文件浏览和预览能力

### 修改的能力

- `project-workspace`: 项目工作区的导航和数据加载逻辑需要适配新的目录模型
- `project-creation`: 项目创建流程需要增加模板选择步骤

## 影响范围

- **前端代码**：
  - `src/types/index.ts`：更新 Directory 和 Module 相关类型定义
  - `src/views/ProjectWorkspaceView.vue`：重构导航和目录加载逻辑
  - `src/views/ProjectCreateView.vue`：增加模板选择步骤
  - `src/composables/useApi.ts`：更新 API 接口
  - 新增模块配置组件、模板选择器组件等

- **后端代码（Tauri Commands）**：
  - 重构 directory type 相关 commands 为 module 和 directory 管理
  - 新增模板管理的 CRUD 接口
  - 数据迁移脚本

- **数据库/存储**：
  - 现有的 directory type 数据需要迁移到新结构
  - 新增模板存储（可能是文件系统或本地存储）

- **API 变化**：
  - `dirTypeApi.list()` → `moduleApi.list()` + `directoryApi.list(projectId)`
  - 新增 `templateApi.list()`, `templateApi.create()`, `templateApi.apply()` 等

- **依赖变化**：无新增外部依赖，使用系统已有的 JSON Schema 验证能力

- **测试影响**：
  - 需要重写与目录类型相关的单元测试
  - 新增模块系统和模板系统的测试用例
  - 需要数据迁移的集成测试

- **文档影响**：
  - 需要更新用户文档，介绍新的模块和模板概念
  - 需要开发文档，说明如何开发新的模块
