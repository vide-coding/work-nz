---
name: "tauri-windows-ide-launcher"
description: "指导在 Windows 上用 Tauri(Rust) 打开项目到主流 IDE，并实现工作区默认 IDE + 项目覆盖。实现 open-in-IDE 功能时调用。"
---

# Windows IDE Launcher（Tauri Rust 侧）

本技能用于实现：

- 工作区配置默认 IDE
- 项目可覆盖默认 IDE（例如某项目用 WebStorm，另一个用 Rider）
- 一键打开项目目录到 IDE（VS Code、JetBrains、Visual Studio 等）

## 数据模型建议

- `WorkspaceSettings.defaultIde`：默认 IDE 标识 + 启动方式
- `Project.ideOverride`：可选覆盖（为空则继承工作区）

IDE 启动方式建议用“可序列化的启动配置”，而不是硬编码：

- `kind: "vscode" | "jetbrains" | "visualstudio" | "custom"`
- `command`: 可执行文件路径或命令（如 `code`）
- `argsTemplate`: 例如 `["{path}"]` 或 JetBrains 的额外参数

## 启动策略（优先级）

1. 若用户显式选择了 IDE 配置：直接按配置启动
2. 若用户未配置：尝试探测常见安装路径/已注册命令
3. 若仍失败：提示用户在工作区设置中选择可执行文件路径

## Rust 启动实现要点

- Windows 路径包含空格时，尽量使用 `Command::new(exe).args([...])`，不要自行拼接整条命令字符串
- 对于 `code` 这类依赖 PATH 的命令，启动失败时给出“未找到命令/请安装或配置路径”的错误

示例（函数级中文注释，仅示意）：

```rust
use std::path::Path;
use std::process::Command;

/**
 * 使用用户配置的 IDE 命令打开项目路径。
 * 用于“打开到 IDE”功能，要求对路径与参数做安全拼接。
 */
pub fn open_in_ide(command: &str, args_template: &[String], project_path: &Path) -> std::io::Result<()> {
  let path_str = project_path.to_string_lossy().to_string();
  let args: Vec<String> = args_template
    .iter()
    .map(|a| a.replace("{path}", &path_str))
    .collect();

  Command::new(command).args(args).spawn()?;
  Ok(())
}
```

## 主流 IDE 建议默认项

- VS Code：`code`（或用户选择 `Code.exe`）
- JetBrains 系列：建议让用户直接选择 `idea64.exe` / `webstorm64.exe` / `rider64.exe` 等
- Visual Studio：`devenv.exe`（打开解决方案时更合适；纯目录项目可走 VS Code）

## 安全与体验

- 即便是个人应用，也应限制参数模板仅能替换 `{path}`，避免被误配成任意命令注入
- 失败时返回清晰错误：`IDE_NOT_FOUND`、`IDE_LAUNCH_FAILED`、`INVALID_IDE_CONFIG`

