<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-vue-next'
import { ideApi } from '@/composables/useApi'
import type { IdeConfig, SupportedIdeKind } from '@/types'

const props = defineProps<{
  modelValue?: IdeConfig
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: IdeConfig | undefined]
}>()

const { t } = useI18n()

// 支持的IDE列表
const supportedIdes = ref<IdeConfig[]>([])
const isLoading = ref(false)

// 自定义IDE编辑状态
const isEditing = ref(false)
const editingIde = ref<IdeConfig>({
  kind: 'custom',
  name: '',
  command: '',
  args: [],
})
const argInput = ref('')

// 计算属性：当前选中的IDE
const selectedIde = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

// 加载支持的IDE列表
async function loadSupportedIdes() {
  isLoading.value = true
  try {
    const ides = await ideApi.listSupported()
    supportedIdes.value = ides
  } catch (error) {
    console.error('Failed to load supported IDEs:', error)
  } finally {
    isLoading.value = false
  }
}

// 选择IDE
function selectIde(ide: IdeConfig) {
  selectedIde.value = { ...ide }
}

// 清除选择
function clearSelection() {
  selectedIde.value = undefined
}

// 开始添加自定义IDE
function startAddCustom() {
  isEditing.value = true
  editingIde.value = {
    kind: 'custom',
    name: '',
    command: '',
    args: [],
  }
  argInput.value = ''
}

// 开始编辑当前IDE
function startEdit() {
  if (selectedIde.value) {
    isEditing.value = true
    editingIde.value = {
      ...selectedIde.value,
      args: selectedIde.value.args ? [...selectedIde.value.args] : [],
    }
    argInput.value = editingIde.value.args?.join(' ') || ''
  }
}

// 保存自定义IDE
function saveCustomIde() {
  if (!editingIde.value.name.trim() || !editingIde.value.command.trim()) {
    return
  }

  // 解析参数
  const args = argInput.value
    .split(' ')
    .map((a) => a.trim())
    .filter((a) => a.length > 0)

  const newIde: IdeConfig = {
    kind: 'custom',
    name: editingIde.value.name.trim(),
    command: editingIde.value.command.trim(),
    args: args.length > 0 ? args : undefined,
  }

  selectedIde.value = newIde
  isEditing.value = false
}

// 取消编辑
function cancelEdit() {
  isEditing.value = false
}

// 获取IDE图标/颜色
function getIdeColor(kind: SupportedIdeKind): string {
  switch (kind) {
    case 'vscode':
      return 'bg-blue-500'
    case 'jetbrains':
      return 'bg-purple-500'
    case 'visual_studio':
      return 'bg-indigo-500'
    case 'custom':
      return 'bg-gray-500'
    default:
      return 'bg-gray-500'
  }
}

onMounted(() => {
  loadSupportedIdes()
})
</script>

<template>
  <div class="space-y-4">
    <!-- IDE列表 -->
    <div v-if="!isEditing" class="space-y-2">
      <!-- 已检测到的IDE -->
      <div v-if="supportedIdes.length > 0" class="space-y-2">
        <div class="text-xs text-gray-500 dark:text-gray-400">
          {{ t('settings.detectedIdes') }}
        </div>
        <div class="grid grid-cols-1 gap-2">
          <button
            v-for="ide in supportedIdes"
            :key="ide.command"
            @click="selectIde(ide)"
            :disabled="disabled"
            :class="[
              'flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-colors',
              selectedIde?.command === ide.command
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800',
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
            ]"
          >
            <div
              :class="[
                'w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold',
                getIdeColor(ide.kind),
              ]"
            >
              {{ ide.name.charAt(0).toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ ide.name }}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {{ ide.command }}
              </div>
            </div>
            <Check
              v-if="selectedIde?.command === ide.command"
              class="w-4 h-4 text-indigo-600 dark:text-indigo-400"
            />
          </button>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-else-if="isLoading" class="flex items-center justify-center py-4">
        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
      </div>

      <!-- 未检测到IDE -->
      <div v-else class="text-sm text-gray-500 dark:text-gray-400 py-2">
        {{ t('settings.noIdesDetected') }}
      </div>

      <!-- 自定义IDE -->
      <div v-if="selectedIde?.kind === 'custom'" class="mt-4">
        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {{ t('settings.customIde') }}
        </div>
        <div
          class="flex items-center gap-3 px-3 py-2 rounded-lg border border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20"
        >
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold bg-gray-500"
          >
            {{ selectedIde.name.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
              {{ selectedIde.name }}
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
              {{ selectedIde.command }}
            </div>
          </div>
          <button
            @click="startEdit"
            :disabled="disabled"
            class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <Edit2 class="w-4 h-4" />
          </button>
          <button
            @click="clearSelection"
            :disabled="disabled"
            class="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- 添加自定义IDE按钮 -->
      <button
        v-if="!selectedIde || selectedIde.kind !== 'custom'"
        @click="startAddCustom"
        :disabled="disabled"
        class="flex items-center gap-2 px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
      >
        <Plus class="w-4 h-4" />
        {{ t('settings.addCustomIde') }}
      </button>
    </div>

    <!-- 自定义IDE编辑表单 -->
    <div v-else class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
        {{ t('settings.customIde') }}
      </div>

      <!-- 名称 -->
      <div>
        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          {{ t('settings.ideName') }}
        </label>
        <input
          v-model="editingIde.name"
          type="text"
          :placeholder="t('settings.ideNamePlaceholder')"
          class="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      <!-- 命令 -->
      <div>
        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          {{ t('settings.ideCommand') }}
        </label>
        <div class="flex gap-2">
          <input
            v-model="editingIde.command"
            type="text"
            :placeholder="t('settings.ideCommandPlaceholder')"
            class="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      <!-- 启动参数 -->
      <div>
        <label class="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          {{ t('settings.ideArgs') }}
        </label>
        <input
          v-model="argInput"
          type="text"
          :placeholder="t('settings.ideArgsPlaceholder')"
          class="w-full px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {{ t('settings.ideArgsHint') }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex justify-end gap-2 pt-2">
        <button
          @click="cancelEdit"
          class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <X class="w-4 h-4 inline mr-1" />
          {{ t('common.cancel') }}
        </button>
        <button
          @click="saveCustomIde"
          :disabled="!editingIde.name.trim() || !editingIde.command.trim()"
          class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Check class="w-4 h-4 inline mr-1" />
          {{ t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>
