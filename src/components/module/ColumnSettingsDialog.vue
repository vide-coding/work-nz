<script setup lang="ts">
import { ref, watch } from 'vue'
import { X, Plus, Trash2, GripVertical, Pencil, Eye, EyeOff } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import type { TaskColumn } from '@/types'

interface Props {
  visible: boolean
  columns: TaskColumn[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
})

const emit = defineEmits<{
  close: []
  create: [statusKey: string, name: string, color: string]
  update: [id: string, patch: Partial<Pick<TaskColumn, 'statusKey' | 'name' | 'color' | 'sortOrder'>>]
  'toggle-visibility': [id: string]
  delete: [id: string]
}>()

// Local copy of columns for drag-and-drop
const localColumns = ref<TaskColumn[]>([])
const previousOrder = ref<Record<string, number>>({})
const showAddForm = ref(false)
const newStatusKey = ref('')
const newName = ref('')
const newColor = ref('#6366F1')

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#10B981', '#06B6D4', '#3B82F6', '#6366F1',
  '#8B5CF6', '#EC4899', '#6B7280', '#1F2937',
]

const editingId = ref<string | null>(null)
const editStatusKey = ref('')
const editName = ref('')
const editColor = ref('')
const pendingDeleteId = ref<string | null>(null)

// Sync when props.columns changes
watch(
  () => props.columns,
  (cols) => {
    if (!cols) return
    previousOrder.value = {}
    cols.forEach((c) => { previousOrder.value[c.id] = c.sortOrder })
    localColumns.value = [...cols].sort((a, b) => a.sortOrder - b.sortOrder)
  },
  { immediate: true }
)

function onModelValueUpdate(newList: TaskColumn[]) {
  localColumns.value = newList
}

function onDragEnd() {
  // Only emit update for columns whose order actually changed
  localColumns.value.forEach((col, index) => {
    if (previousOrder.value[col.id] !== index) {
      emit('update', col.id, { sortOrder: index })
      previousOrder.value[col.id] = index
    }
  })
}

function openAddForm() {
  showAddForm.value = true
  newStatusKey.value = ''
  newName.value = ''
  newColor.value = '#6366F1'
}

function cancelAdd() {
  showAddForm.value = false
}

function submitAdd() {
  const key = newStatusKey.value.trim()
  if (!key) return
  emit('create', key, newName.value.trim() || key, newColor.value)
  showAddForm.value = false
}

// 从 props.columns 获取最新 isVisible 状态（确保响应式更新）
function getColVisibility(colId: string): boolean {
  const col = props.columns.find((c) => c.id === colId)
  return col?.isVisible ?? true
}

function startEdit(col: TaskColumn) {
  editingId.value = col.id
  editStatusKey.value = col.statusKey
  editName.value = col.name
  editColor.value = col.color
}

function cancelEdit() {
  editingId.value = null
}

function submitEdit(id: string) {
  const statusKey = editStatusKey.value.trim()
  if (!statusKey) return
  emit('update', id, { statusKey, name: editName.value.trim() || statusKey, color: editColor.value })
  editingId.value = null
}

function onDelete(id: string) {
  if (pendingDeleteId.value === id) {
    // Second click — confirm delete
    emit('delete', id)
    pendingDeleteId.value = null
  } else {
    // First click — arm confirmation
    pendingDeleteId.value = id
  }
}

function cancelDelete() {
  pendingDeleteId.value = null
}
</script>

