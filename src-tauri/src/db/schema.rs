/// 数据库 Schema 定义
pub const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS workspace_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  project_path TEXT NOT NULL,
  display_json TEXT,
  ide_override_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS git_repositories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  remote_url TEXT,
  branch TEXT,
  custom_name TEXT,
  description TEXT,
  last_sync_at TEXT,
  last_status_checked_at TEXT,
  last_status_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS directory_types (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_directories (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  dir_type_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, dir_type_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_git_repositories_project_id ON git_repositories(project_id);
CREATE INDEX IF NOT EXISTS idx_directory_types_sort_order ON directory_types(sort_order);
CREATE INDEX IF NOT EXISTS idx_project_directories_project_id ON project_directories(project_id);
"#;
