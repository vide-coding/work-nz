<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Trash2 } from 'lucide-vue-next'
import type { Task } from '@/types'

interface Props {
  task: Task | null
  visible: boolean
  statusOptions?: Array<{ value: string; label: string }>
  priorityOptions?: Array<{ value: string; label: string }>
}

const props = withDefaults(defineProps<Props>(), {
  statusOptions: () => [
    { value: 'todo', label: 'To Do' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'done', label: 'Done' },
  ],
  priorityOptions: () => [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ],
})

const emit = defineEmits<{
  close: []
  update: [id: string, patch: Partial<Task>]
  delete: [id: string]
}>()

const { t } = useI18n()

const editTitle = ref('')
const editDescription = ref('')
const editStatus = ref('')
const editPriority = ref('')
const editAssignee = ref('')
const editDueDate = ref('')

watch(
  () => props.task,
  (task) => {
    if (task) {
      editTitle.value = task.title
      editDescription.value = task.description || ''
      editStatus.value = task.status
      editPriority.value = task.priority
      editAssignee.value = task.assignee || ''
      editDueDate.value = task.dueDate || ''
    }
  },
  { immediate: true }
)

function save() {
  if (!props.task) return
  emit('update', props.task.id, {
    title: editTitle.value,
    description: editDescription.value || undefined,
    status: editStatus.value,
    priority: editPriority.value,
    assignee: editAssignee.value || undefined,
    dueDate: editDueDate.value || undefined,
  })
}

function onDelete() {
  if (!props.task) return
  if (confirm(t('task.deleteConfirm'))) {
    emit('delete', props.task.id)
  }
}

function onClose() {
  save()
  emit('close')
}
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && task" class="task-detail-panel">
      <div class="task-detail-panel__header">
        <h3 class="task-detail-panel__title">{{ $t('task.title') }}</h3>
        <button class="task-detail-panel__close" @click="onClose">
          <X :size="18" />
        </button>
      </div>

      <div class="task-detail-panel__body">
        <div class="form-field">
          <label class="form-field__label">{{ $t('task.title') }}</label>
          <input
            v-model="editTitle"
            class="form-field__input"
            @blur="save"
          />
        </div>

        <div class="form-field">
          <label class="form-field__label">{{ $t('task.description') }}</label>
          <textarea
            v-model="editDescription"
            class="form-field__textarea"
            rows="4"
            @blur="save"
          />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-field__label">{{ $t('task.status') }}</label>
            <select v-model="editStatus" class="form-field__select" @change="save">
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="form-field">
            <label class="form-field__label">{{ $t('task.priority') }}</label>
            <select v-model="editPriority" class="form-field__select" @change="save">
              <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-field__label">{{ $t('task.assignee') }}</label>
            <input
              v-model="editAssignee"
              class="form-field__input"
              @blur="save"
            />
          </div>

          <div class="form-field">
            <label class="form-field__label">{{ $t('task.dueDate') }}</label>
            <input
              v-model="editDueDate"
              type="date"
              class="form-field__input"
              @blur="save"
            />
          </div>
        </div>
      </div>

      <div class="task-detail-panel__footer">
        <button class="task-detail-panel__delete" @click="onDelete">
          <Trash2 :size="16" />
          {{ $t('task.delete') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.task-detail-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.1);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.task-detail-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.task-detail-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

.task-detail-panel__close {
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

.task-detail-panel__close:hover {
  background: #f3f4f6;
}

.task-detail-panel__body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-field__label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-field__input,
.form-field__select,
.form-field__textarea {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  color: #111827;
  background: white;
  transition: border-color 0.15s;
}

.form-field__input:focus,
.form-field__select:focus,
.form-field__textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-field__textarea {
  resize: vertical;
  min-height: 80px;
}

.task-detail-panel__footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
}

.task-detail-panel__delete {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid #fca5a5;
  background: #fef2f2;
  color: #dc2626;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.task-detail-panel__delete:hover {
  background: #fee2e2;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
