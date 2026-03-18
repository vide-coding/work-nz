# Vibe Kanban - Local Project Manager

## Project Overview

Vibe Kanban is a Tauri + Vue 3 + TypeScript desktop application for managing local projects with Git integration, file management, and task tracking.

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **State Management**: Pinia
- **Internationalization**: vue-i18n (en-US, zh-CN)
- **UI Framework**: Tailwind CSS + Lucide Icons

## Key Directories

- `src/` - Vue frontend source code
- `src/locales/` - i18n configuration and translation files
- `src/locales/lang/en-US.json` - English translations
- `src/locales/lang/zh-CN.json` - Chinese translations
- `src/components/` - Vue components
- `src/views/` - Page views
- `src/composables/` - Vue composables
- `src/types/` - TypeScript type definitions
- `.claude/` - Claude Code configuration
- `.claude/skills/` - Custom skills
- `.claude/agents/` - Claude agents

## i18n Requirements (MANDATORY)

### After completing ANY coding task, you MUST run the i18n-checker skill to verify internationalization is complete.

**Invoke the skill with:**

```
/i18n-checker
```

This skill automatically checks for:

1. Missing translation keys between locale files (en-US.json vs zh-CN.json)
2. Hardcoded strings in Vue components that should use `$t()`
3. Incorrect i18n usage patterns (e.g., missing `:` on directive)

### i18n Key Structure

Translation keys use dot notation:

- `common.*` - Common actions (save, cancel, delete, edit, etc.)
- `workspace.*` - Workspace-related UI
- `projects.*` - Project management strings
- `project.*` - Individual project actions
- `settings.*` - Settings panel strings
- `theme.*` - Theme selection strings
- `time.*` - Time formatting

### Required Patterns

**Vue templates:**

```vue
<!-- Text content -->
<span>{{ $t('key.path') }}</span>

<!-- Placeholders -->
:placeholder="$t('form.placeholder')"

<!-- Button labels -->
<button>{{ $t('common.save') }}</button>

<!-- Dynamic attributes (IMPORTANT: use : or v-bind) -->
:title="$t('key.path')"
```

**Common mistakes to avoid:**

```vue
<!-- WRONG - not evaluated, displays literally -->
<Dialog title="$t('workspace.rename')">

<!-- CORRECT - properly bound -->
<Dialog :title="$t('workspace.rename')">
```

### Adding New Translations

When adding new UI text:

1. Add the key and English translation to `src/locales/lang/en-US.json`
2. Add the same key with Chinese translation to `src/locales/lang/zh-CN.json`
3. Use consistent key naming: `category.subcategory.action`

### Verification Commands

Check key consistency:

```bash
python3 -c "
import json
def get_keys(obj, prefix=''):
    keys = []
    for k, v in obj.items():
        full_key = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            keys.extend(get_keys(v, full_key))
        else:
            keys.append(full_key)
    return keys
with open('src/locales/lang/en-US.json') as f: en = set(get_keys(json.load(f)))
with open('src/locales/lang/zh-CN.json') as f: zh = set(get_keys(json.load(f)))
print('Missing in zh-CN:', en - zh)
print('Missing in en-US:', zh - en)
"
```
