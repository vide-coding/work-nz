<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDirectoryTemplate } from '@/composables/useDirectoryTemplate'
import type { DirectoryTemplate, TemplateScope } from '@/types'

const { t } = useI18n()

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

const { templates, loading, error, loadTemplates, applyTemplate } = useDirectoryTemplate()

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
  all: t('template.scopeAll'),
  official: t('template.scopeOfficial'),
  project: t('template.scopeProject'),
  local: t('template.scopeLocal'),
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
    await applyTemplate(template.id, props.projectId)
    emit('apply', template)
  } finally {
    applyingTemplate.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Header -->
    <div class="flex flex-col gap-3">
      <h3 class="m-0 text-lg font-semibold">{{ t('template.selectTitle') }}</h3>

      <!-- Search -->
      <div class="w-full">
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="t('template.searchPlaceholder')"
          class="w-full px-3 py-2 text-sm border border-gray-200 rounded-md"
        />
      </div>

      <!-- Scope Tabs -->
      <div class="flex gap-2 border-b border-gray-200">
        <button
          v-for="(label, scope) in scopeLabels"
          :key="scope"
          class="px-4 py-2 text-sm text-gray-500 bg-transparent border-none cursor-pointer border-b-2 transition-all"
          :class="activeScope === scope ? 'text-blue-500 border-blue-500' : 'border-transparent hover:text-gray-700'"
          @click="activeScope = scope as TemplateScope | 'all'"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center text-gray-500 py-6">
      <span>{{ t('template.loading') }}</span>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center text-red-500 py-6">
      {{ error }}
    </div>

    <!-- Template Grid -->
    <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      <div
        v-for="template in filteredTemplates"
        :key="template.id"
        class="flex flex-col p-4 border border-gray-200 rounded-lg cursor-pointer transition-all"
        :class="selectedTemplateId === template.id ? 'border-blue-500 bg-blue-50' : 'hover:border-blue-500 hover:shadow-md'"
        @click="selectTemplate(template)"
      >
        <div class="flex items-center justify-between mb-2">
          <span
            class="px-2 py-0.5 text-[12px] font-medium rounded uppercase tracking-wide"
            :class="{
              'bg-blue-100 text-blue-800': template.scope === 'official',
              'bg-green-100 text-green-800': template.scope === 'project',
              'bg-amber-100 text-amber-800': template.scope === 'local',
            }"
          >
            {{ template.scope }}
          </span>
          <button
            v-if="projectId"
            class="px-3 py-1 text-[12px] font-medium text-white bg-blue-500 border-none rounded cursor-pointer transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-600"
            :disabled="applyingTemplate"
            @click.stop="handleApply(template)"
          >
            {{ applyingTemplate ? t('template.applying') : t('template.apply') }}
          </button>
        </div>

        <h4 class="m-0 mb-1 text-base font-semibold">{{ template.name }}</h4>
        <p v-if="template.description" class="m-0 mb-3 text-sm text-gray-500">
          {{ template.description }}
        </p>

        <div class="mb-3 text-[12px] text-gray-400">
          <span>{{ t('template.itemCount', { n: template.items.length }) }}</span>
        </div>

        <!-- Preview Items -->
        <div class="flex flex-col gap-1">
          <div
            v-for="(item, index) in template.items.slice(0, 3)"
            :key="index"
            class="flex justify-between text-[12px]"
          >
            <span class="text-gray-700">{{ item.relativePath }}</span>
            <span class="text-gray-400">{{ item.moduleId }}</span>
          </div>
          <div v-if="template.items.length > 3" class="text-[12px] text-gray-400 italic">
            {{ t('template.moreItems', { n: template.items.length - 3 }) }}
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="filteredTemplates.length === 0" class="col-span-full text-center text-gray-500 py-6">
        <p>{{ t('template.noResults') }}</p>
      </div>
    </div>
  </div>
</template>
