<script setup lang="ts">
import { Search, PanelRightClose, PanelRightOpen } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    searchQuery: string
    showPreview: boolean
  }>(),
  {
    searchQuery: '',
    showPreview: true,
  }
)

const emit = defineEmits<{
  'update:searchQuery': [query: string]
  'update:showPreview': [show: boolean]
}>()

function togglePreview() {
  emit('update:showPreview', !props.showPreview)
}
</script>

<template>
  <div class="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="flex items-center gap-4">
      <!-- Search -->
      <div class="flex-1 relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          :value="searchQuery"
          type="text"
          placeholder="搜索项目..."
          class="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-indigo-500"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Toggle Preview -->
      <button
        class="p-2 rounded-lg transition-colors"
        :class="
          showPreview
            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        "
        @click="togglePreview"
      >
        <component :is="showPreview ? PanelRightClose : PanelRightOpen" class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>
