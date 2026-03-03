<script setup lang="ts">
import { Globe } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: 'zh-CN' | 'en-US'
  variant?: 'button' | 'select'
}>(), {
  variant: 'button'
})

const emit = defineEmits<{
  'update:modelValue': [locale: 'zh-CN' | 'en-US']
}>()

const languageLabel = computed(() => {
  return props.modelValue === 'zh-CN' ? '中文' : 'English'
})

function toggleLanguage() {
  const newLocale = props.modelValue === 'zh-CN' ? 'en-US' : 'zh-CN'
  emit('update:modelValue', newLocale)
}

function selectLanguage(locale: 'zh-CN' | 'en-US') {
  emit('update:modelValue', locale)
}
</script>

<template>
  <!-- Button variant - toggles between languages -->
  <button
    v-if="variant === 'button'"
    class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
    @click="toggleLanguage"
  >
    <Globe class="w-4 h-4 text-gray-600 dark:text-gray-300" />
    <span class="text-sm text-gray-600 dark:text-gray-300">{{ languageLabel }}</span>
  </button>

  <!-- Select variant - dropdown -->
  <select
    v-else-if="variant === 'select'"
    :value="modelValue"
    class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
    @change="selectLanguage(($event.target as HTMLSelectElement).value as 'zh-CN' | 'en-US')"
  >
    <option value="zh-CN">中文</option>
    <option value="en-US">English</option>
  </select>
</template>
