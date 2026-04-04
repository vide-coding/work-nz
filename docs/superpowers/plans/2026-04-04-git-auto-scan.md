# Git 自动扫描 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除手动扫描按钮，实现自动扫描仓库发现和文件系统监听，增强刷新按钮功能。

**Architecture:**
- 前端在初始加载和目录切换时自动触发扫描
- 通过 Tauri 后端监听目录顶层文件变化事件
- 合并刷新按钮功能，同时执行扫描和状态更新
- 使用防抖处理文件系统事件，避免高频触发

**Tech Stack:**
- Vue 3 + TypeScript (Composition API)
- Tauri 2.0 (Rust backend)
- Existing `gitApi` composable

---

## 文件结构

**修改文件：**
- `src/components/module/GitModuleView.vue` - 移除扫描按钮、实现自动扫描、合并刷新功能
- `src-tauri/src/commands/git.rs` - 新增文件监听命令
- `src-tauri/src/events/mod.rs` - 新增文件监听事件定义（如需要）

**翻译文件（检查）：**
- `src/locales/lang/en-US.json` - 验证翻译键
- `src/locales/lang/zh-CN.json` - 验证翻译键

**测试文件：**
- `src/components/module/__tests__/GitModuleView.spec.ts` - 新增单元测试

---

## Task 1: 后端 - 实现目录监听命令

**Files:**
- Modify: `src-tauri/src/commands/git.rs`

创建一个 Rust 命令用于监听指定目录的顶层文件变化，并通过事件发送给前端。

- [ ] **Step 1: 检查现有的git命令结构**

打开 `src-tauri/src/commands/git.rs`，查看现有命令的签名和事件发送模式。
预期：看到类似 `#[tauri::command]` 的命令定义和 `AppHandle` 用于发送事件

- [ ] **Step 2: 添加目录监听函数**

在 `git.rs` 中添加以下代码（在文件末尾）：

```rust
use std::path::{Path, PathBuf};
use notify::{Watcher, RecursiveMode, watcher, DebouncedEvent};
use std::time::Duration;
use std::sync::{Arc, Mutex};
use std::thread;

#[tauri::command]
pub async fn watch_directory(
    app_handle: tauri::AppHandle,
    directory: String,
) -> Result<String, String> {
    let path = PathBuf::from(&directory);

    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let handler_app = app_handle.clone();
    let watch_path = path.clone();

    // 使用 notify crate 监听文件变化（仅顶层）
    let (tx, rx) = std::sync::mpsc::channel();
    let mut watcher = watcher(tx, Duration::from_millis(500))
        .map_err(|e| e.to_string())?;

    // 只监听顶层，不递归
    watcher.watch(&watch_path, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    let watch_id = uuid::Uuid::new_v4().to_string();

    // 在后台线程中处理事件
    let watch_id_clone = watch_id.clone();
    thread::spawn(move || {
        for event in rx.iter() {
            match event {
                DebouncedEvent::Create(_) | DebouncedEvent::Remove(_) => {
                    // 发送事件给前端
                    let _ = handler_app.emit_all("git:directory:changed", &watch_id_clone);
                }
                _ => {}
            }
        }
    });

    Ok(watch_id)
}

#[tauri::command]
pub async fn unwatch_directory(watch_id: String) -> Result<(), String> {
    // Note: 简单实现，实际可以通过全局状态管理watchers
    Ok(())
}
```

- [ ] **Step 3: 验证编译**

运行命令检查 Rust 编译：
```bash
cd src-tauri && cargo check
```
预期：编译成功，无错误或警告

- [ ] **Step 4: 提交后端实现**

```bash
git add src-tauri/src/commands/git.rs
git commit -m "feat(backend): add directory watcher command for git auto-scan"
```

---

## Task 2: 前端 - 实现防抖监听逻辑

**Files:**
- Modify: `src/components/module/GitModuleView.vue:1-150`

在脚本部分添加防抖的文件监听逻辑。

- [ ] **Step 1: 引入必要的监听函数**

在 GitModuleView.vue 的 `<script setup>` 顶部（第 2-15 行之后）添加：

```typescript
import { listen, UnlistenFn } from '@tauri-apps/api/event'
// 已有，检查是否存在
```

验证 `listen` 已导入。

- [ ] **Step 2: 添加监听器状态**

在 state 部分（第 24-30 行之后）添加：

