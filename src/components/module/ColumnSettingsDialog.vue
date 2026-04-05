<script setup lang="ts">
import { ref } from 'vue'
import { X, Plus, Trash2, GripVertical } from 'lucide-vue-next'
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
  update: [id: string, patch: Partial<Pick<TaskColumn, 'name' | 'color' | 'sortOrder'>>]
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
  const name = newName.value.trim()
  if (!key || !name) return
  emit('create', key, name, newColor.value)
  showAddForm.value = false
}

function startEdit(col: TaskColumn) {
  editingId.value = col.id
  editName.value = col.name
  editColor.value = col.color
}

function cancelEdit() {
  editingId.value = null
}

function submitEdit(id: string) {
  const name = editName.value.trim()
  if (!name) return
  emit('update', id, { name, color: editColor.value })
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

                  <div v-if="editingId === col.id" class="flex-1 flex items-center gap-1.5">
                    <input
                      v-model="editName"
                      class="flex-1 px-2 py-1 text-[13px] border border-gray-300 rounded"
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

                  <div v-else class="flex-1 flex items-center gap-2 min-w-0">
                    <span class="text-sm font-medium text-gray-700 cursor-text" @dblclick="startEdit(col)">{{ col.name }}</span>
                    <span class="text-[11px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">{{ col.statusKey }}</span>
                  </div>

                  <button
                    class="flex-shrink-0 px-2 py-1 text-[11px] border border-gray-200 bg-white text-gray-700 rounded cursor-pointer"
                    :class="{ 'bg-amber-50 border-amber-300 text-amber-800': !col.isVisible }"
                    @click="emit('toggle-visibility', col.id)"
                    :title="col.isVisible ? $t('task.hideColumn') : $t('task.showColumn')"
                  >
                    {{ col.isVisible ? $t('task.visible') : $t('task.hidden') }}
                  </button>

                  <button
                    v-if="pendingDeleteId === col.id"
                    class="flex-shrink-0 px-1.5 py-0.5 text-[11px] text-white bg-red-500 border-none rounded cursor-pointer"
                    @click="onDelete(col.id)"
                    :title="$t('common.confirm')"
                  >
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
.column-item__drag {
  cursor: grab;
}

.column-item__drag:active {
  cursor: grabbing;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
