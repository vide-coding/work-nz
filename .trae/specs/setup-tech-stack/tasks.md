# Tasks

- [x] Task 1: Install Dependencies
  - [x] Update Vue to the latest version that supports Vapor.
  - [x] Install `reka-ui` (and any necessary adapters).
  - [x] Install `tailwindcss`, `postcss`, `autoprefixer`.
  - [x] Install `lucide-vue-next`.
- [x] Task 2: Configure Project
  - [x] Initialize Tailwind CSS (`npx tailwindcss init -p`).
  - [x] Configure `tailwind.config.js`.
  - [x] Update `vite.config.ts` (check if `vue()` plugin needs `{ vapor: true }` or similar).
  - [x] Add Tailwind directives to `src/style.css` (or create one).
- [x] Task 3: Implement Vapor Entry & Example
  - [x] Modify `src/main.ts` to use `createVaporApp` from `vue/vapor` (if supported) or `createApp`.
  - [x] Create `src/components/VaporExample.vapor.vue` using Vapor syntax (e.g. `<script setup>`, no VDOM if possible).
  - [x] Use Reka UI components in `VaporExample.vue`.
  - [x] Update `src/App.vue` to mount the example.
- [x] Task 4: Verify & Run
  - [x] Run type check (`vue-tsc`).
  - [x] Start dev server (`npm run tauri dev` or `npm run dev`) to verify it works.