<template>
  <Transition name="fade">
    <div v-if="visible" class="fixed inset-0 bg-black/40 flex items-center justify-center z-[200]" @click.self="emit('close')">
      <div class="bg-white rounded-xl w-[480px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h3 class="m-0 text-base font-semibold text-gray-900">{{ $t('task.columnSettings') }}</h3>
          <button class="flex items-center justify-center w-8 h-8 text-gray-500 bg-transparent border-none rounded-md cursor-pointer hover:bg-gray-100" @click="emit('close')">
            <X :size="18" />
          </button>
        </div>

        <div class="flex-1 px-5 py-4 overflow-y-auto">
          <div v-if="loading" class="text-center text-gray-500 py-6">
            {{ $t('common.loading') }}
          </div>

          <template v-else>
            <!-- Column list with drag reorder -->
            <draggable
              :model-value="localColumns"
              @update:model-value="onModelValueUpdate"
              item-key="id"
              handle=".drag-handle"
              class="flex flex-col gap-1.5 mb-3"
              animation="200"
              force-fallback="true"
              ghost-class="opacity-50"
              @end="onDragEnd"
            >
              <template #item="{ element: col }">
                <div class="group flex items-center gap-2 px-2.5 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                  <div class="drag-handle text-gray-300 cursor-grab active:cursor-grabbing flex-shrink-0">
                    <GripVertical :size="14" />
                  </div>

                  <div
                    class="w-3 h-3 rounded-full flex-shrink-0"
                    :style="{ backgroundColor: col.color }"
                  />

                  <div v-if="editingId === col.id" class="flex-1 flex items-center gap-1.5 flex-wrap">
                    <input
                      v-model="editStatusKey"
                      class="px-2 py-1 text-[13px] border border-gray-300 rounded w-24"
                      @keydown.enter="submitEdit(col.id)"
                      @keydown.esc="cancelEdit"
                    />
                    <input
                      v-model="editName"
                      class="px-2 py-1 text-[13px] border border-gray-300 rounded flex-1 min-w-[80px]"
                      :placeholder="$t('task.columnName')"
                      @keydown.enter="submitEdit(col.id)"
                      @keydown.esc="cancelEdit"
                    />
                    <input
                      v-model="editColor"
                      type="color"
                      class="w-7 h-7 p-0.5 border border-gray-300 rounded cursor-pointer"
                    />
                    <button class="px-2 py-1 text-[12px] font-medium text-white bg-blue-500 border-none rounded cursor-pointer" @click="submitEdit(col.id)">
                      {{ $t('common.save') }}
                    </button>
                    <button class="px-2 py-1 text-[12px] text-gray-600 bg-gray-100 border border-gray-200 rounded cursor-pointer" @click="cancelEdit">
                      {{ $t('common.cancel') }}
                    </button>
                  </div>

                  <div v-else class="flex items-center gap-2 flex-1 min-w-0">
                    <span class="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{{ col.name || col.statusKey }}</span>
                  </div>

                  <button
                    class="flex-shrink-0 flex items-center justify-center w-5 h-5 text-gray-400 bg-transparent border-none rounded cursor-pointer hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                    @click="startEdit(col)"
                    :title="$t('common.edit')"
                  >
                    <Pencil :size="13" />
                  </button>

                  <button
                    class="flex-shrink-0 flex items-center justify-center w-6 h-6 text-gray-400 bg-transparent border-none rounded cursor-pointer transition-colors"
                    :class="getColVisibility(col.id) ? 'hover:text-gray-600 hover:bg-gray-100' : 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'"
                    @click="emit('toggle-visibility', col.id)"
                    :title="getColVisibility(col.id) ? $t('task.hideColumn') : $t('task.showColumn')"
                  >
                    <Eye v-if="getColVisibility(col.id)" :size="14" />
                    <EyeOff v-else :size="14" />
                  </button>

                  <button
                    v-if="pendingDeleteId === col.id"
                    class="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-[11px] text-white bg-red-500 border-none rounded cursor-pointer"
                    @click="onDelete(col.id)"
                    :title="$t('common.confirm')"
                  >
                    <Trash2 :size="11" />
                    {{ $t('common.confirm') }}
                  </button>
                  <button
                    v-else
                    class="flex-shrink-0 flex items-center justify-center w-6 h-6 text-gray-300 bg-transparent border-none rounded cursor-pointer hover:text-red-500 hover:bg-red-50"
                    @click="onDelete(col.id)"
                    :title="$t('common.delete')"
                  >
                    <Trash2 :size="14" />
                  </button>
                  <button
                    v-if="pendingDeleteId === col.id"
                    class="flex-shrink-0 flex items-center justify-center h-6 px-1.5 text-[11px] text-gray-600 bg-gray-100 border-none rounded cursor-pointer hover:bg-gray-200"
                    @click="cancelDelete"
                  >
                    {{ $t('common.cancel') }}
                  </button>
                </div>
              </template>
            </draggable>

            <!-- Add new column form -->
            <div v-if="showAddForm" class="flex flex-col gap-2 p-3 bg-gray-50 border border-dashed border-gray-300 rounded-lg">
              <input
                v-model="newStatusKey"
                class="px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md"
                :placeholder="$t('task.statusKey')"
              />
              <input
                v-model="newName"
                class="px-2.5 py-1.5 text-[13px] border border-gray-200 rounded-md"
                :placeholder="$t('task.columnName')"
                @keydown.enter="submitAdd"
              />
              <div class="flex items-center gap-2">
                <span class="text-[12px] text-gray-500 flex-shrink-0">{{ $t('task.color') }}</span>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="c in PRESET_COLORS"
                    :key="c"
                    class="w-[18px] h-[18px] rounded cursor-pointer border-2"
                    :class="newColor === c ? 'border-gray-700' : 'border-transparent'"
                    :style="{ backgroundColor: c }"
                    @click="newColor = c"
                  />
                </div>
                <input
                  v-model="newColor"
                  type="color"
                  class="w-7 h-7 p-0.5 border border-gray-200 rounded cursor-pointer"
                />
              </div>
              <div class="flex gap-2">
                <button class="px-3 py-1.5 text-[13px] font-medium text-white bg-blue-500 border-none rounded-md cursor-pointer transition-colors hover:bg-blue-600" @click="submitAdd">
                  {{ $t('common.create') }}
                </button>
                <button class="px-3 py-1.5 text-[13px] text-gray-600 bg-gray-100 border border-gray-200 rounded-md cursor-pointer" @click="cancelAdd">
                  {{ $t('common.cancel') }}
                </button>
              </div>
            </div>

            <button v-else class="w-full flex items-center justify-center gap-1.5 px-2 py-2 text-[13px] text-gray-500 bg-transparent border border-dashed border-gray-300 rounded-lg cursor-pointer transition-colors hover:border-blue-500 hover:text-blue-500" @click="openAddForm">
              <Plus :size="14" />
              {{ $t('task.addColumn') }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
