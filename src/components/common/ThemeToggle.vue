<script setup lang="ts">
import { computed } from 'vue'
import { Moon, Sun, Monitor } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  modelValue: 'light' | 'dark' | 'system'
  variant?: 'button' | 'icon' | 'select'
}>(), {
  variant: 'button'
})

const emit = defineEmits<{
  'update:modelValue': [theme: 'light' | 'dark' | 'system']
}>()

const themeIcon = computed(() => {
  switch (props.modelValue) {
    case 'light':
      return Sun
    case 'dark':
      return Moon
    case 'system':
      return Monitor
  }
})

const themeLabel = computed(() => {
  switch (props.modelValue) {
    case 'light':
      return 'Light'
    case 'dark':
      return 'Dark'
    case 'system':
      return 'System'
  }
})

function toggleTheme() {
  const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
  const currentIndex = themes.indexOf(props.modelValue)
  const nextTheme = themes[(currentIndex + 1) % themes.length]
  emit('update:modelValue', nextTheme)
}

function selectTheme(theme: 'light' | 'dark' | 'system') {
  emit('update:modelValue', theme)
}
</script>

<template>
  <!-- Button variant - cycles through themes -->
  <button
    v-if="variant === 'button'"
    class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
    @click="toggleTheme"
    :title="`Current: ${themeLabel}. Click to change.`"
  >
    <component :is="themeIcon" class="w-4 h-4 text-gray-600 dark:text-gray-300" />
    <span class="text-sm text-gray-600 dark:text-gray-300">{{ themeLabel }}</span>
  </button>

  <!-- Icon variant - just the icon -->
  <button
    v-else-if="variant === 'icon'"
    class="p-1.5 rounded-md transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
    @click="toggleTheme"
    :title="`Current: ${themeLabel}. Click to change.`"
  >
    <component :is="themeIcon" class="w-5 h-5 text-gray-600 dark:text-gray-300" />
  </button>

  <!-- Select variant - dropdown -->
  <select
    v-else-if="variant === 'select'"
    :value="modelValue"
    class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-indigo-500"
    @change="selectTheme(($event.target as HTMLSelectElement).value as 'light' | 'dark' | 'system')"
  >
    <option value="light">Light</option>
    <option value="dark">Dark</option>
    <option value="system">System</option>
  </select>
</template>
