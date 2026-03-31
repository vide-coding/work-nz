## Context

MyFlow (迈流) 是一个 Tauri + Vue 3 项目，目前 Workspace 页面已有 FileBrowser 组件支持文件夹浏览和创建，但项目页面缺少独立的文件管理能力。

现有代码基础：

- `filesystem.rs` - 已实现 `fs_create_dir`、`fs_delete`、`fs_rename`、`fs_read_text` 命令
- `FileBrowser.vue` - Workspace 页面已有文件浏览组件
- `FilePreview.vue` - 文件预览组件

需要新增：

- 项目页面的文件模块视图
- 创建文件功能
- 打开文件（调用系统默认程序）
- 拖拽外部文件到项目目录

## Goals / Non-Goals

**Goals:**

- 在项目页面添加文件资源管理模块
- 支持创建、打开、重命名、删除文件和文件夹
- 支持拖拽外部文件到项目目录

**Non-Goals:**

- 不实现文件内容编辑（只支持预览和打开）
- 不实现文件搜索/过滤
- 不实现文件复制/粘贴
- 不实现多选批量操作

## Decisions

### 1. 新建 FileModuleView 组件

**选择**: 在 `src/components/module/` 下新建 `FileModuleView.vue`

**原因**: 与现有 `GitModuleView.vue` 保持一致的模式，每个模块独立视图

### 2. 复用现有 Rust 命令

**选择**: 扩展 `filesystem.rs`，添加 `fs_create_file` 和 `fs_open_external` 命令

**原因**:

- 现有命令已覆盖大部分需求
- 保持 Rust 层统一，避免前端自行调用 shell
- 便于权限控制

### 3. 拖拽实现方式

**选择**: 使用 HTML5 Drag and Drop API + Tauri 文件操作

**原因**:

- Tauri 提供 `tauri://drag-drop` 事件监听
- 避免引入额外依赖
- 跨平台兼容性好

### 4. 新增 Tauri 权限

**选择**: 在 `src-tauri/capabilities/default.json` 添加:

- `fs:allow-read-text-file`
- `fs:allow-write-text-file`
- `shell:allow-open`

## Risks / Trade-offs

| 风险         | 影响             | 缓解措施                              |
| ------------ | ---------------- | ------------------------------------- |
| 大文件拖拽   | 可能导致 UI 阻塞 | 文件操作在 Rust 后端异步执行          |
| 文件名冲突   | 覆盖已有文件     | 拖拽时检测冲突，提示用户确认          |
| 路径安全问题 | 路径遍历攻击     | 所有路径操作基于项目根目录，禁止 `..` |

## Open Questions

1. **文件创建默认内容**: 新建文件时是否需要默认模板？
   - 暂定：创建空文件，用户可后续用外部编辑器打开
2. **拖拽文件夹**: 是否支持拖入整个文件夹？
   - 暂定：仅支持拖入单个或多个文件
