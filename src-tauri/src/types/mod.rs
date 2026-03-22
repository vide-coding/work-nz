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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct IdeConfig {
    pub kind: SupportedIdeKind,
    pub name: String,
    pub command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<Vec<String>>,
    /// 是否可用（CLI 命令在 PATH 中可用）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub available: Option<bool>,
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
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_sync_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_status_checked_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ide_override: Option<IdeConfig>,
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
    pub visible: bool,
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
    /// Optional target directory relative path (e.g., "src/my-module")
    /// If not provided, defaults to "code"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_directory: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
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
            command: "code".to_string(),
            args: Some(vec!["--reuse-window".to_string()]),
            available: Some(true),
        };

        let json = serde_json::to_string(&ide).unwrap();
        assert!(json.contains("vscode"));
        assert!(json.contains("VS Code"));
        assert!(json.contains("\"available\":true") || json.contains("\"available\": true"));
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
            target_directory: None,
            branch: Some("main".to_string()),
            name: Some("My Repo".to_string()),
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

    // Module System Tests

    #[test]
    fn test_module_capability_as_str() {
        assert_eq!(ModuleCapability::GitClone.as_str(), "git.clone");
        assert_eq!(ModuleCapability::GitPull.as_str(), "git.pull");
        assert_eq!(ModuleCapability::TaskCreate.as_str(), "task.create");
        assert_eq!(ModuleCapability::FileBrowse.as_str(), "file.browse");
    }

    #[test]
    fn test_module_capability_from_str() {
        assert_eq!(ModuleCapability::from_str("git.clone"), Some(ModuleCapability::GitClone));
        assert_eq!(ModuleCapability::from_str("git.pull"), Some(ModuleCapability::GitPull));
        assert_eq!(ModuleCapability::from_str("invalid"), None);
    }

    #[test]
    fn test_module_capability_roundtrip() {
        for cap in [
            ModuleCapability::GitClone,
            ModuleCapability::GitStatus,
            ModuleCapability::TaskCreate,
            ModuleCapability::FileBrowse,
        ] {
            assert_eq!(ModuleCapability::from_str(cap.as_str()), Some(cap));
        }
    }

    #[test]
    fn test_template_scope() {
        assert_eq!(TemplateScope::Local, TemplateScope::Local);
        assert_eq!(TemplateScope::Project, TemplateScope::Project);
        assert_eq!(TemplateScope::Official, TemplateScope::Official);
    }

    #[test]
    fn test_directory_serialization() {
        let dir = Directory {
            id: "dir-1".to_string(),
            project_id: "proj-1".to_string(),
            name: "src".to_string(),
            relative_path: "src".to_string(),
            module_id: Some("builtin:git".to_string()),
            module_config: Some(serde_json::json!({"autoDetect": true})),
            sort_order: 0,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&dir).unwrap();
        assert!(json.contains("dir-1"));
        assert!(json.contains("builtin:git"));
    }

    #[test]
    fn test_directory_template_serialization() {
        let template = DirectoryTemplate {
            id: "tpl-1".to_string(),
            name: "My Template".to_string(),
            description: Some("A test template".to_string()),
            scope: TemplateScope::Project,
            project_id: Some("proj-1".to_string()),
            items: vec![
                DirectoryTemplateItem {
                    name: "src".to_string(),
                    relative_path: "src".to_string(),
                    module_id: "builtin:git".to_string(),
                    module_config: None,
                },
            ],
            created_by: Some("user".to_string()),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&template).unwrap();
        assert!(json.contains("My Template"));
        assert!(json.contains("src"));
    }

    #[test]
    fn test_module_config_property() {
        let prop = ModuleConfigProperty {
            prop_type: "string".to_string(),
            title: Some("Test Property".to_string()),
            description: Some("A test property".to_string()),
            default: Some(serde_json::json!("default")),
            enum_values: Some(vec![serde_json::json!("a"), serde_json::json!("b")]),
            items: None,
            format: None,
            min_length: Some(1),
            max_length: Some(100),
            minimum: None,
            maximum: None,
        };

        assert_eq!(prop.prop_type, "string");
        assert_eq!(prop.min_length, Some(1));
    }

    #[test]
    fn test_module_serialization() {
        use std::collections::HashMap;

        let mut props = HashMap::new();
        props.insert(
            "enabled".to_string(),
            ModuleConfigProperty {
                prop_type: "boolean".to_string(),
                title: Some("Enabled".to_string()),
                description: None,
                default: Some(serde_json::json!(true)),
                enum_values: None,
                items: None,
                format: None,
                min_length: None,
                max_length: None,
                minimum: None,
                maximum: None,
            },
        );

        let schema = ModuleConfigSchema {
            schema_type: "object".to_string(),
            title: Some("Test Module".to_string()),
            description: None,
            properties: props,
            required: Some(vec!["enabled".to_string()]),
        };

        let module = Module {
            id: "test:module".to_string(),
            key: "test".to_string(),
            name: "Test Module".to_string(),
            description: "A test module".to_string(),
            version: "1.0.0".to_string(),
            capabilities: vec!["test.action".to_string()],
            config_schema: schema,
            default_config: serde_json::json!({"enabled": true}),
            icon: Some("test".to_string()),
            is_built_in: false,
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let json = serde_json::to_string(&module).unwrap();
        assert!(json.contains("test:module"));
        assert!(json.contains("Test Module"));
    }
}

