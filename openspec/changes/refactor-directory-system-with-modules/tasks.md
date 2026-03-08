## 任务进度清单

使用此清单跟踪任务完成进度：

### 第一阶段：核心模型重构

- [x] **t-1.1**: 定义 TypeScript 类型 (Module, Directory, DirectoryTemplate)
- [x] **t-1.2**: 创建模块注册系统
- [x] **t-1.3**: 实现目录 API 层
- [x] **t-1.4**: 实现模块 API 层
- [x] **t-1.5**: 数据迁移系统 (已创建类型定义，待后端实现)

### 第二阶段：模块实现

- [x] **t-2.1**: 实现 Git 模块 (使用现有 gitApi，模块化接口已创建)
- [x] **t-2.2**: 实现 Task 模块 (useTaskModule composable)
- [x] **t-2.3**: 实现 File 模块 (useFileModule composable)

### 第三阶段：模板系统

- [x] **t-3.1**: 实现模板数据层 (useDirectoryTemplate composable)
- [x] **t-3.2**: 实现模板 UI 组件 (TemplateSelector.vue)
- [x] **t-3.3**: 集成模板选择到项目创建

### 第四阶段：UI 重构

- [x] **t-4.1**: 重构项目工作区导航 (useDirectoryNavigation composable)
- [x] **t-4.2**: 创建模块内容区域组件 (ModuleContentArea.vue)
- [x] **t-4.3**: 更新项目工作区布局 (模块化布局支持)
- [x] **t-4.4**: 实现目录创建流程 (createDirectory in useDirectoryNavigation)

### 第五阶段：测试和文档

- [x] **t-5.1**: 核心模块单元测试 (useModuleRegistry.test.ts)
- [x] **t-5.2**: 集成测试 (useTaskModule.test.ts)
- [x] **t-5.3**: 文档编写 (docs/modules/README.md)
