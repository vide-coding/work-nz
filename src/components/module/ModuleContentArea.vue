<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Directory } from '@/types'
import { moduleRegistry } from '@/composables/useModuleRegistry'
import GitModuleView from './GitModuleView.vue'
import FileModuleView from './FileModuleView.vue'

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
  <div class="module-content-area">
    <!-- No module assigned -->
    <div v-if="!module" class="module-content-area__empty">
      <div class="module-content-area__empty-content">
        <p class="module-content-area__empty-title">{{ t('module.noModule') }}</p>
        <p class="module-content-area__empty-description">
          {{ t('module.selectHint') }}
        </p>
      </div>
    </div>

    <!-- Module enabled -->
    <div v-else class="module-content-area__content">
      <!-- Module-specific content -->
      <div class="module-content-area__body">
        <!-- Git Module Content -->
        <template v-if="moduleType === 'git'">
          <GitModuleView :directory="props.directory" />
        </template>

        <!-- Task Module Content -->
        <template v-else-if="moduleType === 'task'">
          <div class="module-content-area__tasks">
            <p>{{ t('module.taskEnabled') }}</p>
            <p class="module-content-area__hint">
              {{ t('module.taskHint') }}
            </p>
          </div>
        </template>

        <!-- File Module Content -->
        <template v-else-if="moduleType === 'file'">
          <FileModuleView :directory="props.directory" :project-path="props.projectPath" />
        </template>

        <!-- Unknown module type -->
        <template v-else>
          <div class="module-content-area__unknown">
            <p>{{ t('module.notImplemented') }}</p>
            <p class="module-content-area__hint">{{ module.name }}</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.module-content-area {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.module-content-area__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
}

.module-content-area__empty-content {
  text-align: center;
  color: #6b7280;
}

.module-content-area__empty-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: #374151;
}

.module-content-area__empty-description {
  margin: 0;
  font-size: 14px;
}

.module-content-area__content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.module-content-area__body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.module-content-area__hint {
  margin-top: 8px;
  font-size: 13px;
  color: #9ca3af;
}

.module-content-area__git,
.module-content-area__tasks,
.module-content-area__files,
.module-content-area__unknown {
  color: #374151;
}
</style>
