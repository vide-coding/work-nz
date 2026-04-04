use crate::commands::db_helpers::{map_git_repository_row, map_project_row};
use crate::with_db;
use crate::commands::workspace::get_workspace_path;
use crate::types::*;
use chrono::Utc;
use git2::Repository;
use rusqlite::params;
use std::fs;
use std::path::Path;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// 列出项目的 Git 仓库（可按目录筛选）
#[tauri::command]
pub fn git_repo_list(
    project_id: String,
    folder: Option<String>,
) -> Result<Vec<GitRepository>, String> {
    with_db!(conn, {
        if let Some(folder_name) = folder {
            let mut stmt = conn
                .prepare(
                    "SELECT id, project_id, name, path, folder, remote_url, branch, description, last_sync_at, last_status_checked_at, ide_override_json, sort_order
                     FROM git_repositories WHERE project_id = ?1 AND folder = ?2 ORDER BY sort_order ASC, created_at DESC",
                )
                .map_err(|e| format!("查询失败: {}", e))?;

            let result: Vec<GitRepository> = stmt
                .query_map(params![project_id, folder_name], map_git_repository_row)
                .map_err(|e| format!("查询失败: {}", e))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("读取数据失败: {}", e))?;
            Ok(result)
        } else {
            let mut stmt = conn
                .prepare(
                    "SELECT id, project_id, name, path, folder, remote_url, branch, description, last_sync_at, last_status_checked_at, ide_override_json, sort_order
                     FROM git_repositories WHERE project_id = ?1 ORDER BY sort_order ASC, created_at DESC",
                )
                .map_err(|e| format!("查询失败: {}", e))?;

            let result: Vec<GitRepository> = stmt
                .query_map(params![project_id], map_git_repository_row)
                .map_err(|e| format!("查询失败: {}", e))?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("读取数据失败: {}", e))?;
            Ok(result)
        }
    })
}

/// 创建新的本地 Git 仓库
#[tauri::command]
pub async fn git_repo_create(
    project_id: String,
    name: String,
) -> Result<GitRepository, String> {
    let _workspace_path = get_workspace_path().ok_or("未打开工作区")?;

    let project_path: String = with_db!(conn, {
        conn.query_row(
            "SELECT project_path FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("项目不存在: {}", e))
    })?;

    let code_dir = Path::new(&project_path).join("code");
    fs::create_dir_all(&code_dir).map_err(|e| format!("创建 code 目录失败: {}", e))?;

    let repo_path = code_dir.join(&name);

    let repo_path_clone = repo_path.clone();
    tokio::task::spawn_blocking(move || {
        Repository::init(&repo_path_clone).map_err(|e| format!("创建 Git 仓库失败: {}", e))
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))??;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let folder = "code".to_string();

    let sort_order: i32 = with_db!(conn, {
        let max_sort: Option<i32> = conn
            .query_row(
                "SELECT MAX(sort_order) FROM git_repositories WHERE project_id = ?1",
                params![project_id],
                |row| row.get(0),
            )
            .unwrap_or(None);
        let next_sort = max_sort.unwrap_or(0) + 1;

        conn.execute(
            "INSERT INTO git_repositories (id, project_id, name, path, folder, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id,
                project_id,
                name,
                repo_path.to_string_lossy().to_string(),
                folder,
                now,
                now,
                next_sort
            ],
        )
        .map_err(|e| format!("保存仓库失败: {}", e))?;
        Ok::<i32, String>(next_sort)
    })?;

    Ok(GitRepository {
        id,
        project_id,
        name,
        path: repo_path.to_string_lossy().to_string(),
        folder: Some(folder),
        remote_url: None,
        branch: Some("main".to_string()),
        description: None,
        last_sync_at: None,
        last_status_checked_at: None,
        ide_override: None,
        sort_order: Some(sort_order),
    })
}

