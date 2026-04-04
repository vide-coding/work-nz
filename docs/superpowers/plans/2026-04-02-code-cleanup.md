# Code Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除项目中重复代码和结构混乱问题：提取 Rust 数据库连接宏、提取 row 映射函数、前端 loading/error 状态提取、移除重复函数、统一类型定义。

**Architecture:** 两层重构策略——Rust 层通过宏和辅助函数消除命令间重复代码；Frontend 层通过 composable 工具函数消除跨 composable 重复模式，同时统一类型定义。

**Tech Stack:** Tauri (Rust), Vue 3 + TypeScript + Pinia, Vitest

---

## File Impact Map

### New Files
- `src-tauri/src/commands/db_helpers.rs` — Rust 数据库连接宏和 row 映射辅助函数
- `src/composables/useAsync.ts` — 前端通用 loading/error 状态封装
- `src/composables/usePath.ts` — 路径拼接工具函数
- `src/types/locale.ts` — 统一的语言代码类型

### Modified Files
- `src-tauri/src/commands/mod.rs` — 导出新 db_helpers 模块
- `src-tauri/src/commands/git.rs` — 使用 db 宏 + row 映射函数（消除 6 处重复）
- `src-tauri/src/commands/project.rs` — 使用 db 宏 + row 映射函数（消除 4 处重复）
- `src-tauri/src/commands/module.rs` — 使用 db 宏 + config schema 解析函数
- `src-tauri/src/commands/directory.rs` — 使用 db 宏
- `src-tauri/src/commands/workspace.rs` — 使用 db 宏
- `src-tauri/src/commands/template.rs` — 使用 db 宏
- `src-tauri/src/commands/dir_type.rs` — 使用 db 宏
- `src/composables/useDirectoryNavigation.ts` — 移除重复的 getDirectoryCapabilitiesFromModule，导入自 useModuleRegistry
- `src/composables/useFileModule.ts` — 使用 usePath 辅助函数
- `src/composables/useSettings.ts` — 可选：统一加载逻辑（向后兼容，不强制改）
- `src/composables/useTaskModule.ts` — 移除硬编码默认值，依赖 moduleRegistry
- `src/composables/useDirectoryTemplate.ts` — 可选：使用 useAsync 统一
- `src/types/settings.ts` — 移除未使用的 GlobalSettingsResult，统一 LanguageCode
- `src/types/index.ts` — 移除未使用的 NetworkState
- `src/views/ProjectWorkspaceView.vue` — 移除局部 NavItem 类型定义，导入共享类型

---

## Task 1: Rust — 创建 db_helpers.rs 数据库辅助模块

**Files:**
- Create: `src-tauri/src/commands/db_helpers.rs`

- [ ] **Step 1: 创建 db_helpers.rs**

文件内容：

