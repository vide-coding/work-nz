<script setup vapor lang="ts">
import { useLocale } from "./locales/useLocale";
import VaporExample from "./components/VaporExample.vue";

const { locale, changeLocale } = useLocale();
</script>

<template>
  <div class="container mx-auto p-8 max-w-3xl">
    <header class="mb-12 text-center">
      <h1 class="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
        {{ $t("app.title") }}
      </h1>
      <p class="text-xl text-gray-600 dark:text-gray-400">
        {{ $t("app.subtitle") }}
      </p>
      <div class="mt-6 flex items-center justify-center gap-2">
        <button
          class="px-3 py-1 rounded-full border text-sm transition-colors"
          :class="
            locale === 'zh-CN'
              ? 'border-blue-600 text-blue-600'
              : 'border-gray-300 text-gray-500'
          "
          @click="changeLocale('zh-CN')"
        >
          {{ $t("app.langZh") }}
        </button>
        <button
          class="px-3 py-1 rounded-full border text-sm transition-colors"
          :class="
            locale === 'en-US'
              ? 'border-blue-600 text-blue-600'
              : 'border-gray-300 text-gray-500'
          "
          @click="changeLocale('en-US')"
        >
          {{ $t("app.langEn") }}
        </button>
      </div>
    </header>

    <main>
      <VaporExample />
    </main>
  </div>
</template>