```typescript
// File system watcher state
let unlistenDirChange: UnlistenFn | null = null
const watchingDirectory = ref(false)
```

- [ ] **Step 3: 添加防抖扫描函数**

在现有的 `handleScan()` 函数（第 149-165 行）之后添加：

```typescript
// Debounced auto-scan triggered by file system changes
const debouncedAutoScan = debounce(async () => {
  if (!props.directory.projectId || scanning.value) return

  scanning.value = true
  error.value = ''
  try {
    const result = await gitApi.scan(props.directory.projectId)
    if (result.scanned && result.scanned.length > 0) {
      await loadRepositories()
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to auto-scan repositories'
  } finally {
    scanning.value = false
  }
}, 1500)
```

- [ ] **Step 4: 添加启动监听函数**

在 `debouncedAutoScan` 定义之后添加：

```typescript
// Start watching directory for changes
async function setupDirectoryWatcher() {
  if (!props.directory.path) return

  // Clean up existing watcher
  if (unlistenDirChange) {
    unlistenDirChange()
  }

  try {
    // Listen for directory change events
    unlistenDirChange = await listen<string>('git:directory:changed', () => {
      // Trigger debounced auto-scan when files/folders change
      debouncedAutoScan()
    })
    watchingDirectory.value = true
  } catch (e) {
    console.error('Failed to setup directory watcher:', e)
  }
}

// Clean up watcher
function cleanupDirectoryWatcher() {
  if (unlistenDirChange) {
    unlistenDirChange()
    unlistenDirChange = null
  }
  watchingDirectory.value = false
}
```

- [ ] **Step 5: 提交前端监听逻辑**

```bash
git add src/components/module/GitModuleView.vue
git commit -m "feat(frontend): add debounced directory watcher setup and cleanup"
```

---

## Task 3: 前端 - 修改生命周期钩子

**Files:**
- Modify: `src/components/module/GitModuleView.vue:495-530`

在 `onMounted` 和 `onUnmounted` 中集成文件监听。

- [ ] **Step 1: 修改 onMounted 钩子**

找到第 495-516 行的 `onMounted` 钩子，修改为：

```typescript
onMounted(async () => {
  // Load repositories
  await loadRepositories()

  // Auto-scan on initial load
  await handleScan()

  // Setup directory watcher
  await setupDirectoryWatcher()

  // Listen for clone progress events
  unlistenCloneProgress = await listen<GitCloneProgress>('git:clone:progress', (event) => {
    const progress = event.payload
    const activeTaskKey = Object.keys(cloneTasks.value).find(
      (key) => cloneTasks.value[key].status === 'cloning'
    )

    if (activeTaskKey) {
      cloneTasks.value[activeTaskKey].progress = progress
      if (progress.stage === 'completed') {
        delete cloneTasks.value[activeTaskKey]
        loadRepositories()
      } else if (progress.stage === 'failed') {
        cloneTasks.value[activeTaskKey].status = 'failed'
      }
    }
  })
})
```

- [ ] **Step 2: 修改 onUnmounted 钩子**

找到第 518-522 行的 `onUnmounted` 钩子，修改为：

```typescript
onUnmounted(() => {
  // Clean up directory watcher
  cleanupDirectoryWatcher()

  // Clean up clone progress listener
  if (unlistenCloneProgress) {
    unlistenCloneProgress()
  }
})
```

- [ ] **Step 3: 修改目录切换监听**

找到第 525-530 行的 watch 块，修改为：

```typescript
// Reload when directory identity changes
watch(
  () => [props.directory.id, props.directory.projectId, props.directory.path] as const,
  async () => {
    // Clean up old watcher
    cleanupDirectoryWatcher()

    // Load and auto-scan new directory
    await loadRepositories()
    await handleScan()

    // Setup watcher for new directory
    await setupDirectoryWatcher()
  }
)
```

- [ ] **Step 4: 验证逻辑流程**

检查流程：
1. ✅ 初始加载时 → loadRepositories() → handleScan()
2. ✅ setupDirectoryWatcher() 启动监听
3. ✅ 目录切换时 → cleanupDirectoryWatcher() → 重新初始化
4. ✅ 卸载时 → cleanupDirectoryWatcher()

- [ ] **Step 5: 提交生命周期修改**

