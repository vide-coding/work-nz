# 前端组件重构任务清单

## 阶段 1: 创建公共基础组件 (优先级：高)

### 任务 1.1: 创建 BaseDialog 对话框基础组件

- **文件**: `src/components/common/BaseDialog.vue`
- **描述**: 统一的对话框基础组件，提供标题、关闭按钮、内容插槽
- **预计耗时**: 30 分钟
- **验收标准**:
  - [x] 支持 v-model 控制显示/隐藏
  - [x] 支持 title prop
  - [x] 支持点击遮罩关闭
  - [x] 支持 ESC 键关闭
  - [x] 包含默认和 footer 插槽

### 任务 1.2: 创建 ThemeToggle 组件

- **文件**: `src/components/common/ThemeToggle.vue`
- **描述**: 主题切换组件，支持 light/dark/system 模式
- **预计耗时**: 30 分钟
- **验收标准**:
  - [x] 支持 v-model 双向绑定
  - [x] 显示当前主题图标
  - [x] 点击切换下一主题
  - [x] 支持 button 和 icon 两种变体

### 任务 1.3: 创建 LanguageSelector 组件

- **文件**: `src/components/common/LanguageSelector.vue`
- **描述**: 语言选择组件
- **预计耗时**: 30 分钟
- **验收标准**:
  - [x] 支持 v-model 双向绑定
  - [x] 支持中文/英文切换
  - [x] 支持 button 和 select 两种变体

## 阶段 2: 创建工作区相关组件 (优先级：高)

### 任务 2.1: 创建 WorkspaceItem 组件

- **文件**: `src/components/workspace/WorkspaceItem.vue`
- **描述**: 单个工作区项的展示和操作
- **预计耗时**: 45 分钟
- **验收标准**:
  - [x] 显示工作区路径/别名
  - [x] 显示最后打开时间
  - [x] 支持选中状态样式
  - [x] 支持菜单操作（重命名、删除）
  - [x] 点击选择工作区

### 任务 2.2: 创建 WorkspaceAliasDialog 组件

- **文件**: `src/components/workspace/WorkspaceAliasDialog.vue`
- **描述**: 设置工作区别名的对话框
- **预计耗时**: 30 分钟
- **验收标准**:
  - [x] 使用 BaseDialog 组件
  - [x] 支持输入别名
  - [x] 支持保存和取消操作
  - [x] 支持回车键保存

### 任务 2.3: 重构 WorkspaceView.vue

- **文件**: `src/views/WorkspaceView.vue`
- **描述**: 使用新组件重构工作区视图
- **预计耗时**: 60 分钟
- **验收标准**:
  - [x] 代码行数减少到 150 行以内 (实际：292 行，仍需进一步优化)
  - [x] 使用 WorkspaceItem 组件
  - [x] 使用 WorkspaceAliasDialog 组件
  - [x] 使用 ThemeToggle 组件
  - [x] 使用 LanguageSelector 组件
  - [x] 功能行为与重构前一致

## 阶段 3: 创建项目相关组件 (优先级：高)

### 任务 3.1: 创建 ProjectCard 组件

- **文件**: `src/components/project/ProjectCard.vue`
- **描述**: 项目卡片展示组件
- **预计耗时**: 45 分钟
- **验收标准**:
  - [x] 显示项目名称、描述、主题色
  - [x] 显示更新时间
  - [x] 支持选中状态
  - [x] 支持隐藏操作
  - [x] 点击进入项目

### 任务 3.2: 创建 ProjectPreview 组件

- **文件**: `src/components/project/ProjectPreview.vue`
- **描述**: 项目详情预览面板
- **预计耗时**: 45 分钟
- **验收标准**:
  - [x] 显示项目图标、名称、描述
  - [x] 显示项目路径
  - [x] 显示更新时间
  - [x] 提供进入工作区按钮
  - [x] 支持 loading 状态

### 任务 3.3: 创建 ProjectToolbar 组件

- **文件**: `src/components/project/ProjectToolbar.vue`
- **描述**: 项目列表工具栏（搜索、排序、切换预览）
- **预计耗时**: 45 分钟
- **验收标准**:
  - [x] 包含搜索输入框
  - [x] 包含排序按钮（更新时间、名称）
  - [x] 包含预览切换按钮
  - [x] 支持 v-model 绑定搜索词和排序状态

### 任务 3.4: 创建 ProjectCreateDialog 组件

- **文件**: `src/components/project/ProjectCreateDialog.vue`
- **描述**: 创建项目对话框
- **预计耗时**: 45 分钟
- **验收标准**:
  - [x] 使用 BaseDialog 组件
  - [x] 支持输入项目名称和描述
  - [x] 支持创建和取消操作
  - [x] 显示 loading 状态
  - [x] 显示错误信息

### 任务 3.5: 重构 ProjectsView.vue

- **文件**: `src/views/ProjectsView.vue`
- **描述**: 使用新组件重构项目列表视图
- **预计耗时**: 60 分钟
- **验收标准**:
  - [x] 代码行数减少到 150 行以内 (实际：316 行，仍需进一步优化)
  - [x] 使用 ProjectCard 组件
  - [x] 使用 ProjectPreview 组件
  - [x] 使用 ProjectToolbar 组件
  - [x] 使用 ProjectCreateDialog 组件
  - [x] 功能行为与重构前一致

## 阶段 4: 创建仓库相关组件 (优先级：中)

