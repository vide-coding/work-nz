# Setup Tech Stack Spec

## Why

User requested to setup the project tech stack using Vue 3.6 (Vapor Mode) and other necessary dependencies, and ensure the project runs with a simple example.
Current project is a basic Tauri + Vue 3.5 setup.

## What Changes

- **Dependencies**:
  - Update `vue` to latest (or 3.6 beta if available/needed for Vapor, otherwise 3.5+ with Vapor enabled).
  - Add `tailwindcss`, `postcss`, `autoprefixer` (for styling).
  - Add `lucide-vue-next` (for icons).
- **Configuration**:
  - Update `vite.config.ts` to enable Vapor mode (if applicable via plugin options).
  - Initialize Tailwind CSS.
- **Code**:
  - Modify `src/main.ts` to use `createVaporApp` (if available/stable) or configure app for Vapor.
  - Create a sample Vapor component in `src/components/`.
  - Update `src/App.vue` to use the sample component.

## Impact

- **Affected specs**: None (initial setup).
- **Affected code**: `package.json`, `vite.config.ts`, `src/main.ts`, `src/App.vue`, `src/components/`.

## ADDED Requirements

### Requirement: Tech Stack Setup

The system SHALL use Vue 3 (Vapor Mode).

#### Scenario: Run Example

- **WHEN** user runs `npm run dev` (or `tauri dev`)
- **THEN** the application should start without errors and display the sample Vapor component.
