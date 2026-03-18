---
name: i18n-checker
description: "Automatically run this skill after completing any coding task to check if internationalization is complete. Checks for: 1) Missing translation keys between locale files, 2) Hardcoded strings in Vue components, 3) Incorrect i18n usage patterns. This is MANDATORY after every implementation task."
license: MIT
---

# i18n Checker - Automatic Internationalization Verification

This skill automatically verifies that internationalization is complete after each coding task.

## When to Invoke

**MANDATORY**: After completing ANY of these tasks:
- Creating or modifying Vue components
- Adding new UI text or labels
- Creating dialog components
- Modifying existing features
- Any change that adds visible text to the UI

## Verification Steps

### 1. Check Locale File Key Consistency

```bash
# Compare keys between en-US.json and zh-CN.json
python3 -c "
import json
import sys

def get_all_keys(obj, prefix=''):
    keys = []
    for k, v in obj.items():
        full_key = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            keys.extend(get_all_keys(v, full_key))
        else:
            keys.append(full_key)
    return keys

try:
    with open('src/locales/lang/en-US.json', 'r', encoding='utf-8') as f:
        en = json.load(f)
    with open('src/locales/lang/zh-CN.json', 'r', encoding='utf-8') as f:
        zh = json.load(f)

    en_keys = set(get_all_keys(en))
    zh_keys = set(get_all_keys(zh))

    missing_in_zh = en_keys - zh_keys
    missing_in_en = zh_keys - en_keys

    if missing_in_zh:
        print('MISSING in zh-CN:', sorted(missing_in_zh))
    if missing_in_en:
        print('MISSING in en-US:', sorted(missing_in_en))
    if not missing_in_zh and not missing_in_en:
        print('PASS: All translation keys are consistent')
except Exception as e:
    print(f'ERROR: {e}')
"
```

### 2. Check for Hardcoded Strings in Vue Components

Look for these patterns that indicate missing i18n:

**Hardcoded Chinese (should use $t):**
```vue
<!-- BAD -->
<button>保存</button>
<placeholder>请输入名称</placeholder>

<!-- GOOD -->
<button>{{ $t('common.save') }}</button>
<placeholder>{{ $t('project.namePlaceholder') }}</placeholder>
```

**Incorrect $t usage (not bound):**
```vue
<!-- BAD - literal string passed, not evaluated -->
<Dialog title="$t('workspace.rename')">

<!-- GOOD - properly bound with : or v-bind -->
<Dialog :title="$t('workspace.rename')">
```

### 3. Check Component Files

Scan recently modified Vue files for:
- [ ] Template text not wrapped in `{{ $t('...') }}`
- [ ] Placeholder attributes without translation
- [ ] Button labels without translation
- [ ] Error/success messages without translation

### 4. Required i18n Patterns

**For Vue templates:**
```vue
<!-- Text content -->
<span>{{ $t('key.path') }}</span>

<!-- Placeholders -->
:placeholder="$t('form.placeholder')"

<!-- Button labels -->
<button>{{ $t('common.save') }}</button>

<!-- Dynamic attributes -->
:title="$t('key.path')"
```

**For Vue script (Composition API):**
```typescript
const { t } = useI18n()
const message = t('key.path')
```

## Output Format

After running checks, report:

```
## i18n Check Results

### 1. Key Consistency
- Status: ✅ PASS / ❌ FAIL
- Details: [list any missing keys]

### 2. Hardcoded Strings
- Status: ✅ PASS / ❌ FAIL
- Files with issues: [list files]

### 3. Required Fixes
[Specific changes needed]
```

## Common Issues to Watch For

1. **Missing colon on directive**: `title="$t('...')"` → `:title="$t('...')"`
2. **Hardcoded Chinese text**: `>删除</button>` → `>{{ $t('common.delete') }}</button>`
3. **Missing placeholder**: `placeholder="名称"` → `:placeholder="$t('...')"`
4. **Incomplete translations**: New key in zh-CN but not in en-US

## Quick Fix Commands

**Add missing key to both files:**
```bash
# Add to en-US.json
jq '.path.to.key = "Translation text"' src/locales/lang/en-US.json > tmp.json && mv tmp.json src/locales/lang/en-US.json

# Add to zh-CN.json
jq '.path.to.key = "翻译文本"' src/locales/lang/zh-CN.json > tmp.json && mv tmp.json src/locales/lang/zh-CN.json
```

## Notes

- Always maintain key consistency between all locale files
- Use dot notation for key paths: `category.subcategory.action`
- Group related keys under common parents
- Consider interpolation for dynamic values: `"Hello {name}"` → `"你好 {name}"`