/// 从 URL 克隆 Git 仓库（支持进度和重试）
#[tauri::command]
pub async fn git_repo_clone(
    app_handle: AppHandle,
    project_id: String,
    input: GitCloneInput,
) -> Result<GitRepository, String> {
    let _workspace_path = get_workspace_path().ok_or("未打开工作区")?;

    let project_path: String = with_db!(conn, {
        conn.query_row(
            "SELECT project_path FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("项目不存在: {}", e))
    })?;

    let target_dir = input.target_directory.as_deref().unwrap_or("code");
    let target_base = Path::new(&project_path).join(target_dir);
    fs::create_dir_all(&target_base).map_err(|e| format!("创建目标目录失败: {}", e))?;

    let repo_path = target_base.join(&input.target_dir_name);
    let remote_url = input.remote_url.clone();
    let repo_path_clone = repo_path.clone();
    let app_handle_clone = app_handle.clone();
    let clone_task_id = uuid::Uuid::new_v4().to_string();

    let _ = app_handle.emit(
        "git:clone:progress",
        GitCloneProgress {
            stage: GitCloneStage::Starting,
            progress: None,
            message: format!("开始克隆仓库 {}", input.target_dir_name),
            retry_count: 0,
            error: None,
        },
    );

    let max_retries = 3;
    let mut last_error = String::new();

    for attempt in 0..max_retries {
        if attempt > 0 {
            let _ = app_handle.emit(
                "git:clone:progress",
                GitCloneProgress {
                    stage: GitCloneStage::Starting,
                    progress: None,
                    message: format!(
                        "重试克隆 ({}/{}): {}",
                        attempt + 1,
                        max_retries,
                        input.target_dir_name
                    ),
                    retry_count: attempt as u32,
                    error: Some(last_error.clone()),
                },
            );
            tokio::time::sleep(Duration::from_secs(2)).await;
        }

        let result = tokio::task::spawn_blocking({
            let repo_path_clone = repo_path_clone.clone();
            let remote_url = remote_url.clone();
            let app_handle_clone = app_handle_clone.clone();
            let _clone_task_id = clone_task_id.clone();

            move || {
                let _ = app_handle_clone.emit(
                    "git:clone:progress",
                    GitCloneProgress {
                        stage: GitCloneStage::Connecting,
                        progress: Some(0.0),
                        message: "正在连接远程仓库...".to_string(),
                        retry_count: attempt as u32,
                        error: None,
                    },
                );

                if repo_path_clone.exists() {
                    let _ = fs::remove_dir_all(&repo_path_clone);
                }

                match Repository::clone(&remote_url, &repo_path_clone) {
                    Ok(_) => {
                        let _ = app_handle_clone.emit(
                            "git:clone:progress",
                            GitCloneProgress {
                                stage: GitCloneStage::Completed,
                                progress: Some(100.0),
                                message: "克隆完成".to_string(),
                                retry_count: attempt as u32,
                                error: None,
                            },
                        );
                        Ok(())
                    }
                    Err(e) => {
                        let error_msg = format!("克隆失败: {}", e);
                        let _ = app_handle_clone.emit(
                            "git:clone:progress",
                            GitCloneProgress {
                                stage: GitCloneStage::Failed,
                                progress: None,
                                message: error_msg.clone(),
                                retry_count: attempt as u32,
                                error: Some(error_msg),
                            },
                        );
                        Err(e)
                    }
                }
            }
        })
        .await
        .map_err(|e| format!("任务执行失败: {}", e))?;

        match result {
            Ok(()) => break,
            Err(_) if attempt < max_retries - 1 => {
                last_error = format!("尝试 {} 失败", attempt + 1);
                continue;
            }
            Err(e) => {
                last_error = format!("克隆失败: {}", e);
                return Err(last_error);
            }
        }
    }

    let repo_path_clone2 = repo_path.clone();
    let (branch_name, remote_url_result) = tokio::task::spawn_blocking(move || {
        let repo =
            Repository::open(&repo_path_clone2).map_err(|e| format!("打开仓库失败: {}", e))?;
        let head = repo.head().ok();
        let branch = head.as_ref().and_then(|h| h.shorthand().map(String::from));
        let remote = repo.remotes().ok().and_then(|r| {
            r.iter()
                .next()
                .flatten()
                .and_then(|name| repo.find_remote(name).ok().and_then(|remote| remote.url().map(String::from)))
        });
        Ok::<(Option<String>, Option<String>), String>((branch, remote))
    })
    .await
    .map_err(|e| format!("任务执行失败: {}", e))??;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let repo_name = input.name.unwrap_or_else(|| input.target_dir_name.clone());
    let folder = repo_path
        .parent()
        .and_then(|parent| parent.strip_prefix(&project_path).ok())
        .and_then(|rel| rel.components().next())
        .and_then(|c| c.as_os_str().to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "root".to_string());

    let sort_order: i32 = with_db!(conn, {
        let max_sort: Option<i32> = conn
            .query_row(
                "SELECT MAX(sort_order) FROM git_repositories WHERE project_id = ?1",
                params![project_id],
                |row| row.get(0),
            )
            .unwrap_or(None);
        let next_sort = max_sort.unwrap_or(0) + 1;

        conn.execute(
            "INSERT INTO git_repositories (id, project_id, name, path, folder, remote_url, branch, last_sync_at, created_at, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                project_id,
                repo_name,
                repo_path.to_string_lossy().to_string(),
                folder,
                remote_url,
                branch_name,
                now,
                now,
                now,
                next_sort
            ],
        )
        .map_err(|e| format!("保存仓库失败: {}", e))?;
        Ok::<i32, String>(next_sort)
    })?;

    Ok(GitRepository {
        id,
        project_id,
        name: repo_name,
        path: repo_path.to_string_lossy().to_string(),
        folder: Some(folder),
        remote_url: remote_url_result,
        branch: branch_name,
        description: None,
        last_sync_at: Some(now),
        last_status_checked_at: None,
        ide_override: None,
        sort_order: Some(sort_order),
    })
}

