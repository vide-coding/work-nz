<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Directory } from '@/types'
import { moduleRegistry } from '@/composables/useModuleRegistry'
import GitModuleView from './GitModuleView.vue'

const { t } = useI18n()

interface Props {
  directory: Directory
}

const props = defineProps<Props>()

// Get the module for this directory
const module = computed(() => {
  if (!props.directory.moduleId) return null
  return moduleRegistry.get(props.directory.moduleId)
})

// Determine which composable to use based on module
const moduleType = computed(() => module.value?.key)

// Module capabilities
const capabilities = computed(() => {
  if (!props.directory.moduleId) return []
  const mod = moduleRegistry.get(props.directory.moduleId)
  return mod?.capabilities ?? []
})
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
      <!-- Module Header -->
      <div class="module-content-area__header">
        <div class="module-content-area__module-info">
          <span class="module-content-area__module-icon">
            {{ module.icon || module.key.charAt(0).toUpperCase() }}
          </span>
          <div class="module-content-area__module-details">
            <h3 class="module-content-area__module-name">{{ module.name }}</h3>
            <p class="module-content-area__module-description">{{ module.description }}</p>
          </div>
        </div>
      </div>

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
          <div class="module-content-area__files">
            <p>{{ t('module.fileEnabled') }}</p>
            <p class="module-content-area__hint">{{ t('module.fileHint') }}</p>
          </div>
        </template>

        <!-- Unknown module type -->
        <template v-else>
          <div class="module-content-area__unknown">
            <p>{{ t('module.notImplemented') }}</p>
            <p class="module-content-area__hint">{{ module.name }}</p>
          </div>
        </template>
      </div>

      <!-- Capabilities indicator -->
      <div class="module-content-area__capabilities">
        <span class="module-content-area__capabilities-label">{{ t('module.capabilities') }}</span>
        <div class="module-content-area__capabilities-list">
          <span v-for="cap in capabilities" :key="cap" class="module-content-area__capability">
            {{ cap }}
          </span>
        </div>
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

.module-content-area__header {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.module-content-area__module-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.module-content-area__module-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #3b82f6;
  color: white;
  border-radius: 8px;
  font-size: 18px;
  font-weight: 600;
}

.module-content-area__module-details {
  flex: 1;
}

.module-content-area__module-name {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.module-content-area__module-description {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
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

.module-content-area__capabilities {
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
}

.module-content-area__capabilities-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin-right: 8px;
}

.module-content-area__capabilities-list {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.module-content-area__capability {
  display: inline-block;
  padding: 2px 8px;
  background-color: #e5e7eb;
  border-radius: 4px;
  font-size: 11px;
  color: #4b5563;
}
</style>