```rust
//! 数据库操作辅助函数和宏
//! 消除命令文件中重复的数据库连接和 row 映射模式

use crate::types::*;
use rusqlite::{Connection, Row, Result as SqliteResult};

/// 获取数据库连接的简写模式，返回错误信息字符串
/// 使用示例: with_db!(conn => { conn.prepare(...) })
#[macro_export]
macro_rules! with_db {
    ($conn:ident => $body:expr) => {{
        let db_guard = $crate::db::get_db()
            .map_err(|e| format!("获取数据库失败: {}", e))?;
        let $conn = db_guard.as_ref().ok_or("数据库未初始化")?;
        $body
    }};
}

/// 辅助函数：从 Row 中解析 ide_override_json 字段
pub fn parse_ide_override(row: &Row, idx: usize) -> Option<IdeConfig> {
    row.get::<_, Option<String>>(idx)
        .ok()
        .flatten()
        .and_then(|j| serde_json::from_str(&j).ok())
}

/// 辅助函数：从 Row 中解析可选 JSON 字段（通用）
pub fn parse_optional_json<T: serde::de::DeserializeOwned>(row: &Row, idx: usize) -> Option<T> {
    row.get::<_, Option<String>>(idx)
        .ok()
        .flatten()
        .and_then(|j| serde_json::from_str(&j).ok())
}

/// 从 git_repositories 行映射为 GitRepository
/// cols: id, project_id, name, path, folder, remote_url, branch, description,
///       last_sync_at, last_status_checked_at, ide_override_json(idx=10), sort_order
pub fn map_git_repository_row(row: &Row) -> SqliteResult<GitRepository> {
    Ok(GitRepository {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        path: row.get(3)?,
        folder: row.get(4)?,
        remote_url: row.get(5)?,
        branch: row.get(6)?,
        description: row.get(7)?,
        last_sync_at: row.get(8)?,
        last_status_checked_at: row.get(9)?,
        ide_override: parse_ide_override(row, 10),
        sort_order: row.get(11)?,
    })
}

/// 从 projects 行映射为 Project
/// cols: id, name, description, project_path, display_json(idx=4), ide_override_json(idx=5), visible, updated_at
pub fn map_project_row(row: &Row) -> SqliteResult<Project> {
    Ok(Project {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        project_path: row.get(3)?,
        display: parse_optional_json(row, 4),
        ide_override: parse_optional_json(row, 5),
        visible: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

/// 从 modules 行映射为 Module（简化版，用于 module_list）
pub fn map_module_row(row: &Row) -> SqliteResult<Module> {
    let capabilities_json: String = row.get(5)?;
    let config_schema_json: String = row.get(6)?;
    let default_config_json: String = row.get(7)?;

    let capabilities: Vec<String> = serde_json::from_str(&capabilities_json).unwrap_or_default();
    let config_schema: ModuleConfigSchema =
        serde_json::from_str(&config_schema_json).unwrap_or(ModuleConfigSchema {
            schema_type: "object".to_string(),
            title: None,
            description: None,
            properties: std::collections::HashMap::new(),
            required: None,
        });
    let default_config: serde_json::Value =
        serde_json::from_str(&default_config_json).unwrap_or(serde_json::json!({}));

    Ok(Module {
        id: row.get(0)?,
        key: row.get(1)?,
        name: row.get(2)?,
        description: row.get(3)?,
        version: row.get(4)?,
        capabilities,
        config_schema,
        default_config,
        icon: row.get(8)?,
        is_built_in: row.get::<_, i32>(9)? != 0,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}
```

- [ ] **Step 2: 更新 commands/mod.rs 导出新模块**

在 `pub mod workspace;` 后添加：

```rust
pub mod db_helpers;
pub use db_helpers::*;
```

- [ ] **Step 3: 验证编译**

Run: `cd src-tauri && cargo check 2>&1`
Expected: 编译成功，无错误

- [ ] **Step 4: 提交**

```bash
git add src-tauri/src/commands/db_helpers.rs src-tauri/src/commands/mod.rs
git commit -m "refactor(rust): add db_helpers module with with_db! macro and row mapping functions"
```

---

## Task 2: Rust — 重构 git.rs 使用 db_helpers

**Files:**
- Modify: `src-tauri/src/commands/git.rs`

- [ ] **Step 1: 读取 git.rs 完整内容，找到所有需要修改的位置**

使用 Grep 工具搜索 `let db_guard = get_db()` 确认所有位置。

- [ ] **Step 2: 替换所有数据库连接模式**

在 git.rs 中，将以下模式的代码：
```rust
let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
let conn = db_guard.as_ref().ok_or("数据库未初始化")?;
```
替换为：
```rust
with_db!(conn => {
```

同时在方法体结尾加 `});` 包裹（注意保持原有的作用域逻辑）。

- [ ] **Step 3: 替换 git_repo_list 中的两个 row 映射**

将第一个 `git_repo_list`（带 folder 筛选）中 `|row| { Ok(GitRepository { ... }) }` 替换为 `map_git_repository_row`：
```rust
query_map(params![project_id, folder_name], map_git_repository_row)
```

