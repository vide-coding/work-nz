use serde::{Deserialize, Serialize};

/// 主题模式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    Light,
    Dark,
    System,
    Custom,
}

impl Default for ThemeMode {
    fn default() -> Self {
        ThemeMode::System
    }
}

/// 支持的 IDE 类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SupportedIdeKind {
    Vscode,
    VisualStudio,
    Jetbrains,
    Custom,
}

/// IDE 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IdeConfig {
    pub kind: SupportedIdeKind,
    pub name: String,
    pub exe_path: String,
    pub args: Option<Vec<String>>,
}

/// 工作区设置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSettings {
    pub theme_mode: ThemeMode,
    pub custom_theme_id: Option<String>,
    pub default_ide: Option<IdeConfig>,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        WorkspaceSettings {
            theme_mode: ThemeMode::System,
            custom_theme_id: None,
            default_ide: None,
        }
    }
}

/// 工作区信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub path: String,
    pub db_path: String,
    pub last_opened_at: String,
    pub settings: Option<WorkspaceSettings>,
    pub alias: Option<String>,
}

/// 项目显示配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDisplay {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme_color: Option<String>,
}

/// Git 仓库
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepository {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_status_checked_at: Option<String>,
}

/// 网络状态
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NetworkState {
    Online,
    Offline,
    Unknown,
}

/// Git 仓库状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRepoStatus {
    pub repo_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    pub dirty: bool,
    pub ahead: i32,
    pub behind: i32,
    pub last_checked_at: String,
    pub network: NetworkState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

/// 项目
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub project_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display: Option<ProjectDisplay>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ide_override: Option<IdeConfig>,
    pub updated_at: String,
}

/// 文件节点
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub path: String,
    pub name: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileNode>>,
}

/// Git 克隆输入
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitCloneInput {
    pub remote_url: String,
    pub target_dir_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
}

/// Git 拉取结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitPullResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub synced_at: Option<String>,
}

/// 目录类型种类
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum DirectoryTypeKind {
    Code,
    Docs,
    UiDesign,
    ProjectPlanning,
    Custom,
}

/// 目录类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryType {
    pub id: String,
    pub kind: DirectoryTypeKind,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// 项目目录
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDirectory {
    pub id: String,
    pub project_id: String,
    pub dir_type_id: String,
    pub relative_path: String,
    pub created_at: String,
    pub updated_at: String,
}

/// 预览类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PreviewKind {
    Image,
    Markdown,
    Text,
}

/// 预览检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewDetectResult {
    pub kind: PreviewKind,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_workspace_settings_default() {
        let settings = WorkspaceSettings::default();
        assert_eq!(settings.theme_mode, ThemeMode::System);
        assert_eq!(settings.custom_theme_id, None);
        assert_eq!(settings.default_ide, None);
    }

    #[test]
    fn test_project_display_serialization() {
        let display = ProjectDisplay {
            theme_mode: Some("dark".to_string()),
            theme_color: Some("#4F46E5".to_string()),
        };

        let json = serde_json::to_string(&display).unwrap();
        assert!(json.contains("dark"));
        assert!(json.contains("#4F46E5"));
    }

    #[test]
    fn test_ide_config_serialization() {
        let ide = IdeConfig {
            kind: SupportedIdeKind::Vscode,
            name: "VS Code".to_string(),
            exe_path: "C:\\Users\\Test\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe".to_string(),
            args: Some(vec!["--reuse-window".to_string()]),
        };

        let json = serde_json::to_string(&ide).unwrap();
        assert!(json.contains("vscode"));
        assert!(json.contains("VS Code"));
    }

    #[test]
    fn test_git_pull_result_serialization() {
        let result = GitPullResult {
            ok: true,
            message: Some("Pull successful".to_string()),
            synced_at: Some("2024-01-01T00:00:00Z".to_string()),
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("ok"));
        assert!(json.contains("true"));
    }

    #[test]
    fn test_preview_kind() {
        let _ = PreviewKind::Image;
        let _ = PreviewKind::Markdown;
        let _ = PreviewKind::Text;
    }

    #[test]
    fn test_directory_type_kind() {
        let _ = DirectoryTypeKind::Code;
        let _ = DirectoryTypeKind::Docs;
        let _ = DirectoryTypeKind::UiDesign;
        let _ = DirectoryTypeKind::ProjectPlanning;
        let _ = DirectoryTypeKind::Custom;
    }

    #[test]
    fn test_theme_mode() {
        let _ = ThemeMode::Light;
        let _ = ThemeMode::Dark;
        let _ = ThemeMode::System;
        let _ = ThemeMode::Custom;
    }

    #[test]
    fn test_network_state() {
        let _ = NetworkState::Online;
        let _ = NetworkState::Offline;
        let _ = NetworkState::Unknown;
    }

    #[test]
    fn test_supported_ide_kind() {
        let _ = SupportedIdeKind::Vscode;
        let _ = SupportedIdeKind::VisualStudio;
        let _ = SupportedIdeKind::Jetbrains;
        let _ = SupportedIdeKind::Custom;
    }

    #[test]
    fn test_file_node() {
        let node = FileNode {
            path: "test/file.rs".to_string(),
            name: "file.rs".to_string(),
            kind: "file".to_string(),
            children: None,
        };

        assert_eq!(node.kind, "file");
        assert!(node.children.is_none());

        let dir_node = FileNode {
            path: "test".to_string(),
            name: "test".to_string(),
            kind: "dir".to_string(),
            children: Some(vec![]),
        };

        assert_eq!(dir_node.kind, "dir");
        assert!(dir_node.children.is_some());
    }

    #[test]
    fn test_git_clone_input() {
        let input = GitCloneInput {
            remote_url: "https://github.com/test/repo.git".to_string(),
            target_dir_name: "my-repo".to_string(),
            branch: Some("main".to_string()),
        };

        let json = serde_json::to_string(&input).unwrap();
        assert!(json.contains("my-repo"));
        assert!(json.contains("main"));
    }

    #[test]
    fn test_directory_type() {
        let dt = DirectoryType {
            id: "test-id".to_string(),
            kind: DirectoryTypeKind::Docs,
            name: "文档".to_string(),
            category: Some("docs".to_string()),
            sort_order: 1,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&dt).unwrap();
        assert!(json.contains("文档"));
    }

    #[test]
    fn test_project_directory() {
        let pd = ProjectDirectory {
            id: "pd-id".to_string(),
            project_id: "proj-id".to_string(),
            dir_type_id: "dt-id".to_string(),
            relative_path: "docs".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        assert_eq!(pd.relative_path, "docs");
    }
}
