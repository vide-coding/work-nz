<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Directory } from '@/types'
import { moduleRegistry } from '@/composables/useModuleRegistry'
import GitModuleView from './GitModuleView.vue'
import FileModuleView from './FileModuleView.vue'
import TaskBoardView from './TaskBoardView.vue'

const { t } = useI18n()

interface Props {
  directory: Directory
  /** The project root path for file operations */
  projectPath: string
}

const props = defineProps<Props>()

// Get the module for this directory
const module = computed(() => {
  if (!props.directory.moduleId) return null
  return moduleRegistry.get(props.directory.moduleId)
})

// Determine which composable to use based on module
const moduleType = computed(() => module.value?.key)
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- No module assigned -->
    <div v-if="!module" class="flex-1 flex items-center justify-center p-8">
      <div class="text-center text-gray-500">
        <p class="m-0 mb-2 text-lg font-semibold text-gray-700">{{ t('module.noModule') }}</p>
        <p class="m-0 text-sm">{{ t('module.selectHint') }}</p>
      </div>
    </div>

    <!-- Module enabled -->
    <div v-else class="h-full flex flex-col">
      <!-- Module-specific content -->
      <div class="flex-1 p-4 overflow-y-auto">
        <!-- Git Module Content -->
        <template v-if="moduleType === 'git'">
          <GitModuleView :directory="props.directory" />
        </template>

        <!-- Task Module Content -->
        <template v-else-if="moduleType === 'task'">
          <TaskBoardView :key="props.directory.id" :directory="props.directory" />
        </template>

        <!-- File Module Content -->
        <template v-else-if="moduleType === 'file'">
          <FileModuleView :directory="props.directory" :project-path="props.projectPath" />
        </template>

        <!-- Unknown module type -->
        <template v-else>
          <div class="text-gray-700">
            <p>{{ t('module.notImplemented') }}</p>
            <p class="mt-2 text-[13px] text-gray-400">{{ module.name }}</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
