import { createI18n } from "vue-i18n";
import enUS from "./lang/en-US.json";
import zhCN from "./lang/zh-CN.json";

const messages = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const;

export type LocaleKey = keyof typeof messages;

export const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "zh-CN",
  globalInjection: true,
  messages,
});

export const t = i18n.global.t;
export const te = i18n.global.te;
