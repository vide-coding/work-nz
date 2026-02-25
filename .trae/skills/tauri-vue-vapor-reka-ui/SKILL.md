---
name: "tauri-vue-vapor-reka-ui"
description: "指导 Tauri + Vue 3.6（Vapor）+ Reka UI 的工程结构、IPC 与主题。用户要搭建/调整前端架构、UI 组件与主题切换时调用。"
---

# Tauri + Vue 3.6 Vapor + Reka UI

本技能用于在本项目技术栈下，给出可落地的前端工程组织方式、与 Rust 后端的调用边界、以及主题切换（含持久化到工作区）的实现套路。

## 官方初始化命令（优先）

以官方文档推荐的脚手架为准：

- Tauri：使用 Create Tauri App 创建包含前端模板的工程（Windows/Node 包管理器均可）。
  - `npm create tauri-app@latest my-app`（按提示选择 Vue 模板）
- Vite：若先做纯前端原型，可用 Vite 官方脚手架创建 Vue 项目。
  - `npm create vite@latest my-vue-app -- --template vue`

说明：本项目要求最终集成 Tauri，因此更推荐直接走 Create Tauri App，一次性得到 `src-tauri/`（Rust）与前端工程。

## 推荐工程结构（前端）

- `src/pages/`：页面（工作区选择、项目总览、项目详情/工作台）
- `src/components/`：页面无关组件（对话框、表格、Tag、卡片等）
- `src/features/`：按业务域拆分（workspace/projects/git/ide/files）
- `src/stores/`：全局状态（工作区选择、主题、最近项目等）
- `src/lib/tauri/`：对 `invoke` 的薄封装（统一错误处理/类型）
- `src/styles/`：主题 tokens（CSS 变量）与 Reka UI 适配

## IPC（invoke）最佳实践

目标：前端不直接拼接路径/执行系统操作；所有“文件系统、Git、IDE 启动、数据库”统一走 Rust 命令。

- 命令命名：`workspace_*`、`project_*`、`git_*`、`ide_*`、`files_*`
- 错误策略：Rust 侧把错误映射为稳定的错误码 + message；前端只做展示/重试
- 进度事件：对 `git clone/pull` 这类长任务，用事件推送进度，前端订阅更新 UI

示例（前端 invoke 薄封装，函数级中文注释）：

```ts
import { invoke } from '@tauri-apps/api/core'

type CommandError = { code: string; message: string }

/**
 * 统一调用 Rust 命令并规范化错误。
 * 用于所有需要 invoke 的场景，避免页面/组件自行处理异常结构。
 */
export async function invokeCmd<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    const err = e as Partial<CommandError>
    throw new Error(err.message ?? '命令执行失败')
  }
}
```

## 主题切换（全局 + 项目）

### 目标能力

- 全局主题：`浅色 / 深色 / 跟随系统 / 自定义(可扩展)`
- 项目展示属性：主题色、标签色等（影响列表/卡片/侧边栏高亮）
- 持久化：写入“工作区数据”而不是系统全局（不同工作区独立）

### 实施建议

- 使用 CSS 变量作为主题 tokens，组件样式只引用变量，不硬编码颜色
- `ThemeMode` 存储在工作区设置；`ProjectDisplay` 存储在项目元数据
- Reka UI：保持“unstyled primitives”，用你的 CSS tokens 驱动视觉一致性

## Vapor 使用注意

Vue 3.6 Vapor 仍可能处于快速演进阶段；建议：

- 先确保“非 Vapor 模式”可稳定跑通（功能优先）
- 将 Vapor 的开启与组件级改造作为可选增强，逐步迁移
- 避免依赖不稳定的编译期细节；在 CI 中固定 Vue/Vite 版本，减少升级噪音

