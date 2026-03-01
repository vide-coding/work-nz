import 'vue-i18n';

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $t: (key: string, values?: Record<string, unknown>) => string;
    $te: (key: string) => boolean;
  }
}