将第二个 `git_repo_list`（不带筛选）中的同样替换。

- [ ] **Step 4: 替换其他位置的 row 映射**

在 `git_repo_create`、`git_repo_clone`、`git_repo_update`、`git_repo_reorder` 中找到 GitRepository 行映射，用 `map_git_repository_row` 替换。同时在 `git_repo_scan` 中找到 Project 行映射，替换为 `map_project_row`（需要 import）。

- [ ] **Step 5: 验证编译**

Run: `cd src-tauri && cargo check 2>&1`
Expected: 编译成功

- [ ] **Step 6: 提交**

```bash
git add src-tauri/src/commands/git.rs
git commit -m "refactor(git): use with_db! macro and row mapping helpers"
```

---

## Task 3: Rust — 重构 project.rs 使用 db_helpers

**Files:**
- Modify: `src-tauri/src/commands/project.rs`

- [ ] **Step 1: 读取 project.rs 找到所有数据库连接位置**

使用 Grep 搜索 `let db_guard = get_db()` 在该文件中的位置。

- [ ] **Step 2: 替换 projects_list 中的数据库连接和 row 映射**

将 `let db_guard = ...` 和 `let conn = ...` 替换为 `with_db!(conn => {`，row 映射部分改为调用 `map_project_row`。

- [ ] **Step 3: 替换 project_get 和 project_update 中的数据库连接**

- [ ] **Step 4: 验证编译**

Run: `cd src-tauri && cargo check 2>&1`
Expected: 编译成功

- [ ] **Step 5: 提交**

```bash
git add src-tauri/src/commands/project.rs
git commit -m "refactor(project): use with_db! macro and row mapping helpers"
```

---

## Task 4: Rust — 重构剩余命令文件使用 with_db! 宏

**Files:**
- Modify: `src-tauri/src/commands/module.rs`
- Modify: `src-tauri/src/commands/directory.rs`
- Modify: `src-tauri/src/commands/workspace.rs`
- Modify: `src-tauri/src/commands/template.rs`
- Modify: `src-tauri/src/commands/dir_type.rs`
- Modify: `src-tauri/src/commands/filesystem.rs`

- [ ] **Step 1: 对每个文件依次执行以下步骤：**

对每个文件，用 Grep 找到所有 `let db_guard = get_db()` 出现位置，将：

```rust
let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
let conn = db_guard.as_ref().ok_or("数据库未初始化")?;
```

替换为：

```rust
with_db!(conn => {
```

然后将方法体的内容用 `});` 包裹。如果方法有多个 db_guard 块，每个都需要单独替换。

**module.rs 额外注意**: `module_list`、`module_get`、`module_get_by_key` 中的 row 映射用 `map_module_row` 替换。

**注意**: `git.rs` 和 `project.rs` 已经在 Task 2/3 处理过，不要重复修改。

- [ ] **Step 2: 验证编译**

Run: `cd src-tauri && cargo check 2>&1`
Expected: 编译成功

- [ ] **Step 3: 提交**

```bash
git add src-tauri/src/commands/module.rs src-tauri/src/commands/directory.rs src-tauri/src/commands/workspace.rs src-tauri/src/commands/template.rs src-tauri/src/commands/dir_type.rs src-tauri/src/commands/filesystem.rs
git commit -m "refactor(commands): use with_db! macro in remaining command files"
```

---

## Task 5: Frontend — 创建 useAsync.ts 通用异步操作封装

**Files:**
- Create: `src/composables/useAsync.ts`

- [ ] **Step 1: 创建 useAsync.ts**