// ============== New Module System Types ==============

/// Module capability
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ModuleCapability {
    GitClone,
    GitPull,
    GitStatus,
    GitLog,
    GitConfig,
    TaskCreate,
    TaskUpdate,
    TaskDelete,
    TaskList,
    TaskStatus,
    FileBrowse,
    FileRead,
    FilePreview,
    FileSearch,
    FileCreate,
    FileDelete,
    FileRename,
}

impl ModuleCapability {
    pub fn as_str(&self) -> &'static str {
        match self {
            ModuleCapability::GitClone => "git.clone",
            ModuleCapability::GitPull => "git.pull",
            ModuleCapability::GitStatus => "git.status",
            ModuleCapability::GitLog => "git.log",
            ModuleCapability::GitConfig => "git.config",
            ModuleCapability::TaskCreate => "task.create",
            ModuleCapability::TaskUpdate => "task.update",
            ModuleCapability::TaskDelete => "task.delete",
            ModuleCapability::TaskList => "task.list",
            ModuleCapability::TaskStatus => "task.status",
            ModuleCapability::FileBrowse => "file.browse",
            ModuleCapability::FileRead => "file.read",
            ModuleCapability::FilePreview => "file.preview",
            ModuleCapability::FileSearch => "file.search",
            ModuleCapability::FileCreate => "file.create",
            ModuleCapability::FileDelete => "file.delete",
            ModuleCapability::FileRename => "file.rename",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "git.clone" => Some(ModuleCapability::GitClone),
            "git.pull" => Some(ModuleCapability::GitPull),
            "git.status" => Some(ModuleCapability::GitStatus),
            "git.log" => Some(ModuleCapability::GitLog),
            "git.config" => Some(ModuleCapability::GitConfig),
            "task.create" => Some(ModuleCapability::TaskCreate),
            "task.update" => Some(ModuleCapability::TaskUpdate),
            "task.delete" => Some(ModuleCapability::TaskDelete),
            "task.list" => Some(ModuleCapability::TaskList),
            "task.status" => Some(ModuleCapability::TaskStatus),
            "file.browse" => Some(ModuleCapability::FileBrowse),
            "file.read" => Some(ModuleCapability::FileRead),
            "file.preview" => Some(ModuleCapability::FilePreview),
            "file.search" => Some(ModuleCapability::FileSearch),
            "file.create" => Some(ModuleCapability::FileCreate),
            "file.delete" => Some(ModuleCapability::FileDelete),
            "file.rename" => Some(ModuleCapability::FileRename),
            _ => None,
        }
    }
}

/// Module config property
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModuleConfigProperty {
    #[serde(rename = "type")]
    pub prop_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enum_values: Option<Vec<serde_json::Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Box<ModuleConfigProperty>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_length: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_length: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub minimum: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maximum: Option<f64>,
}

/// Module config schema
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModuleConfigSchema {
    #[serde(rename = "type")]
    pub schema_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub properties: std::collections::HashMap<String, ModuleConfigProperty>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub required: Option<Vec<String>>,
}

/// Module
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Module {
    pub id: String,
    pub key: String,
    pub name: String,
    pub description: String,
    pub version: String,
    pub capabilities: Vec<String>,
    pub config_schema: ModuleConfigSchema,
    pub default_config: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub is_built_in: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// Directory (new module system)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Directory {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub relative_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_config: Option<serde_json::Value>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

/// Template scope
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TemplateScope {
    Local,
    Project,
    Official,
}

/// Directory template item
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryTemplateItem {
    pub name: String,
    pub relative_path: String,
    pub module_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module_config: Option<serde_json::Value>,
}

/// Directory template
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryTemplate {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub scope: TemplateScope,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    pub items: Vec<DirectoryTemplateItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