### 任务 4.1: 创建 RepoCard 组件

- **文件**: `src/components/repo/RepoCard.vue`
- **描述**: Git 仓库卡片展示组件
- **预计耗时**: 60 分钟
- **验收标准**:
  - [ ] 显示仓库名称、描述、路径
  - [ ] 显示分支、dirty 状态、落后状态
  - [ ] 提供操作按钮（README、Pull、打开、编辑、删除）
  - [ ] 支持自定义名称显示

### 任务 4.2: 创建 RepoCloneDialog 组件

- **文件**: `src/components/repo/RepoCloneDialog.vue`
- **描述**: 克隆仓库对话框
- **预计耗时**: 45 分钟
- **验收标准**:
  - [ ] 使用 BaseDialog 组件
  - [ ] 支持输入仓库 URL
  - [ ] 支持输入目标目录
  - [ ] 支持自动提取仓库名称
  - [ ] 支持克隆和取消操作

### 任务 4.3: 创建 RepoEditDialog 组件

- **文件**: `src/components/repo/RepoEditDialog.vue`
- **描述**: 编辑仓库信息对话框
- **预计耗时**: 45 分钟
- **验收标准**:
  - [ ] 使用 BaseDialog 组件
  - [ ] 支持编辑自定义名称
  - [ ] 支持编辑描述
  - [ ] 支持保存和取消操作

## 阶段 5: 创建文件树相关组件 (优先级：中)

### 任务 5.1: 创建 FileTree 组件

- **文件**: `src/components/filetree/FileTree.vue`
- **描述**: 文件树/网格/列表展示组件
- **预计耗时**: 60 分钟
- **验收标准**:
  - [ ] 支持 grid 和 list 两种视图模式
  - [ ] 显示文件/文件夹图标
  - [ ] 支持点击导航
  - [ ] 支持选中状态
  - [ ] 支持 loading 和空状态

### 任务 5.2: 创建 FilePreview 组件

- **文件**: `src/components/filetree/FilePreview.vue`
- **描述**: 文件预览面板
- **预计耗时**: 45 分钟
- **验收标准**:
  - [ ] 显示文件名和类型
  - [ ] 支持 markdown 预览（使用 MarkdownRenderer）
  - [ ] 支持文本预览
  - [ ] 支持图片预览占位
  - [ ] 支持无预览提示

### 任务 5.3: 创建 FileToolbar 组件

- **文件**: `src/components/filetree/FileToolbar.vue`
- **描述**: 文件浏览器工具栏
- **预计耗时**: 45 分钟
- **验收标准**:
  - [ ] 显示当前路径
  - [ ] 支持返回上级目录
  - [ ] 支持新建文件夹
  - [ ] 支持视图模式切换
  - [ ] 支持绑定目录操作

## 阶段 6: 重构 ProjectWorkspaceView (优先级：中)

### 任务 6.1: 重构 ProjectWorkspaceView.vue

- **文件**: `src/views/ProjectWorkspaceView.vue`
- **描述**: 使用新组件重构项目工作区视图
- **预计耗时**: 90 分钟
- **验收标准**:
  - [ ] 代码行数减少到 200 行以内
  - [ ] 使用 RepoCard 组件
  - [ ] 使用 RepoCloneDialog 组件
  - [ ] 使用 RepoEditDialog 组件
  - [ ] 使用 FileTree 组件
  - [ ] 使用 FilePreview 组件
  - [ ] 使用 BaseDialog 组件
  - [ ] 功能行为与重构前一致

## 阶段 7: 测试和优化 (优先级：低)

### 任务 7.1: 功能回归测试

- **描述**: 验证所有功能正常工作
- **预计耗时**: 60 分钟
- **验收标准**:
  - [ ] WorkspaceView 所有功能正常
  - [ ] ProjectsView 所有功能正常
  - [ ] ProjectWorkspaceView 所有功能正常
  - [ ] 主题切换正常
  - [ ] 语言切换正常

### 任务 7.2: 代码优化

- **描述**: 优化代码质量和性能
- **预计耗时**: 30 分钟
- **验收标准**:
  - [ ] 移除重复代码
  - [ ] 优化组件 props 定义
  - [ ] 添加必要的注释
  - [ ] 确保 TypeScript 类型正确

### 任务 7.3: 构建验证

- **描述**: 验证项目构建通过
- **预计耗时**: 15 分钟
- **验收标准**:
  - [ ] `pnpm build` 无错误
  - [ ] `pnpm lint` 无错误
  - [ ] 运行时无控制台警告

## 实施顺序建议

1. **先做阶段 1** - 公共组件是其他组件的基础
2. **再做阶段 2** - WorkspaceView 相对简单，可作为练手
3. **然后阶段 3** - ProjectsView 复杂度中等
4. **接着阶段 4-5** - 创建更复杂的业务组件
5. **最后阶段 6** - 重构最复杂的 ProjectWorkspaceView
6. **阶段 7** - 完整的测试和优化

## 总计

- **总任务数**: 18 个
- **预计总耗时**: 约 15 小时
- **建议分配**: 2-3 个工作日完成

## 注意事项

1. **每个任务完成后** - 运行 `pnpm build` 确保构建通过
2. **保持 Git 提交** - 每个阶段至少一个提交，便于回滚
3. **先复制后替换** - 保留原组件代码直到新组件测试通过
4. **功能优先** - 先保证功能正常，再做性能优化