/// Git 仓库更新输入
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoUpdateInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub ide_override: Option<IdeConfig>,
}

/// 更新 Git 仓库信息（名称、描述、IDE覆盖）
#[tauri::command]
pub fn git_repo_update(
    repo_id: String,
    patch: GitRepoUpdateInput,
) -> Result<GitRepository, String> {
    with_db!(conn, {
        let now = Utc::now().to_rfc3339();

        let current_repo: GitRepository = conn
            .query_row(
                "SELECT id, project_id, name, path, folder, remote_url, branch, description, last_sync_at, last_status_checked_at, ide_override_json, sort_order
                 FROM git_repositories WHERE id = ?1",
                params![repo_id],
                map_git_repository_row,
            )
            .map_err(|e| format!("仓库不存在: {}", e))?;

        let name = patch.name.unwrap_or(current_repo.name);
        let description = patch.description.or(current_repo.description);
        let ide_override = patch.ide_override.or(current_repo.ide_override);

        let ide_override_json = ide_override
            .as_ref()
            .and_then(|i| serde_json::to_string(i).ok());

        conn.execute(
            "UPDATE git_repositories SET name = ?1, description = ?2, ide_override_json = ?3, updated_at = ?4 WHERE id = ?5",
            params![name, description, ide_override_json, now, repo_id],
        )
        .map_err(|e| format!("更新仓库失败: {}", e))?;

        let mut stmt = conn
            .prepare(
                "SELECT id, project_id, name, path, folder, remote_url, branch, description, last_sync_at, last_status_checked_at, ide_override_json, sort_order
                 FROM git_repositories WHERE id = ?1",
            )
            .map_err(|e| format!("查询失败: {}", e))?;

        let repo: GitRepository = stmt
            .query_row(params![repo_id], map_git_repository_row)
            .map_err(|e| format!("读取仓库失败: {}", e))?;
        Ok(repo)
    })
}