```typescript
import type { Ref } from 'vue'

export interface AsyncState {
  loading: Ref<boolean>
  error: Ref<string | null>
}

/**
 * 通用异步操作封装，消除 composables 间重复的 loading/error 状态管理
 *
 * @param state - 包含 loading 和 error 的响应式状态对象
 * @param operation - 异步操作函数
 * @param errorMessage - 操作失败时的默认错误信息
 * @returns 操作结果，失败返回 null
 *
 * @example
 * const state = { loading: ref(false), error: ref<string>(null) }
 * const result = await useAsync(state, () => api.someCall(), '操作失败')
 */
export async function useAsync<T>(
  state: AsyncState,
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> {
  state.loading.value = true
  state.error.value = null
  try {
    return await operation()
  } catch (e) {
    state.error.value = e instanceof Error ? e.message : errorMessage
    return null
  } finally {
    state.loading.value = false
  }
}

/**
 * 不设置 loading 状态的异步操作（用于不需要显示 loading 的快速操作）
 */
export async function useAsyncSilent<T>(
  state: { error: Ref<string | null> },
  operation: () => Promise<T>,
  errorMessage: string
): Promise<T | null> {
  state.error.value = null
  try {
    return await operation()
  } catch (e) {
    state.error.value = e instanceof Error ? e.message : errorMessage
    return null
  }
}
```

- [ ] **Step 2: 验证 TypeScript 类型检查**

Run: `pnpm exec vue-tsc --noEmit 2>&1 | head -30`
Expected: 无 useAsync 相关错误

- [ ] **Step 3: 提交**

```bash
git add src/composables/useAsync.ts
git commit -m "feat(composables): add useAsync utility for loading/error state management"
```

---

## Task 6: Frontend — 重构 useDirectoryNavigation.ts 移除重复函数

**Files:**
- Modify: `src/composables/useDirectoryNavigation.ts`

- [ ] **Step 1: 读取文件找到重复函数位置（第 58-66 行）**

确认 `getDirectoryCapabilities` 和 `getDirectoryCapabilitiesFromModule` 两个函数的内容。

- [ ] **Step 2: 移除 getDirectoryCapabilitiesFromModule，保留 getDirectoryCapabilities 调用 useModuleRegistry**

删除第 62-66 行的 `function getDirectoryCapabilitiesFromModule`，将第 58-60 行改为：

```typescript
function getDirectoryCapabilities(directory: Directory): ModuleCapability[] {
  if (!directory.moduleId) return []
  const module = moduleRegistry.get(directory.moduleId)
  return module?.capabilities ?? []
}
```

（这是 `useModuleRegistry.ts` 中 `getDirectoryCapabilities` 的等价实现，保持同文件内聚性。实际 `useModuleRegistry` 中的同名函数应改为 `getModuleCapabilities` 以消除歧义——见 Task 8。）

- [ ] **Step 3: 验证编译**

Run: `pnpm exec vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/composables/useDirectoryNavigation.ts
git commit -m "refactor: remove duplicate getDirectoryCapabilitiesFromModule"
```

---

## Task 7: Frontend — 重构 useFileModule.ts 提取路径拼接函数

**Files:**
- Modify: `src/composables/useFileModule.ts`

- [ ] **Step 1: 读取文件找到路径拼接重复位置（第 251-253、281、339、358 行）**

确认这些位置的路径拼接逻辑一致。

- [ ] **Step 2: 在 useFileModule.ts 文件顶部添加辅助函数**

在文件开头的 import 后、导出函数前添加：

```typescript
/**
 * 构建文件的完整路径
 * @param relativeBase - 目录的 relativePath（可为 null/undefined）
 * @param currentPath - 当前浏览路径
 * @param target - 目标文件名或路径
 */
function buildFullPath(relativeBase: string | null | undefined, currentPath: string, target: string): string {
  return relativeBase
    ? `${relativeBase}/${currentPath}/${target}`
    : `${currentPath}/${target}`
}
```

- [ ] **Step 3: 替换所有路径拼接处**

将所有：
```typescript
const fullPath = directory.relativePath
  ? `${directory.relativePath}/${currentPath.value}/${name}`
  : `${currentPath.value}/${name}`
```
替换为：
```typescript
const fullPath = buildFullPath(directory.relativePath, currentPath.value, name)
```