```bash
git add src/components/module/GitModuleView.vue
git commit -m "feat: integrate auto-scan into lifecycle and directory watching"
```

---

## Task 4: 前端 - 移除扫描按钮 UI

**Files:**
- Modify: `src/components/module/GitModuleView.vue:540-560`

从模板中移除扫描按钮。

- [ ] **Step 1: 删除扫描按钮HTML**

找到第 548-556 行的扫描按钮：

```vue
<button
  class="git-module__scan-btn"
  :disabled="scanning"
  :title="$t('git.scan')"
  @click="handleScan"
>
  <RefreshCw :class="{ 'animate-spin': scanning }" class="w-4 h-4" />
  <span v-if="!scanning">{{ t('git.scan') }}</span>
</button>
```

**删除上述代码块**

- [ ] **Step 2: 清理 CSS 样式**

找到第 828-849 行的 `.git-module__scan-btn` 样式定义：

```css
.git-module__scan-btn {
  /* ... 所有样式 ... */
}
```

**删除此整个样式块**

- [ ] **Step 3: 检查模板逻辑**

验证模板中没有其他对 `scanning` 状态的使用（除了在设置中可能需要的地方）。

预期：模板中对 `scanning` 的引用现在只在：
- 内部逻辑中使用（如去抖判断）
- 不再显示在UI中

- [ ] **Step 4: 提交UI移除**

```bash
git add src/components/module/GitModuleView.vue
git commit -m "feat: remove scan button from UI"
```

---

## Task 5: 前端 - 合并刷新按钮功能

**Files:**
- Modify: `src/components/module/GitModuleView.vue:167-193`

修改刷新按钮的处理函数，同时执行扫描和状态更新。

- [ ] **Step 1: 创建合并的刷新函数**

在现有 `refreshAllRepoStatuses` 函数（第 168-193 行）之前或之后添加新函数：

```typescript
// Merged refresh: scan new repos + refresh existing statuses
async function handleRefreshAll() {
  if (!props.directory.projectId) return

  refreshing.value = true
  error.value = ''
  try {
    // Step 1: Scan for new repositories
    const scanResult = await gitApi.scan(props.directory.projectId)

    // Step 2: Reload repository list if new repos were found
    if (scanResult.scanned && scanResult.scanned.length > 0) {
      await loadRepositories()
    }

    // Step 3: Refresh all repository statuses
    const repos = await gitApi.repoList(
      props.directory.projectId,
      props.directory.relativePath || undefined
    )

    await Promise.all(
      repos.map(async (repo) => {
        try {
          const status = await gitApi.repoStatusCheck(repo.id)
          repoStatuses.value[repo.id] = status
        } catch (e) {
          console.error(`Failed to refresh status for repo ${repo.id}:`, e)
          const status = await gitApi.repoStatusGet(repo.id)
          repoStatuses.value[repo.id] = status
        }
      })
    )
  } catch (e: any) {
    error.value = e.message || 'Failed to refresh repositories'
  } finally {
    refreshing.value = false
  }
}
```

- [ ] **Step 2: 更新模板中的刷新按钮点击处理**

找到第 540-547 行的刷新按钮：

```vue
<button
  class="git-module__refresh-btn"
  :disabled="refreshing"
  :title="$t('git.refresh')"
  @click="refreshAllRepoStatuses"
>
```

修改 `@click` 为：

```vue
<button
  class="git-module__refresh-btn"
  :disabled="refreshing"
  :title="$t('git.refresh')"
  @click="handleRefreshAll"
>
```

- [ ] **Step 3: 保留原有的 refreshAllRepoStatuses 函数**

保持 `refreshAllRepoStatuses` 原样，作为备用或内部使用。

预期：现在 `handleRefreshAll` 是新的主入口，内部调用了扫描 + 刷新逻辑。

- [ ] **Step 4: 提交刷新功能合并**

```bash
git add src/components/module/GitModuleView.vue
git commit -m "feat: merge scan and refresh into unified handleRefreshAll function"
```

---

## Task 6: 前端 - 检查 i18n 和类型

**Files:**
- Verify: `src/locales/lang/en-US.json`
- Verify: `src/locales/lang/zh-CN.json`
- Verify: `src/types/index.ts`

检查翻译和类型定义的完整性。

- [ ] **Step 1: 检查翻译键**

