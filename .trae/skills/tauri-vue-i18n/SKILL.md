---
name: "tauri-vue-i18n"
description: "规范 Tauri + Vue 项目 i18n 的目录组织、语言切换与 i18n-ally 配置。用户要新增语言、迁移文案或接入 i18n-ally 时调用。"
---

# Tauri + Vue i18n 规范与 i18n-ally

本技能用于在 Tauri + Vue 工程内落地国际化最佳实践，并确保 i18n-ally 可识别与浏览文案。

## 推荐目录结构

- `src/locales/`：i18n 实例与工具出口
- `src/locales/lang/`：语言资源（建议 JSON 或 YAML，按 `zh-CN`、`en-US` 命名）

## i18n 实例约定

- 默认语言：`zh-CN`
- 回退语言：`zh-CN`
- 仅在入口创建 i18n，并在 `main.ts` 统一挂载
- 组件内使用 `$t` 或 `useI18n`，不直接硬编码文案

## i18n-ally 识别要求

- 语言资源保持嵌套 key 风格（`app.title` 形式）
- 配置 `localesPaths` 指向 `src/locales/lang`
- 指定 `sourceLanguage` 与 `displayLanguage`

## 示例

```ts
import { createI18n } from "vue-i18n";
import zhCN from "./lang/zh-CN.json";
import enUS from "./lang/en-US.json";

const messages = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const;

export type LocaleKey = keyof typeof messages;

/**
 * 创建应用级 i18n 实例。
 */
export const createAppI18n = () =>
  createI18n({
    legacy: false,
    locale: "zh-CN",
    fallbackLocale: "zh-CN",
    globalInjection: true,
    messages,
  });
```

## 常见最佳实践

- 避免在组件内拼接句子，使用完整 key + 参数插值
- 保持 key 稳定，避免随意重命名导致文案丢失
- 统一维护语言列表，集中导出类型以减少拼写错误
