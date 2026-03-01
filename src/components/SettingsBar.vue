<script setup lang="ts">
import { computed } from 'vue';
import { useLocale } from '../locales/useLocale';
import { Palette, Globe } from 'lucide-vue-next';

const props = defineProps<{
  themeMode: 'light' | 'dark' | 'system' | 'custom';
}>();

const emit = defineEmits<{
  (e: 'update:theme', theme: 'light' | 'dark' | 'system' | 'custom'): void;
}>();

const { locale, changeLocale } = useLocale();

// Theme display name
const themeDisplayName = computed(() => {
  switch (props.themeMode) {
    case 'light':
      return 'Light';
    case 'dark':
      return 'Dark';
    case 'system':
      return 'System';
    case 'custom':
      return 'Custom';
    default:
      return 'System';
  }
});

// Language display name
const languageDisplayName = computed(() => {
  return locale.value === 'zh-CN' ? '中文' : 'English';
});

async function toggleTheme() {
  const themes: Array<'light' | 'dark' | 'system' | 'custom'> = [
    'light',
    'dark',
    'system',
    'custom',
  ];
  const currentIndex = themes.indexOf(props.themeMode);
  const nextTheme = themes[(currentIndex + 1) % themes.length];
  emit('update:theme', nextTheme);
}

async function toggleLanguage() {
  const newLocale = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN';
  await changeLocale(newLocale);
}
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Language Toggle -->
    <button
      class="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
      @click="toggleLanguage"
    >
      <Globe class="w-5 h-5" />
      <span class="text-sm font-medium">{{ languageDisplayName }}</span>
    </button>
    <!-- Theme Toggle -->
    <button
      class="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
      @click="toggleTheme"
    >
      <Palette class="w-5 h-5" />
      <span class="text-sm font-medium">{{ themeDisplayName }}</span>
    </button>
  </div>
</template>
