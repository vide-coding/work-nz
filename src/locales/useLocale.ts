import { useI18n } from "vue-i18n";
import type { LocaleKey } from ".";

export const langList: Array<{ value: LocaleKey; contentKey: string }> = [
  { value: "zh-CN", contentKey: "app.langZh" },
  { value: "en-US", contentKey: "app.langEn" },
];

export const useLocale = () => {
  const { locale } = useI18n();

  const changeLocale = (next: LocaleKey) => {
    locale.value = next;
  };

  return {
    locale,
    changeLocale,
    langList,
  };
};
