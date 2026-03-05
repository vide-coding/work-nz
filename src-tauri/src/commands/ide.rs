use crate::models::GitRepository;
use crate::AppState;
use tauri::State;

/// 打开仓库 in IDE
#[tauri::command]
pub async fn ide_open_repo(
    state: State<'_, AppState>,
    repo_id: String,
    ide: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    let repo = sqlx::query_as::<_, GitRepository>(
        "SELECT * FROM git_repositories WHERE id = ?",
    )
    .bind(&repo_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| format!("获取仓库失败: {}", e))?;

    // 获取仓库路径
    let repo_path = std::path::Path::new(&repo.path);
    if !repo_path.exists() {
        return Err("仓库路径不存在".to_string());
    }

    // 如果有指定的 IDE 配置，使用它
    if let Some(ide_config) = ide {
        let exe_path = ide_config
            .get("exePath")
            .and_then(|v| v.as_str())
            .ok_or("IDE 可执行路径未指定")?;

        let args = ide_config
            .get("args")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let mut command = std::process::Command::new(exe_path);
        command.arg(repo_path);
        for arg in args {
            command.arg(arg);
        }

        command
            .spawn()
            .map_err(|e| format!("启动 IDE 失败: {}", e))?;

        return Ok(serde_json::json!({
            "ok": true,
            "message": format!("已在 IDE 中打开: {}", repo.name)
        }));
    }

    // 否则，尝试使用系统默认方式打开
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", repo_path.to_str().unwrap_or(".")])
            .spawn()
            .map_err(|e| format!("打开仓库失败: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(repo_path)
            .spawn()
            .map_err(|e| format!("打开仓库失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(repo_path)
            .spawn()
            .map_err(|e| format!("打开仓库失败: {}", e))?;
    }

    Ok(serde_json::json!({
        "ok": true,
        "message": format!("已打开仓库: {}", repo.name)
    }))
}

/// 在终端中打开仓库
#[tauri::command]
pub async fn open_in_terminal(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<serde_json::Value, String> {
    let repo = sqlx::query_as::<_, GitRepository>(
        "SELECT * FROM git_repositories WHERE id = ?",
    )
    .bind(&repo_id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| format!("获取仓库失败: {}", e))?;

    // 获取仓库路径
    let repo_path = std::path::Path::new(&repo.path);
    if !repo_path.exists() {
        return Err("仓库路径不存在".to_string());
    }

    let repo_path_str = repo_path
        .to_str()
        .ok_or("无效的路径")?;

    // 根据不同操作系统打开终端
    #[cfg(target_os = "windows")]
    {
        // 尝试使用 Windows Terminal，如果不存在则使用 cmd
        let wt_result = std::process::Command::new("wt.exe")
            .args(["-d", repo_path_str])
            .spawn();

        if wt_result.is_err() {
            // 回退到 cmd
            std::process::Command::new("cmd")
                .args(["/C", "start", "cmd", "/K", "cd", "/d", repo_path_str])
                .spawn()
                .map_err(|e| format!("打开终端失败: {}", e))?;
        }
    }

    #[cfg(target_os = "macos")]
    {
        // 使用 AppleScript 在 Terminal.app 中打开
        let script = format!(
            r#"tell application "Terminal" to do script "cd \"{}\"""#,
            repo_path_str.replace("\"", "\\\"")
        );

        std::process::Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|e| format!("打开终端失败: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // 尝试常见的 Linux 终端模拟器
        let terminals = [
            ("gnome-terminal", vec!["--working-directory", repo_path_str]),
            ("konsole", vec!["--workdir", repo_path_str]),
            ("xfce4-terminal", vec!["--working-directory", repo_path_str]),
            ("terminator", vec!["--working-directory", repo_path_str]),
            ("alacritty", vec!["--working-directory", repo_path_str]),
            ("kitty", vec!["--directory", repo_path_str]),
        ];

        let mut spawned = false;
        for (term, args) in &terminals {
            if std::process::Command::new(term)
                .args(args)
                .spawn()
                .is_ok()
            {
                spawned = true;
                break;
            }
        }

        if !spawned {
            return Err("无法找到可用的终端模拟器".to_string());
        }
    }

    Ok(serde_json::json!({
        "ok": true,
        "message": format!("已在终端中打开: {}", repo.name)
    }))
}
