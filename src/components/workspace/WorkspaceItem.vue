<script setup lang="ts">
import { computed } from 'vue'
import { MoreVertical } from 'lucide-vue-next'
import type { WorkspaceInfo } from '@/types'

const props = defineProps<{
  workspace: WorkspaceInfo
  selected: boolean
  activeMenu: string | null
}>()

const emit = defineEmits<{
  select: []
  rename: [event: Event]
  delete: [event: Event]
  'toggle-menu': [event: Event]
}>()

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const displayName = computed(() => {
  return props.workspace.alias || props.workspace.path.split(/[\\/]/).pop() || props.workspace.path
})
</script>

<template>
  <div
    class="relative flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
    :class="[
      selected
        ? 'bg-indigo-100 dark:bg-indigo-900/40 border-2 border-indigo-500 dark:border-indigo-400'
        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-2 border-transparent',
    ]"
    @click="emit('select')"
  >
    <div class="min-w-0 flex-1">
      <p
        class="text-sm font-medium truncate"
        :class="selected ? 'text-indigo-900 dark:text-indigo-200' : 'text-gray-900 dark:text-white'"
      >
        {{ displayName }}
      </p>
      <p class="text-xs text-gray-500 dark:text-gray-400">
        {{ workspace.alias ? workspace.path : formatDate(workspace.lastOpenedAt) }}
      </p>
    </div>

    <!-- Menu Button -->
    <div class="relative ml-2">
      <button
        class="p-1.5 rounded-md transition-colors"
        :class="
          selected
            ? 'hover:bg-indigo-200 dark:hover:bg-indigo-800'
            : 'hover:bg-gray-200 dark:hover:bg-gray-600'
        "
        @click.stop="emit('toggle-menu', $event)"
      >
        <MoreVertical
          class="w-4 h-4"
          :class="
            selected ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400'
          "
        />
      </button>

      <!-- Dropdown Menu -->
      <div
        v-if="activeMenu === workspace.path"
        class="absolute right-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-600 z-10"
        @click.stop
      >
        <button
          class="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-md"
          @click.stop="emit('rename', $event)"
        >
          {{ $t('workspace.rename') }}
        </button>
        <button
          class="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 last:rounded-b-md"
          @click.stop="emit('delete', $event)"
        >
          {{ $t('common.delete') }}
        </button>
      </div>
    </div>
  </div>
</template>