将所有：
```typescript
const fullPath = directory.relativePath ? `${directory.relativePath}/${path}` : path
```
替换为：
```typescript
const fullPath = buildFullPath(directory.relativePath, '', path)
```

- [ ] **Step 4: 验证编译**

Run: `pnpm exec vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/composables/useFileModule.ts
git commit -m "refactor: extract path building logic into buildFullPath helper"
```

---

## Task 8: Frontend — useModuleRegistry.ts 重命名导出函数消除歧义

**Files:**
- Modify: `src/composables/useModuleRegistry.ts`

- [ ] **Step 1: 读取文件找到第 511 行附近的导出函数**

确认 `getDirectoryCapabilities` 的导出位置。

- [ ] **Step 2: 重命名 useModuleRegistry 中的 getDirectoryCapabilities 为 getModuleCapabilities**

将 `src/composables/useModuleRegistry.ts` 第 511 行的：
```typescript
export function getDirectoryCapabilities(directory: Directory): ModuleCapability[] {
```
改为：
```typescript
export function getModuleCapabilities(directory: Directory): ModuleCapability[] {
```
同时更新函数内部注释。

- [ ] **Step 3: 验证无其他调用方受影响**

Run: `grep -r "getDirectoryCapabilities" src/ --include="*.ts" --include="*.vue"`
Expected: 仅剩 `useDirectoryNavigation.ts` 中的本地定义（Task 6 已处理）

- [ ] **Step 4: 验证编译**

Run: `pnpm exec vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add src/composables/useModuleRegistry.ts
git commit -m "refactor: rename getDirectoryCapabilities to getModuleCapabilities to avoid confusion"
```

---

## Task 9: Frontend — 统一语言代码类型

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/types/index.ts`
- Modify: `src/components/common/LanguageSelector.vue`
- Modify: `src/components/workspace/WorkspaceHeader.vue`
- Modify: `src/views/ProjectsView.vue`
- Modify: `src/views/WorkspaceView.vue`

- [ ] **Step 1: 创建 src/types/locale.ts**

```typescript
export type LocaleCode = 'zh-CN' | 'en-US'

export const SUPPORTED_LOCALES: { code: LocaleCode; label: string }[] = [
  { code: 'zh-CN', label: '简体中文' },
  { code: 'en-US', label: 'English' },
]
```

- [ ] **Step 2: 更新 src/types/settings.ts**

将 `LanguageCode` 类型改为从 locale.ts 导入：
```typescript
export type { LocaleCode as LanguageCode } from './locale'
```

移除未使用的 `GlobalSettingsResult`。

- [ ] **Step 3: 更新 src/types/index.ts**

添加导入 `export type { LocaleCode } from './locale'`（如果需要全局可用）。

- [ ] **Step 4: 更新 LanguageSelector.vue**

将 `src/components/common/LanguageSelector.vue` 中所有内联的 `'zh-CN' | 'en-US'` 类型替换为导入的 `LocaleCode`（如果该文件有类型注解）。

- [ ] **Step 5: 更新 WorkspaceHeader.vue**

将文件中所有内联的语言类型替换为从 `@/types/locale` 导入的 `LocaleCode`。

- [ ] **Step 6: 更新 ProjectsView.vue 和 WorkspaceView.vue**

同上，替换内联语言类型为 LocaleCode。

- [ ] **Step 7: 验证编译**

Run: `pnpm exec vue-tsc --noEmit 2>&1 | head -30`
Expected: 无类型错误

- [ ] **Step 8: 提交**

```bash
git add src/types/locale.ts src/types/settings.ts src/types/index.ts src/components/common/LanguageSelector.vue src/components/workspace/WorkspaceHeader.vue src/views/ProjectsView.vue src/views/WorkspaceView.vue
git commit -m "refactor: consolidate LocaleCode type and remove duplicate LanguageCode"
```

---

## Task 10: Frontend — 移除未使用的类型

**Files:**
- Modify: `src/types/settings.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: 从 src/types/settings.ts 移除 GlobalSettingsResult**

