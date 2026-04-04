# Git 自动扫描设计文档

**日期:** 2026-04-04
**功能:** 移除手动扫描按钮，实现自动扫描仓库发现

---

## 概述

当前 Git 模块有两个功能按钮：
- **扫描按钮** - 用户手动点击发现新仓库
- **刷新按钮** - 用户手动点击更新现有仓库的状态

本设计将扫描流程自动化，移除扫描按钮，并增强刷新按钮的功能。

---

## 功能规划

### 1. 自动扫描触发点

#### 1.1 初始加载扫描
- **时机**: 用户切换到某个目录时
- **行为**: 在 `loadRepositories()` 后自动执行 `handleScan()`
- **目的**: 确保目录中的所有仓库都被发现

#### 1.2 文件系统监听
- **范围**: 监听目录的**顶层文件夹变化**（不递归监听内部文件变化）
- **触发**: 检测到顶层有新的文件夹创建或删除时
- **去抖**: 延迟 1-2 秒后执行扫描（防止高频变化触发多次扫描）
- **生命周期**: 用户切换到该目录时启动监听 → 用户离开时销毁监听

#### 1.3 刷新按钮 - 合并功能
- **新职责**: 同时执行扫描 + 刷新
- **行为流程**:
  1. 扫描新仓库 (`handleScan()`)
  2. 刷新所有现有仓库的状态 (`refreshAllRepoStatuses()`)
- **按钮文本**: 从 "Scan" 改为 "Refresh" 或保持现有 "Refresh"
- **交互**: 点击刷新按钮时，两个操作按顺序执行

---

## UI 变更

### 移除的元素
```vue
<!-- 移除此扫描按钮 (第 548-556 行) -->
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

### 样式清理
- 删除 `.git-module__scan-btn` 相关样式（第 828-849 行）
- `.git-module__refresh-btn` 保留

---

## 状态管理

### 现有状态
- `loading` - 初始加载
- `scanning` - 扫描中（可移除或改用）
- `refreshing` - 刷新中（继续保留）

### 状态合并建议
- `scanning` 状态可保留用于跟踪自动扫描状态（文件监听触发的扫描）
- `refreshing` 用于跟踪刷新状态（用户手动点击刷新）
- 两个操作可独立或并行追踪

---

## 实现细节

### 文件系统监听实现

**工具选择**: 使用 Tauri 的文件监听能力
- Tauri 提供 `fs::watch()` 或 filesystem watcher 插件
- 需要在 Rust 后端实现服务端监听，通过 IPC 事件通知前端

**前端逻辑**:
```typescript
// 伪代码
onMounted(async () => {
  // 初始加载仓库
  await loadRepositories()
  // 初始自动扫描
  await handleScan()
  // 启动文件系统监听
  setupFsWatcher()
})

watch(
  () => [props.directory.id, props.directory.projectId],
  () => {
    // 清理旧监听
    cleanupFsWatcher()
    // 初始化新目录
    loadRepositories()
    await handleScan()
    setupFsWatcher()
  }
)

onUnmounted(() => {
  cleanupFsWatcher()
})
```

### 去抖处理
- 使用现有 `debounce` composable（`useDebounce.ts`）
- 配置延迟时间: 1000-2000ms
- 防止频繁的文件变化触发多次扫描

---

## 刷新按钮新逻辑

### 函数合并
```typescript
// 新的 handleRefreshAll() 函数
async function handleRefreshAll() {
  if (!props.directory.projectId) return

  try {
    // 1. 先扫描新仓库
    await handleScan()
    // 2. 再刷新所有仓库状态
    await refreshAllRepoStatuses()
  } catch (e) {
    error.value = e.message
  }
}
```

### 状态指示
- 扫描中 + 刷新中时，按钮同时处于禁用状态
- 考虑统一显示为单一的加载状态

---

## 翻译键

确保以下i18n键存在：
- `git.scan` - 移除后会清理相关UI文本
- `git.refresh` - 保留，用于刷新按钮title

---

## 测试覆盖

### 单元测试
- [ ] 初始加载时自动扫描被触发
- [ ] 目录切换时旧监听被销毁，新监听被启动
- [ ] 文件系统事件触发正确的去抖扫描
- [ ] 刷新按钮同时执行扫描和状态更新

### E2E 测试
- [ ] 用户打开新目录时，自动发现仓库
- [ ] 用户在目录中创建新文件夹，延迟后自动扫描
- [ ] 用户点击刷新按钮，同时完成扫描和状态更新

---

## 影响范围

**修改文件:**
- `src/components/module/GitModuleView.vue` - 主要改动
- `src/locales/lang/en-US.json` - i18n键清理（如有）
- `src/locales/lang/zh-CN.json` - i18n键清理（如有）
- Rust 后端 - 可能需要新增文件监听API（如无现成实现）

**不修改:**
- 仓库卡片组件 `RepoCard.vue` - 无需改动
- API 接口 - 复用现有 `gitApi.scan()` 和 `gitApi.repoStatusCheck()`

---

## 成功标准

- ✅ 扫描按钮被完全移除
- ✅ 初始加载时自动扫描一次
- ✅ 文件系统顶层变化时自动扫描（带去抖）
- ✅ 刷新按钮同时执行扫描 + 状态更新
- ✅ 用户切换目录时正确管理监听器生命周期
- ✅ i18n 检查通过
- ✅ 单元测试覆盖 80%+
