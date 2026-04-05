<script setup lang="ts">
import { ref, computed } from 'vue'
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
const previousOrder = ref<Record<string, number>>({})

watch(
  () => props.columns,
  (cols) => {
    previousOrder.value = {}
    cols.forEach((c) => { previousOrder.value[c.id] = c.sortOrder })
    localColumns.value = [...cols].sort((a, b) => a.sortOrder - b.sortOrder)
  },
  { immediate: true }
)

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

function onDragEnd() {
  // Only emit update for columns whose order actually changed
  localColumns.value.forEach((col, index) => {
    if (previousOrder.value[col.id] !== index) {
      emit('update', col.id, { sortOrder: index })
      previousOrder.value[col.id] = index
    }
  })
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
    <div v-if="visible" class="settings-overlay" @click.self="emit('close')">
      <div class="settings-dialog">
        <div class="settings-dialog__header">
          <h3 class="settings-dialog__title">{{ $t('task.columnSettings') }}</h3>
          <button class="settings-dialog__close" @click="emit('close')">
            <X :size="18" />
          </button>
        </div>

        <div class="settings-dialog__body">
          <div v-if="loading" class="settings-dialog__loading">
            {{ $t('common.loading') }}
          </div>

          <template v-else>
            <!-- Column list with drag reorder -->
            <draggable
              v-model="localColumns"
              item-key="id"
              handle=".column-item__drag"
              class="settings-dialog__list"
              @end="onDragEnd"
            >
              <template #item="{ element: col }">
                <div class="column-item">
                  <div class="column-item__drag">
                    <GripVertical :size="14" />
                  </div>

                  <div
                    class="column-item__dot"
                    :style="{ backgroundColor: col.color }"
                  />

                  <div v-if="editingId === col.id" class="column-item__edit">
                    <input
                      v-model="editName"
                      class="column-item__edit-name"
                      @keydown.enter="submitEdit(col.id)"
                      @keydown.esc="cancelEdit"
                    />
                    <input
                      v-model="editColor"
                      type="color"
                      class="column-item__edit-color"
                    />
                    <button class="column-item__edit-btn" @click="submitEdit(col.id)">
                      {{ $t('common.save') }}
                    </button>
                    <button class="column-item__edit-cancel" @click="cancelEdit">
                      {{ $t('common.cancel') }}
                    </button>
                  </div>

                  <div v-else class="column-item__info">
                    <span class="column-item__name" @dblclick="startEdit(col)">{{ col.name }}</span>
                    <span class="column-item__key">{{ col.statusKey }}</span>
                  </div>

                  <button
                    class="column-item__visibility"
                    :class="{ 'column-item__visibility--hidden': !col.isVisible }"
                    @click="emit('toggle-visibility', col.id)"
                    :title="col.isVisible ? $t('task.hideColumn') : $t('task.showColumn')"
                  >
                    {{ col.isVisible ? $t('task.visible') : $t('task.hidden') }}
                  </button>

                  <button
                    v-if="pendingDeleteId === col.id"
                    class="column-item__delete column-item__delete--confirm"
                    @click="onDelete(col.id)"
                    :title="$t('common.confirm')"
                  >
                    {{ $t('common.confirm') }}
                  </button>
                  <button
                    v-else
                    class="column-item__delete"
                    @click="onDelete(col.id)"
                    :title="$t('common.delete')"
                  >
                    <Trash2 :size="14" />
                  </button>
                  <button
                    v-if="pendingDeleteId === col.id"
                    class="column-item__delete-cancel"
                    @click="cancelDelete"
                  >
                    {{ $t('common.cancel') }}
                  </button>
                </div>
              </template>
            </draggable>

            <!-- Add new column form -->
            <div v-if="showAddForm" class="add-form">
              <input
                v-model="newStatusKey"
                class="add-form__input"
                :placeholder="$t('task.statusKey')"
              />
              <input
                v-model="newName"
                class="add-form__input"
                :placeholder="$t('task.columnName')"
              />
              <div class="add-form__color-row">
                <span class="add-form__color-label">{{ $t('task.color') }}</span>
                <div class="add-form__color-presets">
                  <button
                    v-for="c in PRESET_COLORS"
                    :key="c"
                    class="add-form__color-swatch"
                    :class="{ 'add-form__color-swatch--active': newColor === c }"
                    :style="{ backgroundColor: c }"
                    @click="newColor = c"
                  />
                </div>
                <input
                  v-model="newColor"
                  type="color"
                  class="add-form__color-picker"
                />
              </div>
              <div class="add-form__actions">
                <button class="add-form__submit" @click="submitAdd">
                  {{ $t('common.create') }}
                </button>
                <button class="add-form__cancel" @click="cancelAdd">
                  {{ $t('common.cancel') }}
                </button>
              </div>
            </div>

            <button v-else class="add-column-btn" @click="openAddForm">
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
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.settings-dialog {
  background: white;
  border-radius: 12px;
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.settings-dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.settings-dialog__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.settings-dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 6px;
  cursor: pointer;
}

.settings-dialog__close:hover {
  background: #f3f4f6;
}

.settings-dialog__body {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
}

.settings-dialog__loading {
  text-align: center;
  color: #6b7280;
  padding: 24px;
}

.settings-dialog__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.column-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.column-item__drag {
  color: #d1d5db;
  cursor: grab;
  flex-shrink: 0;
}

.column-item__drag:active {
  cursor: grabbing;
}

.column-item__dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.column-item__info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.column-item__name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  cursor: text;
}

.column-item__key {
  font-size: 11px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.column-item__edit {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

.column-item__edit-name {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 13px;
}

.column-item__edit-color {
  width: 28px;
  height: 28px;
  padding: 2px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
}

.column-item__edit-btn {
  padding: 4px 8px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.column-item__edit-cancel {
  padding: 4px 8px;
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.column-item__visibility {
  padding: 3px 8px;
  border: 1px solid #e5e7eb;
  background: white;
  color: #374151;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}

.column-item__visibility--hidden {
  background: #fef3c7;
  border-color: #fcd34d;
  color: #92400e;
}

.column-item__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
}

.column-item__delete:hover {
  color: #ef4444;
  background: #fef2f2;
}

.column-item__delete--confirm {
  width: auto;
  padding: 2px 6px;
  background: #ef4444;
  color: white;
  font-size: 11px;
}

.column-item__delete-cancel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  padding: 2px 6px;
  border: none;
  background: #f3f4f6;
  color: #6b7280;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}

.column-item__delete-cancel:hover {
  background: #e5e7eb;
}

.add-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
  border-radius: 8px;
}

.add-form__input {
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
}

.add-form__color-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-form__color-label {
  font-size: 12px;
  color: #6b7280;
  flex-shrink: 0;
}

.add-form__color-presets {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.add-form__color-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
}

.add-form__color-swatch--active {
  border-color: #374151;
}

.add-form__color-picker {
  width: 28px;
  height: 28px;
  padding: 2px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  cursor: pointer;
}

.add-form__actions {
  display: flex;
  gap: 8px;
}

.add-form__submit {
  padding: 6px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.add-form__submit:hover {
  background: #2563eb;
}

.add-form__cancel {
  padding: 6px 12px;
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.add-column-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px;
  border: 1px dashed #d1d5db;
  background: transparent;
  color: #6b7280;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.add-column-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
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
