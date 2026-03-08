import { ref, computed } from 'vue'
import { templateApi, directoryApi } from './useApi'
import type { DirectoryTemplate, DirectoryTemplateItem, Directory, TemplateScope } from '@/types'

/**
 * Composable for directory template operations
 */
export function useDirectoryTemplate() {
  const templates = ref<DirectoryTemplate[]>([])
  const currentTemplate = ref<DirectoryTemplate | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Grouped templates by scope
  const templatesByScope = computed(() => {
    const groups: Record<TemplateScope, DirectoryTemplate[]> = {
      official: [],
      project: [],
      local: [],
    }

    for (const template of templates.value) {
      if (groups[template.scope]) {
        groups[template.scope].push(template)
      }
    }

    return groups
  })

  // Load templates
  async function loadTemplates(scope?: TemplateScope, projectId?: string) {
    loading.value = true
    error.value = null
    try {
      templates.value = await templateApi.list(scope, projectId)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load templates'
    } finally {
      loading.value = false
    }
  }

  // Load a single template
  async function loadTemplate(id: string) {
    loading.value = true
    error.value = null
    try {
      currentTemplate.value = await templateApi.get(id)
      return currentTemplate.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load template'
      return null
    } finally {
      loading.value = false
    }
  }

  // Create a new template
  async function createTemplate(input: {
    name: string
    description?: string
    scope: TemplateScope
    projectId?: string
    items: DirectoryTemplateItem[]
  }): Promise<DirectoryTemplate | null> {
    loading.value = true
    error.value = null
    try {
      const template = await templateApi.create(input)
      templates.value.push(template)
      return template
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create template'
      return null
    } finally {
      loading.value = false
    }
  }

  // Update a template
  async function updateTemplate(
    id: string,
    patch: { name?: string; description?: string; items?: DirectoryTemplateItem[] }
  ): Promise<DirectoryTemplate | null> {
    loading.value = true
    error.value = null
    try {
      const updated = await templateApi.update(id, patch)
      const index = templates.value.findIndex((t) => t.id === id)
      if (index !== -1) {
        templates.value[index] = updated
      }
      if (currentTemplate.value?.id === id) {
        currentTemplate.value = updated
      }
      return updated
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to update template'
      return null
    } finally {
      loading.value = false
    }
  }

  // Delete a template
  async function deleteTemplate(id: string): Promise<boolean> {
    loading.value = true
    error.value = null
    try {
      await templateApi.delete(id)
      templates.value = templates.value.filter((t) => t.id !== id)
      if (currentTemplate.value?.id === id) {
        currentTemplate.value = null
      }
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to delete template'
      return false
    } finally {
      loading.value = false
    }
  }

  // Apply a template to a project
  async function applyTemplate(
    templateId: string,
    projectId: string,
    customizations?: {
      items?: Array<{ relativePath?: string; name?: string; excluded?: boolean }>
    }
  ): Promise<Directory[]> {
    loading.value = true
    error.value = null
    try {
      const directories = await templateApi.apply(templateId, projectId, customizations)
      return directories
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to apply template'
      return []
    } finally {
      loading.value = false
    }
  }

  // Create a template from existing directories
  async function createFromDirectories(
    name: string,
    description: string,
    scope: TemplateScope,
    projectId: string,
    directoryIds: string[]
  ): Promise<DirectoryTemplate | null> {
    loading.value = true
    error.value = null
    try {
      const template = await templateApi.fromDirectories(
        name,
        description,
        scope,
        projectId,
        directoryIds
      )
      templates.value.push(template)
      return template
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create template from directories'
      return null
    } finally {
      loading.value = false
    }
  }

  // Export a template
  async function exportTemplate(templateId: string): Promise<string | null> {
    loading.value = true
    error.value = null
    try {
      const filePath = await templateApi.export(templateId)
      return filePath
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to export template'
      return null
    } finally {
      loading.value = false
    }
  }

  // Import a template
  async function importTemplate(filePath: string): Promise<DirectoryTemplate | null> {
    loading.value = true
    error.value = null
    try {
      const template = await templateApi.import(filePath)
      templates.value.push(template)
      return template
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to import template'
      return null
    } finally {
      loading.value = false
    }
  }

  // Get official templates
  function getOfficialTemplates(): DirectoryTemplate[] {
    return templatesByScope.value.official
  }

  // Get project templates
  function getProjectTemplates(projectId: string): DirectoryTemplate[] {
    return templatesByScope.value.project.filter((t) => t.projectId === projectId)
  }

  // Get local templates
  function getLocalTemplates(): DirectoryTemplate[] {
    return templatesByScope.value.local
  }

  return {
    // State
    templates,
    currentTemplate,
    loading,
    error,

    // Computed
    templatesByScope,

    // Actions
    loadTemplates,
    loadTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
    createFromDirectories,
    exportTemplate,
    importTemplate,
    getOfficialTemplates,
    getProjectTemplates,
    getLocalTemplates,
  }
}
