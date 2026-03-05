<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  text: string
}>()

const isVisible = ref(false)

function show() {
  isVisible.value = true
}

function hide() {
  isVisible.value = false
}
</script>

<template>
  <div class="relative inline-flex" @mouseenter="show" @mouseleave="hide">
    <slot />
    <span
      v-if="isVisible"
      class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded whitespace-nowrap z-10 pointer-events-none"
    >
      {{ text }}
    </span>
  </div>
</template>
