# File Manager Module Specification

## ADDED Requirements

### Requirement: File and Folder Creation

The system SHALL allow users to create new files and folders within a project directory.

#### Scenario: Create new folder

- **WHEN** user clicks the "New Folder" button
- **THEN** system displays a dialog for folder name input
- **WHEN** user enters a valid folder name and confirms
- **THEN** system creates the folder at the current directory path
- **AND** the file tree refreshes to show the new folder

#### Scenario: Create new file

- **WHEN** user clicks the "New File" button
- **THEN** system displays a dialog for file name input
- **WHEN** user enters a valid file name (with extension) and confirms
- **THEN** system creates an empty file at the current directory path
- **AND** the file tree refreshes to show the new file

#### Scenario: Invalid file/folder name

- **WHEN** user enters a name containing invalid characters (`\/:*?"<>|`) or empty name
- **THEN** system displays an error message
- **AND** creation is blocked until valid name is provided

### Requirement: File Opening

The system SHALL allow users to open files using the system default application.

#### Scenario: Open file with default application

- **WHEN** user double-clicks a file or clicks "Open" button
- **THEN** system launches the system's default application for that file type
- **AND** the file is opened in the external application

#### Scenario: Open folder in file explorer

- **WHEN** user selects a folder and clicks "Open in Explorer"
- **THEN** system opens the system file explorer at that folder location

### Requirement: Drag and Drop Import

The system SHALL allow users to drag external files into the project directory.

#### Scenario: Drag single file into directory

- **WHEN** user drags a file from outside the project
- **AND** drops it onto the file list area
- **THEN** system copies the file to the current directory
- **AND** the file tree refreshes to show the new file

#### Scenario: Drag multiple files into directory

- **WHEN** user drags multiple files from outside the project
- **AND** drops them onto the file list area
- **THEN** system copies all files to the current directory
- **AND** the file tree refreshes to show all new files

#### Scenario: Drag file with conflicting name

- **WHEN** user drags a file with the same name as an existing file
- **THEN** system displays a confirmation dialog
- **WHEN** user confirms overwrite
- **THEN** system replaces the existing file
- **OR WHEN** user cancels
- **THEN** system cancels the import operation

### Requirement: Rename Files and Folders

The system SHALL allow users to rename files and folders.

#### Scenario: Rename file

- **WHEN** user right-clicks a file and selects "Rename"
- **OR** user selects a file and presses F2
- **THEN** system displays an inline edit field with current name selected
- **WHEN** user enters a new valid name and confirms
- **THEN** system renames the file
- **AND** the file tree refreshes to show the new name

#### Scenario: Rename folder

- **WHEN** user renames a folder
- **THEN** system renames the folder and updates all child paths
- **AND** the file tree refreshes

### Requirement: Delete Files and Folders

The system SHALL allow users to delete files and folders with confirmation.

#### Scenario: Delete file with confirmation

- **WHEN** user right-clicks a file and selects "Delete"
- **THEN** system displays a confirmation dialog showing the file name
- **WHEN** user confirms deletion
- **THEN** system deletes the file
- **AND** the file tree refreshes

#### Scenario: Delete folder with confirmation

- **WHEN** user deletes a folder
- **THEN** system displays a confirmation dialog warning about recursive deletion
- **WHEN** user confirms deletion
- **THEN** system deletes the folder and all its contents
- **AND** the file tree refreshes

#### Scenario: Cancel delete operation

- **WHEN** user clicks cancel on the confirmation dialog
- **THEN** system cancels the delete operation
- **AND** no files are modified

### Requirement: File Tree Display

The system SHALL display files and folders in a navigable tree structure.

#### Scenario: Display file list

- **WHEN** user navigates to a directory
- **THEN** system displays all files and folders in that directory
- **AND** folders are visually distinguished from files (using folder icon)
- **AND** files show appropriate icons based on file type

#### Scenario: Navigate into folder

- **WHEN** user double-clicks a folder
- **THEN** system navigates into that folder
- **AND** displays its contents

#### Scenario: Navigate to parent folder

- **WHEN** user clicks the back arrow
- **THEN** system navigates to the parent directory

### Requirement: Context Menu Actions

The system SHALL provide context menu actions for files and folders.

#### Scenario: File context menu

- **WHEN** user right-clicks on a file
- **THEN** system displays a context menu with: Open, Rename, Delete

#### Scenario: Folder context menu

- **WHEN** user right-clicks on a folder
- **THEN** system displays a context menu with: Open in Explorer, Rename, Delete
