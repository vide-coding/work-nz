---
name: 'tauri-sqlite-diesel'
description: '指导 Tauri(Rust) 侧使用 SQLite + Diesel：迁移、连接池、命令边界与路径策略。实现本地数据持久化或写查询命令时调用。'
---

# SQLite + Diesel（Tauri Rust 侧）

本技能用于把“工作区内的本地数据”落到 SQLite，并用 Diesel 管理 schema/查询，同时适配 Tauri 的命令调用模型。

## 数据文件位置（工作区内）

- 工作区根目录由用户选择
- 建议约定应用数据目录：`<workspace>/.pm-app/`
  - 数据库：`<workspace>/.pm-app/db.sqlite3`
  - 迁移/版本：`<workspace>/.pm-app/meta.json`（可选）

目标：完全可移植、可备份、可拷贝工作区即迁移全部数据。

## 迁移策略

- 开发期：可用 `diesel_cli` 生成迁移与本地调试
- 交付期：建议使用 `diesel_migrations`（嵌入迁移），应用启动时自动跑迁移

理由：面向个人用户时，安装 CLI 依赖成本高；嵌入迁移更易用。

## 连接池与线程模型

Diesel 的 SQLite 连接是同步阻塞的；在 Tauri 命令里要避免阻塞 UI 线程：

- 建连接池（`r2d2`）放在全局 state
- 对 DB 读写使用 `tauri::async_runtime::spawn_blocking`

示例（函数级中文注释，仅示意结构）：

```rust
use std::path::{Path, PathBuf};

use diesel::r2d2::{ConnectionManager, Pool};
use diesel::sqlite::SqliteConnection;

pub type DbPool = Pool<ConnectionManager<SqliteConnection>>;

/**
 * 根据工作区路径计算数据库文件路径，并确保应用数据目录存在。
 * 用于工作区首次选择/切换时初始化本地持久化。
 */
pub fn workspace_db_path(workspace_root: &Path) -> std::io::Result<PathBuf> {
  let dir = workspace_root.join(".pm-app");
  std::fs::create_dir_all(&dir)?;
  Ok(dir.join("db.sqlite3"))
}

/**
 * 创建 SQLite 连接池。
 * 用于 Tauri 应用启动或切换工作区后，刷新全局 DB state。
 */
pub fn create_pool(database_url: &str) -> anyhow::Result<DbPool> {
  let manager = ConnectionManager::<SqliteConnection>::new(database_url);
  let pool = Pool::builder().max_size(8).build(manager)?;
  Ok(pool)
}
```

## 命令边界（Rust API 设计）

- 前端传参只用 `workspace_id` / `project_id` 等逻辑标识
- Rust 侧负责把 id 映射到真实路径/DB
- 返回 DTO（扁平、稳定）给前端；不要直接暴露 Diesel 模型类型

## Windows 注意点

- 路径统一使用 Rust `Path/PathBuf`，不要在前端拼接 `\\`
- DB 文件可能被杀毒/同步软件占用：写入失败要给可读错误与重试
