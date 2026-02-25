---
name: "tauri-git2"
description: "指导在 Tauri(Rust) 中集成 git2(libgit2)：clone/pull、鉴权、进度事件与错误处理。实现项目拉取/更新代码时调用。"
---

# Git 集成（git2 / libgit2）

本技能用于在“单个项目”维度实现 Git 拉取能力：

- `git clone`：把远端仓库拉到项目目录
- `git pull`：在已有仓库上拉取更新（含 fast-forward/merge 策略）
- 进度反馈：前端显示下载/解析/checkout 进度

## 选择 git2 的原因

- 不依赖系统安装 Git（降低用户环境差异）
- 可在 Rust 内更细粒度拿到进度与错误

如果你更倾向“与用户现有 Git 配置一致（SSH Agent/凭据管理）”，也可以改用系统 `git` 命令执行，本技能以 `git2` 为主。

## 进度事件建议

- 在 Rust 侧将进度映射为统一事件：`git:progress`、`git:done`、`git:error`
- payload 建议：`{ projectId, phase, received, total, message }`
- 前端订阅事件并驱动进度条/日志区域

示例（函数级中文注释，仅示意回调组织方式）：

```rust
use git2::{Cred, FetchOptions, RemoteCallbacks};

/**
 * 创建 git2 的回调集合：用于鉴权与进度上报。
 * 用在 clone/pull 的 FetchOptions 中。
 */
pub fn build_callbacks() -> RemoteCallbacks<'static> {
  let mut callbacks = RemoteCallbacks::new();

  callbacks.credentials(|_url, username_from_url, _allowed| {
    // 个人应用建议优先：SSH agent / 默认凭据；必要时再扩展为 token 输入。
    if let Some(username) = username_from_url {
      Cred::ssh_key_from_agent(username)
    } else {
      Cred::default()
    }
  });

  callbacks.transfer_progress(|stats| {
    // 这里可以将 stats.received_objects()/total_objects() 发送为 Tauri event
    let _ = (stats.received_objects(), stats.total_objects());
    true
  });

  callbacks
}

/**
 * 组装 FetchOptions，封装鉴权与进度回调。
 * 用于 pull/clone 复用同一套逻辑。
 */
pub fn build_fetch_options() -> FetchOptions<'static> {
  let mut fo = FetchOptions::new();
  fo.remote_callbacks(build_callbacks());
  fo
}
```

## Windows 注意点

- 路径长度：仓库层级深时可能触发长路径问题；尽量把工作区放在较短路径（如 `D:\ws`）
- 文件占用：IDE/索引器可能占用 `.git/index`；pull 失败需提示用户重试/关闭占用程序

