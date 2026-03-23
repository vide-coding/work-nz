# Implementation Tasks

## 1. Backend - Rust Commands

- [x] 1.1 Add `fs_create_file` command in `src-tauri/src/commands/filesystem.rs`
- [x] 1.2 Add `fs_open_external` command to open file with system default app
- [x] 1.3 Add `fs_copy_file` command for drag-and-drop import
- [x] 1.4 Export new commands in `src-tauri/src/commands/mod.rs` (automatic via pub use)
- [x] 1.5 Update `src-tauri/capabilities/default.json` with required permissions

## 2. Frontend - File Module View

- [x] 2.1 Create `src/components/module/FileModuleView.vue` component
- [x] 2.2 Add file/folder list display with icons
- [x] 2.3 Add toolbar with New File, New Folder buttons
- [x] 2.4 Implement folder navigation (enter folder, go back)
- [x] 2.5 Add view mode toggle (grid/list)

## 3. Frontend - Dialogs and Context Menu

- [x] 3.1 Create `CreateFileDialog.vue` for new file creation
- [x] 3.2 Add rename inline editing support
- [x] 3.3 Implement context menu (right-click) for file/folder actions
- [x] 3.4 Add confirmation dialogs for delete operations

## 4. Frontend - Drag and Drop

- [x] 4.1 Add drag-over visual feedback
- [x] 4.2 Implement HTML5 drag and drop event handling
- [x] 4.3 Handle file conflict detection and resolution UI
- [x] 4.4 Add multiple file drag-drop support

## 5. Frontend - Open File Actions

- [x] 5.1 Add "Open" button/action for files
- [x] 5.2 Add "Open in Explorer" action for folders
- [x] 5.3 Wire up Tauri commands to Rust backend

## 6. Internationalization

- [x] 6.1 Add translation keys in `src/locales/lang/en-US.json`
- [x] 6.2 Add translation keys in `src/locales/lang/zh-CN.json`

## 7. Integration

- [x] 7.1 Add FileModuleView to project workspace page (via ModuleContentArea)
- [x] 7.2 Wire up fsApi methods for file operations
- [x] 7.3 Connect with existing project navigation (module system)

## 8. Testing

- [x] 8.1 Write unit tests for new Rust commands
- [x] 8.2 Write unit tests for Vue composables (if any)
- [x] 8.3 Run `pnpm test` to verify all tests pass
- [x] 8.4 Run i18n-checker to verify translations complete