/// 重新排序 Git 仓库
#[tauri::command]
pub fn git_repo_reorder(
    project_id: String,
    ordered_ids: Vec<String>,
) -> Result<Vec<GitRepository>, String> {
    with_db!(conn, {
        conn.execute("BEGIN TRANSACTION", params![])
            .map_err(|e| format!("开始事务失败: {}", e))?;

        for (index, repo_id) in ordered_ids.iter().enumerate() {
            let sort_order = index as i32;
            conn.execute(
                "UPDATE git_repositories SET sort_order = ?1 WHERE id = ?2 AND project_id = ?3",
                params![sort_order, repo_id, project_id],
            )
            .map_err(|e| {
                let _ = conn.execute("ROLLBACK", params![]);
                format!("更新排序失败: {}", e)
            })?;
        }

        conn.execute("COMMIT", params![])
            .map_err(|e| format!("提交事务失败: {}", e))?;

        let mut stmt = conn
            .prepare(
                "SELECT id, project_id, name, path, folder, remote_url, branch, description, last_sync_at, last_status_checked_at, ide_override_json, sort_order
                 FROM git_repositories WHERE project_id = ?1 ORDER BY sort_order ASC",
            )
            .map_err(|e| format!("查询失败: {}", e))?;

        let repos: Vec<GitRepository> = stmt
            .query_map(params![project_id], map_git_repository_row)
            .map_err(|e| format!("查询失败: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("读取数据失败: {}", e))?;
        Ok(repos)
    })
}

/// 从 URL 提取仓库名称
#[tauri::command]
pub fn git_extract_repo_name(remote_url: String) -> Result<String, String> {
    let url = remote_url.trim();
    let name = if url.ends_with(".git") {
        &url[..url.len() - 4]
    } else {
        url
    };
    let repo_name = if name.contains('/') {
        name.rsplit('/').next().unwrap_or(name)
    } else if name.contains(':') {
        name.rsplit(':').next().unwrap_or(name)
    } else {
        name
    };
    Ok(repo_name.to_string())
}

/// 拉取仓库
#[tauri::command]
pub fn git_repo_pull(repo_id: String) -> Result<GitPullResult, String> {
    let path: String = with_db!(conn, {
        conn.query_row(
            "SELECT path FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("仓库不存在: {}", e))
    })?;

    let repo = Repository::open(&path).map_err(|e| format!("打开仓库失败: {}", e))?;

    let mut remote = match repo.find_remote("origin") {
        Ok(r) => r,
        Err(e) => {
            return Ok(GitPullResult {
                ok: false,
                message: None,
                synced_at: None,
                error: Some(format!("找不到远程 origin: {}", e)),
            });
        }
    };

    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(|_url, _username_from_url, _allowed_types| git2::Cred::default());

    match remote.fetch(
        &["main", "master"],
        Some(&mut git2::FetchOptions::new().remote_callbacks(callbacks)),
        None,
    ) {
        Ok(_) => {}
        Err(e) => {
            return Ok(GitPullResult {
                ok: false,
                message: None,
                synced_at: None,
                error: Some(format!("拉取失败: {}", e)),
            });
        }
    }

    let now = Utc::now().to_rfc3339();

    with_db!(conn, {
        conn.execute(
            "UPDATE git_repositories SET last_sync_at = ?1, updated_at = ?2 WHERE id = ?3",
            params![now, now, repo_id],
        )
        .map_err(|e| format!("更新同步时间失败: {}", e))
    })?;

    Ok(GitPullResult {
        ok: true,
        message: Some("拉取成功".to_string()),
        synced_at: Some(now),
        error: None,
    })
}

/// 获取 Git 仓库状态（本地）
#[tauri::command]
pub fn git_repo_status_get(repo_id: String) -> Result<GitRepoStatus, String> {
    let path: String = with_db!(conn, {
        conn.query_row(
            "SELECT path FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("仓库不存在: {}", e))
    })?;

    let repo = Repository::open(&path).map_err(|e| format!("打开仓库失败: {}", e))?;
    let branch = repo.head().ok().and_then(|h| h.shorthand().map(String::from));
    let statuses = repo.statuses(None).map_err(|e| format!("获取状态失败: {}", e))?;

    let dirty = statuses.iter().any(|s| {
        let status = s.status();
        status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_wt_new()
            || status.is_wt_modified()
            || status.is_wt_deleted()
    });

    let now = Utc::now().to_rfc3339();

    Ok(GitRepoStatus {
        repo_id,
        branch,
        dirty,
        ahead: 0,
        behind: 0,
        last_checked_at: now,
        network: NetworkState::Unknown,
        last_error: None,
    })
}

/// 检查 Git 仓库状态（允许网络请求）
#[tauri::command]
pub fn git_repo_status_check(repo_id: String) -> Result<GitRepoStatus, String> {
    let path: String = with_db!(conn, {
        conn.query_row(
            "SELECT path FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("仓库不存在: {}", e))
    })?;

    let repo = Repository::open(&path).map_err(|e| format!("打开仓库失败: {}", e))?;
    let branch = repo.head().ok().and_then(|h| h.shorthand().map(String::from));
    let statuses = repo.statuses(None).map_err(|e| format!("获取状态失败: {}", e))?;

    let dirty = statuses.iter().any(|s| {
        let status = s.status();
        status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_wt_new()
            || status.is_wt_modified()
            || status.is_wt_deleted()
    });

    let (ahead, behind) = (0, 0);
    let now = Utc::now().to_rfc3339();
    let status_json =
        serde_json::json!({ "dirty": dirty, "ahead": ahead, "behind": behind, "last_checked_at": now })
            .to_string();

    with_db!(conn, {
        conn.execute(
            "UPDATE git_repositories SET last_status_checked_at = ?1, last_status_json = ?2 WHERE id = ?3",
            params![now, status_json, repo_id],
        )
        .ok();
        Ok::<(), String>(())
    })?;

    Ok(GitRepoStatus {
        repo_id,
        branch,
        dirty,
        ahead,
        behind,
        last_checked_at: now,
        network: NetworkState::Unknown,
        last_error: None,
    })
}

/// Git 状态监听（启动）
#[tauri::command]
pub fn git_status_watch_start(_repo_id: Option<String>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "ok": true }))
}

/// Git 状态监听（停止）
#[tauri::command]
pub fn git_status_watch_stop(_repo_id: Option<String>) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({ "ok": true }))
}