搜索确认无任何文件导入 `GlobalSettingsResult`，然后删除。

- [ ] **Step 2: 从 src/types/index.ts 移除 NetworkState**

搜索确认无任何文件导入 `NetworkState`，然后删除。

- [ ] **Step 3: 验证编译**

Run: `pnpm exec vue-tsc --noEmit 2>&1 | head -20`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add src/types/settings.ts src/types/index.ts
git commit -m "refactor: remove unused GlobalSettingsResult and NetworkState types"
```

---

## Task 11: Frontend — 统一 NavItem 类型

**Files:**
- Modify: `src/views/ProjectWorkspaceView.vue`
- Modify: `src/components/workspace/WorkspaceSidebar.vue`

- [ ] **Step 1: 读取 WorkspaceSidebar.vue 找到 NavItem 类型定义**

确认该文件中 NavItem 的具体结构。

- [ ] **Step 2: 将 WorkspaceSidebar 的 NavItem 类型移到 src/types/ 或直接在 WorkspaceSidebar 中导出**

在 WorkspaceSidebar.vue 的 script setup 区域添加：
```typescript
export interface NavItem {
  id: string
  label: string
  icon: string
  // ... 具体字段根据文件内容确定
}
```

- [ ] **Step 3: 更新 ProjectWorkspaceView.vue**

将本地的 NavItem 类型定义替换为从 WorkspaceSidebar 导入，或合并为统一类型。

- [ ] **Step 4: 验证编译**

Run: `pnpm exec vue-tsc --noEmit 2>&1 | head -20`
Expected: 无类型错误

- [ ] **Step 5: 提交**

```bash
git add src/views/ProjectWorkspaceView.vue src/components/workspace/WorkspaceSidebar.vue
git commit -m "refactor: consolidate NavItem type across components"
```

---

## Task 12: 前端组件文件整理（低优先级）

**Files:**
- Modify: 移动文件或更新导入路径

- [ ] **Step 1: 确认当前组件结构**

列出 `src/components/` 根目录下的 .vue 文件，确认 MarkdownRenderer.vue、MarkdownThemeSelector.vue、SmartMarkdownRenderer.vue、SettingsBar.vue 的位置。

- [ ] **Step 2: 决定整理策略**

如果这些组件在项目多个地方被使用（用 Grep 确认），则不移动，仅记录到文档。如果只在少数地方使用，可以移动到 `components/common/`。

- [ ] **Step 3: 如需移动，更新所有导入路径**

如果决定移动，用 Grep 找到所有导入，更新路径。

- [ ] **Step 4: 验证编译**

Run: `pnpm exec vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: 提交**

如果做了更改则提交，否则跳过此任务。

---

## Task 13: 全量验证

**Files:**
- All modified files

- [ ] **Step 1: Rust 编译和测试**

Run: `cd src-tauri && cargo build 2>&1`
Expected: 编译成功

Run: `cd src-tauri && cargo test 2>&1`
Expected: 所有测试通过

- [ ] **Step 2: Frontend 类型检查**

Run: `pnpm exec vue-tsc --noEmit 2>&1`
Expected: 无类型错误

- [ ] **Step 3: Frontend 测试**

Run: `pnpm test:run 2>&1`
Expected: 所有 Vitest 测试通过

- [ ] **Step 4: 应用启动验证**

Run: `pnpm tauri dev 2>&1` (等待 30 秒后手动检查窗口是否正常启动，或用后台任务)
Expected: 应用正常启动，无 panic 或错误

- [ ] **Step 5: 提交最终验证**

```bash
git add -A
git commit -m "refactor: complete code cleanup - remove duplication and fix types"
```
