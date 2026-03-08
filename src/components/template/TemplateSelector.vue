<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDirectoryTemplate } from '@/composables/useDirectoryTemplate'
import type { DirectoryTemplate, TemplateScope } from '@/types'

interface Props {
  projectId?: string
  selectedTemplateId?: string
}

const props = withDefaults(defineProps<Props>(), {
  projectId: undefined,
  selectedTemplateId: undefined,
})

const emit = defineEmits<{
  select: [template: DirectoryTemplate]
  apply: [template: DirectoryTemplate]
  create: [template: DirectoryTemplate]
}>()

const { templates, templatesByScope, loading, error, loadTemplates, applyTemplate } =
  useDirectoryTemplate()

const activeScope = ref<TemplateScope | 'all'>('all')
const searchQuery = ref('')
const applyingTemplate = ref(false)

const filteredTemplates = computed(() => {
  let result = templates.value

  // Filter by scope
  if (activeScope.value !== 'all') {
    result = result.filter((t) => t.scope === activeScope.value)
  }

  // Filter by search query
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(
      (t) => t.name.toLowerCase().includes(query) || t.description?.toLowerCase().includes(query)
    )
  }

  return result
})

const scopeLabels: Record<TemplateScope | 'all', string> = {
  all: 'All Templates',
  official: 'Official',
  project: 'Project',
  local: 'Local',
}

onMounted(async () => {
  await loadTemplates(undefined, props.projectId)
})

function selectTemplate(template: DirectoryTemplate) {
  emit('select', template)
}

async function handleApply(template: DirectoryTemplate) {
  if (!props.projectId) {
    emit('select', template)
    return
  }

  applyingTemplate.value = true
  try {
    const directories = await applyTemplate(template.id, props.projectId)
    emit('apply', template)
  } finally {
    applyingTemplate.value = false
  }
}
</script>

<template>
  <div class="template-selector">
    <!-- Header -->
    <div class="template-selector__header">
      <h3 class="template-selector__title">Select Template</h3>

      <!-- Search -->
      <div class="template-selector__search">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search templates..."
          class="template-selector__search-input"
        />
      </div>

      <!-- Scope Tabs -->
      <div class="template-selector__tabs">
        <button
          v-for="(label, scope) in scopeLabels"
          :key="scope"
          :class="[
            'template-selector__tab',
            { 'template-selector__tab--active': activeScope === scope },
          ]"
          @click="activeScope = scope as TemplateScope | 'all'"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="template-selector__loading">
      <span>Loading templates...</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="template-selector__error">
      {{ error }}
    </div>

    <!-- Template Grid -->
    <div v-else class="template-selector__grid">
      <div
        v-for="template in filteredTemplates"
        :key="template.id"
        :class="[
          'template-card',
          { 'template-card--selected': selectedTemplateId === template.id },
        ]"
        @click="selectTemplate(template)"
      >
        <div class="template-card__header">
          <span :class="['template-card__scope', `template-card__scope--${template.scope}`]">
            {{ template.scope }}
          </span>
          <button
            v-if="projectId"
            class="template-card__apply-btn"
            :disabled="applyingTemplate"
            @click.stop="handleApply(template)"
          >
            {{ applyingTemplate ? 'Applying...' : 'Apply' }}
          </button>
        </div>

        <h4 class="template-card__name">{{ template.name }}</h4>
        <p v-if="template.description" class="template-card__description">
          {{ template.description }}
        </p>

        <div class="template-card__meta">
          <span class="template-card__item-count"> {{ template.items.length }} directories </span>
        </div>

        <!-- Preview Items -->
        <div class="template-card__items">
          <div
            v-for="(item, index) in template.items.slice(0, 3)"
            :key="index"
            class="template-card__item"
          >
            <span class="template-card__item-path">{{ item.relativePath }}</span>
            <span class="template-card__item-module">{{ item.moduleId }}</span>
          </div>
          <div v-if="template.items.length > 3" class="template-card__item-more">
            +{{ template.items.length - 3 }} more
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredTemplates.length === 0" class="template-selector__empty">
        <p>No templates found</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-selector {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.template-selector__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.template-selector__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.template-selector__search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
}

.template-selector__tabs {
  display: flex;
  gap: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.template-selector__tab {
  padding: 8px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.template-selector__tab:hover {
  color: #374151;
}

.template-selector__tab--active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.template-selector__loading,
.template-selector__error,
.template-selector__empty {
  padding: 24px;
  text-align: center;
  color: #6b7280;
}

.template-selector__error {
  color: #ef4444;
}

.template-selector__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.template-card {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.1);
}

.template-card--selected {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.template-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.template-card__scope {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.template-card__scope--official {
  background-color: #dbeafe;
  color: #1d4ed8;
}

.template-card__scope--project {
  background-color: #d1fae5;
  color: #047857;
}

.template-card__scope--local {
  background-color: #fef3c7;
  color: #b45309;
}

.template-card__apply-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background-color: #3b82f6;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.template-card__apply-btn:hover:not(:disabled) {
  background-color: #2563eb;
}

.template-card__apply-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.template-card__name {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.template-card__description {
  margin: 0 0 12px;
  font-size: 14px;
  color: #6b7280;
}

.template-card__meta {
  margin-bottom: 12px;
  font-size: 12px;
  color: #9ca3af;
}

.template-card__items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.template-card__item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.template-card__item-path {
  color: #374151;
}

.template-card__item-module {
  color: #9ca3af;
}

.template-card__item-more {
  font-size: 12px;
  color: #9ca3af;
  font-style: italic;
}
</style>
