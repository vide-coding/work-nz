<script setup lang="ts">
defineProps<{
  label: string
  description?: string
}>()
</script>

<template>
  <div class="py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
    <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
      {{ label }}
    </div>
    <div v-if="description" class="mt-1 text-xs text-gray-500 dark:text-gray-400">
      {{ description }}
    </div>
    <div class="mt-3">
      <slot></slot>
    </div>
  </div>
</template>