/// 删除 Git 仓库（仅从数据库删除记录，保留本地目录）
#[tauri::command]
pub fn git_repo_delete(
    repo_id: String,
    delete_local: bool,
) -> Result<serde_json::Value, String> {
    let (path, name): (String, String) = with_db!(conn, {
        conn.query_row(
            "SELECT path, name FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("仓库不存在: {}", e))
    })?;

    with_db!(conn, {
        conn.execute("DELETE FROM git_repositories WHERE id = ?1", params![repo_id])
            .map_err(|e| format!("删除仓库记录失败: {}", e))
    })?;

    if delete_local {
        let repo_path = Path::new(&path);
        if repo_path.exists() {
            fs::remove_dir_all(repo_path).map_err(|e| format!("删除本地目录失败: {}", e))?;
        }
    }

    Ok(serde_json::json!({
        "ok": true,
        "deleted": name,
        "local_deleted": delete_local
    }))
}

/// 扫描 code 目录下的 Git 仓库并自动导入数据库
#[tauri::command]
pub fn git_repo_scan(project_id: String) -> Result<serde_json::Value, String> {
    let project: crate::types::Project = with_db!(conn, {
        conn.query_row(
            "SELECT id, name, description, project_path, display_json, ide_override_json, visible, updated_at FROM projects WHERE id = ?1",
            params![project_id],
            map_project_row,
        )
        .map_err(|e| format!("项目不存在：{}", e))
    })?;

    let project_path = Path::new(&project.project_path);

    with_db!(conn, {
        git_repo_scan_with_conn(conn, project_id, project_path)
    })
}

/// 内部扫描函数（复用已有连接）—— 由 dir_type.rs 调用
pub fn git_repo_scan_internal(
    conn: &rusqlite::Connection,
    project_id: String,
    project_path: &Path,
) -> Result<serde_json::Value, String> {
    git_repo_scan_with_conn(conn, project_id, project_path)
}

/// 内部扫描函数（带连接参数）
pub fn git_repo_scan_with_conn(
    conn: &rusqlite::Connection,
    project_id: String,
    project_path: &Path,
) -> Result<serde_json::Value, String> {
    if !project_path.exists() || !project_path.is_dir() {
        return Ok(serde_json::json!({ "ok": true, "scanned": Vec::<String>::new() }));
    }

    let mut stmt = conn
        .prepare("SELECT path FROM git_repositories WHERE project_id = ?1")
        .map_err(|e| format!("查询仓库失败：{}", e))?;

    let existing_paths: std::collections::HashSet<String> = stmt
        .query_map(params![project_id], |row| Ok(row.get(0)?))
        .map_err(|e| format!("读取仓库失败：{}", e))?
        .filter_map(|r| r.ok())
        .collect();

    drop(stmt);

    let mut scanned = Vec::new();
    let now = Utc::now().to_rfc3339();

    let entries =
        fs::read_dir(project_path).map_err(|e| format!("读取目录失败：{}", e))?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if dir_name.starts_with('.') {
            continue;
        }

        let path_str = path.to_string_lossy().to_string();
        if existing_paths.contains(&path_str) {
            continue;
        }

        if !path.join(".git").exists() {
            continue;
        }

        let repo = match Repository::open(&path) {
            Ok(r) => r,
            Err(_) => continue,
        };

        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let remote_url = repo
            .find_remote("origin")
            .ok()
            .and_then(|r| r.url().map(String::from));

        let branch = repo.head().ok().and_then(|h| h.shorthand().map(String::from));

        let folder = path
            .parent()
            .and_then(|parent| parent.strip_prefix(project_path).ok())
            .and_then(|rel| rel.components().next())
            .and_then(|c| c.as_os_str().to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "root".to_string());

        let id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO git_repositories (id, project_id, name, path, folder, remote_url, branch, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id, project_id, name, path_str, folder, remote_url, branch, now, now],
        )
        .map_err(|e| format!("保存仓库失败：{}", e))?;

        scanned.push(format!("{} ({})", name, folder));
    }

    Ok(serde_json::json!({
        "ok": true,
        "scanned": scanned
    }))
}

