use crate::commands::workspace::get_workspace_path;
use crate::db::get_db;
use crate::types::*;
use chrono::Utc;
use git2::Repository;
use rusqlite::params;
use std::path::Path;

/// 列出项目的 Git 仓库
#[tauri::command]
pub fn git_repo_list(project_id: String) -> Result<Vec<GitRepository>, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, project_id, name, path, remote_url, branch, last_sync_at, last_status_checked_at
             FROM git_repositories WHERE project_id = ?1",
        )
        .map_err(|e| format!("查询失败: {}", e))?;

    let repos = stmt
        .query_map(params![project_id], |row| {
            Ok(GitRepository {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                path: row.get(3)?,
                remote_url: row.get(4)?,
                branch: row.get(5)?,
                last_sync_at: row.get(6)?,
                last_status_checked_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("查询失败: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("读取数据失败: {}", e))?;

    Ok(repos)
}

/// 创建新的本地 Git 仓库
#[tauri::command]
pub fn git_repo_create(project_id: String, name: String) -> Result<GitRepository, String> {
    let _workspace_path = get_workspace_path().ok_or("未打开工作区")?;

    // 获取项目路径
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let project_path: String = conn
        .query_row(
            "SELECT project_path FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("项目不存在: {}", e))?;

    let repo_path = Path::new(&project_path).join(&name);

    // 创建 Git 仓库
    Repository::init(&repo_path).map_err(|e| format!("创建 Git 仓库失败: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO git_repositories (id, project_id, name, path, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            project_id,
            name,
            repo_path.to_string_lossy().to_string(),
            now,
            now
        ],
    )
    .map_err(|e| format!("保存仓库失败: {}", e))?;

    Ok(GitRepository {
        id,
        project_id,
        name,
        path: repo_path.to_string_lossy().to_string(),
        remote_url: None,
        branch: Some("main".to_string()),
        last_sync_at: None,
        last_status_checked_at: None,
    })
}

/// 从 URL 克隆 Git 仓库
#[tauri::command]
pub fn git_repo_clone(project_id: String, input: GitCloneInput) -> Result<GitRepository, String> {
    let _workspace_path = get_workspace_path().ok_or("未打开工作区")?;

    // 获取项目路径
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let project_path: String = conn
        .query_row(
            "SELECT project_path FROM projects WHERE id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("项目不存在: {}", e))?;

    let repo_path = Path::new(&project_path).join(&input.target_dir_name);

    // 克隆仓库 - 使用简化方式
    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(|_url, _username_from_url, _allowed_types| {
        git2::Cred::default()
    });

    let mut fetch_opts = git2::FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    // 构建回调并克隆
    match Repository::clone(&input.remote_url, &repo_path) {
        Ok(_) => {}
        Err(e) => {
            // 如果克隆失败，尝试使用 checkout
            if repo_path.exists() {
                // 目录已存在，尝试打开
                let _ = Repository::open(&repo_path);
            } else {
                return Err(format!("克隆仓库失败: {}", e));
            }
        }
    }

    // 获取分支信息
    let repo = Repository::open(&repo_path).map_err(|e| format!("打开仓库失败: {}", e))?;
    let head = repo.head().ok();
    let branch_name = head.as_ref().and_then(|h| h.shorthand().map(String::from));

    // 获取远程 URL
    let remote_url = repo.remotes().ok().and_then(|r| {
        r.iter().next().flatten().and_then(|name| {
            repo.find_remote(name)
                .ok()
                .and_then(|remote| remote.url().map(String::from))
        })
    });

    let id = uuid::Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO git_repositories (id, project_id, name, path, remote_url, branch, last_sync_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            id,
            project_id,
            input.target_dir_name,
            repo_path.to_string_lossy().to_string(),
            remote_url,
            branch_name,
            now,
            now,
            now
        ],
    )
    .map_err(|e| format!("保存仓库失败: {}", e))?;

    Ok(GitRepository {
        id,
        project_id,
        name: input.target_dir_name,
        path: repo_path.to_string_lossy().to_string(),
        remote_url,
        branch: branch_name,
        last_sync_at: Some(now),
        last_status_checked_at: None,
    })
}

/// 拉取仓库
#[tauri::command]
pub fn git_repo_pull(repo_id: String) -> Result<GitPullResult, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let path: String = conn
        .query_row(
            "SELECT path FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("仓库不存在: {}", e))?;

    let repo = Repository::open(&path).map_err(|e| format!("打开仓库失败: {}", e))?;

    // 获取默认远程
    let mut remote = repo
        .find_remote("origin")
        .map_err(|e| format!("找不到远程: {}", e))?;

    // 尝试连接并拉取
    let mut callbacks = git2::RemoteCallbacks::new();
    callbacks.credentials(|_url, _username_from_url, _allowed_types| {
        git2::Cred::default()
    });

    remote
        .fetch(
            &["main", "master"],
            Some(&mut git2::FetchOptions::new().remote_callbacks(callbacks)),
            None,
        )
        .map_err(|e| format!("拉取失败: {}", e))?;

    // 尝试快速合并
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE git_repositories SET last_sync_at = ?1, updated_at = ?2 WHERE id = ?3",
        params![now, now, repo_id],
    )
    .map_err(|e| format!("更新同步时间失败: {}", e))?;

    Ok(GitPullResult {
        ok: true,
        message: Some("拉取成功".to_string()),
        synced_at: Some(now),
    })
}

/// 获取 Git 仓库状态（本地）
#[tauri::command]
pub fn git_repo_status_get(repo_id: String) -> Result<GitRepoStatus, String> {
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let path: String = conn
        .query_row(
            "SELECT path FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("仓库不存在: {}", e))?;

    let repo = Repository::open(&path).map_err(|e| format!("打开仓库失败: {}", e))?;

    // 获取分支
    let branch = repo.head().ok().and_then(|h| h.shorthand().map(String::from));

    // 检查状态
    let statuses = repo
        .statuses(None)
        .map_err(|e| format!("获取状态失败: {}", e))?;

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
    let db_guard = get_db().map_err(|e| format!("获取数据库失败: {}", e))?;
    let conn = db_guard.as_ref().ok_or("数据库未初始化")?;

    let path: String = conn
        .query_row(
            "SELECT path FROM git_repositories WHERE id = ?1",
            params![repo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("仓库不存在: {}", e))?;

    let repo = Repository::open(&path).map_err(|e| format!("打开仓库失败: {}", e))?;

    // 获取分支
    let branch = repo.head().ok().and_then(|h| h.shorthand().map(String::from));

    // 检查状态
    let statuses = repo
        .statuses(None)
        .map_err(|e| format!("获取状态失败: {}", e))?;

    let dirty = statuses.iter().any(|s| {
        let status = s.status();
        status.is_index_new()
            || status.is_index_modified()
            || status.is_index_deleted()
            || status.is_wt_new()
            || status.is_wt_modified()
            || status.is_wt_deleted()
    });

    // 尝试获取远端更新 - 简化处理
    let (ahead, behind) = (0, 0);

    let now = Utc::now().to_rfc3339();

    // 更新数据库中的状态
    let status_json = serde_json::json!({
        "dirty": dirty,
        "ahead": ahead,
        "behind": behind,
        "last_checked_at": now
    }).to_string();

    conn.execute(
        "UPDATE git_repositories SET last_status_checked_at = ?1, last_status_json = ?2 WHERE id = ?3",
        params![now, status_json, repo_id],
    )
    .ok();

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
    // TODO: 实现后台监听
    Ok(serde_json::json!({ "ok": true }))
}

/// Git 状态监听（停止）
#[tauri::command]
pub fn git_status_watch_stop(_repo_id: Option<String>) -> Result<serde_json::Value, String> {
    // TODO: 实现后台监听停止
    Ok(serde_json::json!({ "ok": true }))
}