打开 `src/locales/lang/en-US.json` 和 `src/locales/lang/zh-CN.json`，查找：
- `git.scan` - 预期：应该移除（或保留备用）
- `git.refresh` - 预期：应该存在

运行验证脚本：
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
print('Missing in zh-CN:', sorted(en - zh))
print('Missing in en-US:', sorted(zh - en))
"
```

预期：没有缺失的翻译键

- [ ] **Step 2: 运行 i18n-checker 技能**

```bash
/i18n-checker
```

预期：所有检查通过，没有硬编码字符串

- [ ] **Step 3: 检查类型定义**

打开 `src/types/index.ts`，检查 `Directory` 类型是否包含 `path` 字段：

预期：看到类似：
```typescript
export interface Directory {
  id?: string
  path?: string  // <- 应该存在
  projectId?: string
  // ...
}
```

如果缺少 `path`，添加它。

- [ ] **Step 4: 提交类型和翻译检查**

```bash
git add src/locales/lang/en-US.json src/locales/lang/zh-CN.json src/types/index.ts
git commit -m "chore: verify i18n and types for auto-scan feature"
```

---

## Task 7: 单元测试 - GitModuleView

**Files:**
- Create: `src/components/module/__tests__/GitModuleView.spec.ts`

为关键逻辑编写单元测试。

- [ ] **Step 1: 创建测试文件骨架**

创建文件 `src/components/module/__tests__/GitModuleView.spec.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import GitModuleView from '../GitModuleView.vue'
import type { Directory } from '@/types'

// Mock Tauri API
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

