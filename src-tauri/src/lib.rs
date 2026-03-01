mod db;
mod types;
mod commands;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_devtools::init())
        .invoke_handler(tauri::generate_handler![
            // Workspace commands
            workspace_init_or_open,
            workspace_list_recent,
            workspace_settings_get,
            workspace_settings_update,
            workspace_update_alias,
            workspace_remove_from_recent,
            // Project commands
            projects_list,
            project_create,
            project_get,
            project_update,
            project_delete,
            // Git commands
            git_repo_list,
            git_repo_create,
            git_repo_clone,
            git_repo_update,
            git_extract_repo_name,
            git_repo_pull,
            git_repo_status_get,
            git_repo_status_check,
            git_status_watch_start,
            git_status_watch_stop,
            git_repo_list,
            git_repo_create,
            git_repo_clone,
            git_repo_pull,
            git_repo_status_get,
            git_repo_status_check,
            git_status_watch_start,
            git_status_watch_stop,
            // Filesystem commands
            project_fs_tree,
            fs_read_text,
            fs_create_dir,
            fs_delete,
            fs_rename,
            // Directory type commands
            dir_types_list,
            dir_type_create_custom,
            dir_type_update,
            project_dirs_list,
            project_dir_create_or_update,
            preview_detect,
            // IDE commands
            ide_list_supported,
            ide_open_repo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
