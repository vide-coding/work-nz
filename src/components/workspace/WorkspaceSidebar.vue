<script setup lang="ts">
import type { Component } from 'vue'
import { Home, Code, FileText, Image, Map, Folder } from 'lucide-vue-next'
import type { DirectoryType } from '@/types'

type NavItem = {
  id: string
  labelKey: string
  icon: Component
}

const props = defineProps<{
  currentNav: string
  navItems: NavItem[]
}>()

function navigate(id: string) {
  emit('navigate', id)
}
</script>

<template>
  <aside
    class="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-auto"
  >
    <nav class="p-4 space-y-1">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left"
        :class="
          currentNav === item.id
            ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        "
        @click="navigate(item.id)"
      >
        <component :is="item.icon" class="w-5 h-5" />
        <span class="text-sm font-medium">{{ $t(item.labelKey) }}</span>
      </button>
    </nav>
  </aside>
</template>