vi.mock('@/composables/useApi', () => ({
  gitApi: {
    repoList: vi.fn(),
    repoStatusGet: vi.fn(),
    repoStatusCheck: vi.fn(),
    scan: vi.fn(),
    extractRepoName: vi.fn(),
    repoClone: vi.fn(),
    repoUpdate: vi.fn(),
    repoPull: vi.fn(),
    repoDelete: vi.fn(),
    repoReorder: vi.fn(),
  },
  ideApi: {
    openRepo: vi.fn(),
    openInTerminal: vi.fn(),
  },
  fsApi: {
    readText: vi.fn(),
  },
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: {
    'en-US': {
      git: {
        title: 'Git Repositories',
        refresh: 'Refresh',
        scan: 'Scan',
        directory: 'Directory',
        noRepos: 'No repositories',
        noReposHint: 'Clone or scan to add repositories',
        cloneButton: 'Clone',
      },
      common: {
        loading: 'Loading...',
        cloning: 'Cloning...',
        cancel: 'Cancel',
        delete: 'Delete',
        save: 'Save',
      },
      workspace: {
        pullFailed: 'Pull failed',
      },
    },
  },
})

describe('GitModuleView', () => {
  const mockDirectory: Directory = {
    id: '1',
    projectId: 'proj-1',
    path: '/test/dir',
    relativePath: 'test/dir',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    const wrapper = mount(GitModuleView, {
      props: { directory: mockDirectory },
      global: {
        plugins: [i18n],
      },
    })
    expect(wrapper.exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 添加测试 - 初始加载时自动扫描**

在 `describe` 块内增加测试：

```typescript
it('auto-scans on initial load', async () => {
  const { gitApi } = await import('@/composables/useApi')
  vi.mocked(gitApi.repoList).mockResolvedValue([])
  vi.mocked(gitApi.scan).mockResolvedValue({ scanned: [] })

  const wrapper = mount(GitModuleView, {
    props: { directory: mockDirectory },
    global: {
      plugins: [i18n],
    },
  })

  await flushPromises()

  // Verify loadRepositories was called indirectly (repoList called)
  expect(vi.mocked(gitApi.repoList)).toHaveBeenCalled()
  // Verify handleScan was called (scan called)
  expect(vi.mocked(gitApi.scan)).toHaveBeenCalled()
})
```

- [ ] **Step 3: 添加测试 - 刷新按钮合并功能**

增加测试：

```typescript
it('refresh button calls both scan and refresh', async () => {
  const { gitApi } = await import('@/composables/useApi')
  vi.mocked(gitApi.repoList).mockResolvedValue([
    {
      id: 'repo-1',
      name: 'test-repo',
      path: '/test/dir/repo',
      remoteUrl: 'https://github.com/test/repo.git',
    } as any,
  ])
  vi.mocked(gitApi.scan).mockResolvedValue({ scanned: [] })
  vi.mocked(gitApi.repoStatusCheck).mockResolvedValue({
    id: 'repo-1',
    branch: 'main',
    ahead: 0,
    behind: 0,
    isDirty: false,
  } as any)

  const wrapper = mount(GitModuleView, {
    props: { directory: mockDirectory },
    global: {
      plugins: [i18n],
    },
  })

  await flushPromises()

  // Click refresh button
  const refreshBtn = wrapper.find('.git-module__refresh-btn')
  await refreshBtn.trigger('click')

  await flushPromises()

  // Verify both scan and status check were called
  expect(vi.mocked(gitApi.scan)).toHaveBeenCalledWith('proj-1')
  expect(vi.mocked(gitApi.repoStatusCheck)).toHaveBeenCalledWith('repo-1')
})
```

- [ ] **Step 4: 添加测试 - 扫描按钮被移除**

增加测试：

```typescript
it('does not render scan button', () => {
  const wrapper = mount(GitModuleView, {
    props: { directory: mockDirectory },
    global: {
      plugins: [i18n],
    },
  })

  // Scan button should not exist
  const scanBtn = wrapper.find('.git-module__scan-btn')
  expect(scanBtn.exists()).toBe(false)

  // Refresh button should exist
  const refreshBtn = wrapper.find('.git-module__refresh-btn')
  expect(refreshBtn.exists()).toBe(true)
})
```

- [ ] **Step 5: 运行测试**

```bash
pnpm test src/components/module/__tests__/GitModuleView.spec.ts
```

预期：所有测试通过

- [ ] **Step 6: 提交测试**

```bash
git add src/components/module/__tests__/GitModuleView.spec.ts
git commit -m "test: add tests for auto-scan and merged refresh functionality"
```

---

## Task 8: 集成测试 - 文件监听事件

**Files:**
- Create: `src/components/module/__tests__/GitModuleView.watcher.spec.ts`

测试文件系统监听的去抖逻辑。

- [ ] **Step 1: 创建文件监听测试文件**

创建 `src/components/module/__tests__/GitModuleView.watcher.spec.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import GitModuleView from '../GitModuleView.vue'
import type { Directory } from '@/types'

// 模拟监听函数
let mockListenCallbacks: Record<string, Function> = {}
const mockListen = vi.fn(async (event: string, callback: Function) => {
  mockListenCallbacks[event] = callback
  return vi.fn() // 返回 unlistener
})

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}))

vi.mock('@/composables/useApi', () => ({
  gitApi: {
    repoList: vi.fn().mockResolvedValue([]),
    repoStatusGet: vi.fn(),
    repoStatusCheck: vi.fn(),
    scan: vi.fn().mockResolvedValue({ scanned: [] }),
    extractRepoName: vi.fn(),
    repoClone: vi.fn(),
    repoUpdate: vi.fn(),
    repoPull: vi.fn(),
    repoDelete: vi.fn(),
    repoReorder: vi.fn(),
  },
  ideApi: {
    openRepo: vi.fn(),
    openInTerminal: vi.fn(),
  },
  fsApi: {
    readText: vi.fn(),
  },
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: {
    'en-US': {
      git: {
        title: 'Git Repositories',
        refresh: 'Refresh',
        noRepos: 'No repositories',
        noReposHint: 'Clone or scan to add repositories',
        cloneButton: 'Clone',
        directory: 'Directory',
        scan: 'Scan',
      },
      common: {
        loading: 'Loading...',
        cloning: 'Cloning...',
        cancel: 'Cancel',
        delete: 'Delete',
        save: 'Save',
      },
      workspace: {
        pullFailed: 'Pull failed',
      },
    },
  },
})

describe('GitModuleView - Directory Watcher', () => {
  const mockDirectory: Directory = {
    id: '1',
    projectId: 'proj-1',
    path: '/test/dir',
    relativePath: 'test/dir',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockListenCallbacks = {}
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('setup directory watcher on mount', async () => {
    const wrapper = mount(GitModuleView, {
      props: { directory: mockDirectory },
      global: {
        plugins: [i18n],
      },
    })

    await flushPromises()

    // Verify watcher listener was registered
    expect(mockListen).toHaveBeenCalledWith(
      'git:directory:changed',
      expect.any(Function)
    )
  })

  it('triggers debounced scan on directory change event', async () => {
    const { gitApi } = await import('@/composables/useApi')

    const wrapper = mount(GitModuleView, {
      props: { directory: mockDirectory },
      global: {
        plugins: [i18n],
      },
    })

    await flushPromises()

    // Reset call count after initial load
    vi.mocked(gitApi.scan).mockClear()

    // Simulate directory change event
    const dirChangeCallback = mockListenCallbacks['git:directory:changed']
    if (dirChangeCallback) {
      dirChangeCallback({})
    }

    // Wait for debounce timeout (1500ms)
    await new Promise((resolve) => setTimeout(resolve, 1600))
    await flushPromises()

    // Verify scan was called after debounce
    expect(vi.mocked(gitApi.scan)).toHaveBeenCalledWith('proj-1')
  })

  it('debounces multiple rapid directory change events', async () => {
    const { gitApi } = await import('@/composables/useApi')

    const wrapper = mount(GitModuleView, {
      props: { directory: mockDirectory },
      global: {
        plugins: [i18n],
      },
    })

    await flushPromises()
    vi.mocked(gitApi.scan).mockClear()

    // Simulate 3 rapid directory change events
    const dirChangeCallback = mockListenCallbacks['git:directory:changed']
    if (dirChangeCallback) {
      dirChangeCallback({})
      dirChangeCallback({})
      dirChangeCallback({})
    }

    // Wait for debounce timeout
    await new Promise((resolve) => setTimeout(resolve, 1600))
    await flushPromises()

    // Verify scan was called only once (debounced)
    expect(vi.mocked(gitApi.scan)).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 运行文件监听测试**

```bash
pnpm test src/components/module/__tests__/GitModuleView.watcher.spec.ts
```

预期：所有测试通过

- [ ] **Step 3: 运行完整测试套件**

```bash
pnpm test:run
```

预期：测试覆盖率 ≥ 80%

- [ ] **Step 4: 提交文件监听测试**

```bash
git add src/components/module/__tests__/GitModuleView.watcher.spec.ts
git commit -m "test: add directory watcher and debounce tests"
```

---

## Task 9: 验证和最终检查

**Files:**
- Check: All modified files
- Run: All verification commands

- [ ] **Step 1: 运行类型检查**

```bash
pnpm type-check
```

预期：没有 TypeScript 错误

- [ ] **Step 2: 运行 ESLint**

```bash
pnpm lint
```

预期：没有 linting 错误

- [ ] **Step 3: 运行测试覆盖率**

```bash
pnpm test:coverage
```

预期：覆盖率 ≥ 80%

- [ ] **Step 4: 运行 i18n 检查器**

```bash
/i18n-checker
```

预期：所有检查通过

- [ ] **Step 5: 构建验证**

```bash
pnpm build
```

预期：构建成功，无错误

- [ ] **Step 6: 最终提交**

```bash
git add .
git commit -m "chore: verification and cleanup for auto-scan feature"
```

---

## Task 10: 代码审查清单

**Manual Verification:**

- [ ] **扫描按钮完全移除** - 检查模板中没有扫描按钮代码
- [ ] **初始加载时自动扫描** - loadRepositories() 后调用 handleScan()
- [ ] **文件监听启动/清理** - onMounted 启动，onUnmounted 清理
- [ ] **目录切换时监听器重建** - watch 块正确处理
- [ ] **防抖去抖逻辑** - 1500ms 延迟正确应用
- [ ] **刷新按钮合并功能** - 同时执行扫描和刷新
- [ ] **类型完整性** - Directory 包含 path 字段
- [ ] **i18n 完整性** - 所有翻译键存在

- [ ] **Step 1: 代码审查自清单**

回顾上述清单，确保所有项目都已完成。

- [ ] **Step 2: 提交最终清点**

```bash
git log --oneline -10
```

预期：看到所有的功能提交

---

## 总结

**主要变更：**
1. ✅ 移除了手动扫描按钮（UI + 样式）
2. ✅ 实现了初始加载自动扫描
3. ✅ 实现了文件系统监听和防抖逻辑
4. ✅ 合并了刷新按钮功能（扫描 + 状态更新）
5. ✅ 完整的单元和集成测试覆盖
6. ✅ i18n 和类型检查通过

**验证完成后可以：**
- 创建 PR 进行代码审查
- 合并到 main 分支
- 部署到生产环境