/// 监视目录变化（顶级文件/文件夹的创建和删除）
#[tauri::command]
pub async fn watch_directory(
    app_handle: AppHandle,
    directory: String,
) -> Result<String, String> {
    use notify::{Watcher, RecursiveMode};
    use std::path::PathBuf;
    use std::sync::mpsc;

    let path = PathBuf::from(&directory);

    if !path.exists() {
        return Err("目录不存在".to_string());
    }

    let (tx, rx) = mpsc::channel();
    let mut watcher = notify::recommended_watcher(tx)
        .map_err(|e| format!("创建文件监视器失败: {}", e))?;

    // 仅监视顶级目录，非递归
    watcher
        .watch(&path, RecursiveMode::NonRecursive)
        .map_err(|e| format!("开始监视失败: {}", e))?;

    let watch_id = uuid::Uuid::new_v4().to_string();
    let watch_id_clone = watch_id.clone();

    // 在后台线程中处理事件
    std::thread::spawn(move || {
        for event in rx {
            match event {
                Ok(notify::Event {
                    kind: notify::EventKind::Create(_) | notify::EventKind::Remove(_),
                    ..
                }) => {
                    // 向前端发送事件
                    let _ = app_handle.emit("git:directory:changed", &watch_id_clone);
                }
                _ => {}
            }
        }
    });

    Ok(watch_id)
}

/// 停止监视目录
#[tauri::command]
pub async fn unwatch_directory(_watch_id: String) -> Result<(), String> {
    // 简化实现 - 可以通过全局状态管理来改进
    Ok(())
}
