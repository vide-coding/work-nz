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
  childTasks?: Task[]
  childCount?: { total: number; completed: number }
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
  childTasks: () => [],
  childCount: () => ({ total: 0, completed: 0 }),
})

const emit = defineEmits<{
  close: []
  update: [id: string, patch: Partial<Task>]
  delete: [id: string]
  'toggle-child': [childId: string]
  'delete-child': [childId: string]
  'add-child': [parentId: string, title: string]
}>()

const { t } = useI18n()

const editTitle = ref('')
const editDescription = ref('')
const editStatus = ref('')
const editPriority = ref('')
const editAssignee = ref('')
const editDueDate = ref('')
const newChildTitle = ref('')

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

function onAddChild() {
  const title = newChildTitle.value.trim()
  if (!title || !props.task) return
  emit('add-child', props.task.id, title)
  newChildTitle.value = ''
}
</script>

<template>
  <Transition name="slide">
    <div v-if="visible && task" class="fixed top-0 right-0 w-[400px] h-screen bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.1)] z-[100] flex flex-col overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <h3 class="m-0 text-base font-semibold text-gray-900">{{ $t('task.title') }}</h3>
        <button class="flex items-center justify-center w-8 h-8 text-gray-500 bg-transparent rounded-md hover:bg-gray-100" @click="onClose">
          <X :size="18" />
        </button>
      </div>

      <div class="flex-1 px-5 py-5 overflow-y-auto flex flex-col gap-4">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('task.title') }}</label>
          <input
            v-model="editTitle"
            class="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-md transition-colors focus:outline-none focus:border-blue-500"
            @blur="save"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('task.description') }}</label>
          <textarea
            v-model="editDescription"
            class="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-md resize-y min-h-20 transition-colors focus:outline-none focus:border-blue-500"
            rows="4"
            @blur="save"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('task.status') }}</label>
            <select v-model="editStatus" class="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-md transition-colors focus:outline-none focus:border-blue-500" @change="save">
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('task.priority') }}</label>
            <select v-model="editPriority" class="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-md transition-colors focus:outline-none focus:border-blue-500" @change="save">
              <option v-for="opt in priorityOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('task.assignee') }}</label>
            <input
              v-model="editAssignee"
              class="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-md transition-colors focus:outline-none focus:border-blue-500"
              @blur="save"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ $t('task.dueDate') }}</label>
            <input
              v-model="editDueDate"
              type="date"
              class="px-3 py-2 text-sm text-gray-900 border border-gray-200 rounded-md transition-colors focus:outline-none focus:border-blue-500"
              @blur="save"
            />
          </div>
        </div>
      </div>

      <!-- Subtasks section -->
      <div class="border-t border-gray-200 px-5 py-4 bg-gray-50">
        <div class="mb-3">
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {{ $t('task.subtasks') || 'Subtasks' }}
            <span v-if="childCount.total > 0" class="ml-2 font-normal text-gray-400">
              {{ childCount.completed }}/{{ childCount.total }}
            </span>
          </span>
        </div>

        <div class="flex flex-col gap-1 mb-2 max-h-[200px] overflow-y-auto">
          <div
            v-for="child in childTasks"
            :key="child.id"
            class="group flex items-center gap-2 p-1.5 bg-white border border-gray-200 rounded-md"
          >
            <input
              type="checkbox"
              :checked="child.isCompleted"
              class="w-3.5 h-3.5 cursor-pointer flex-shrink-0"
              @change="emit('toggle-child', child.id)"
            />
            <span
              class="flex-1 text-[13px] text-gray-700 overflow-hidden text-ellipsis whitespace-nowrap"
              :class="{ 'line-through text-gray-400': child.isCompleted }"
            >
              {{ child.title }}
            </span>
            <button
              class="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 text-gray-300 hover:text-red-500 rounded transition-all flex-shrink-0"
              @click="emit('delete-child', child.id)"
            >
              <Trash2 :size="12" />
            </button>
          </div>
        </div>

        <div class="flex gap-2">
          <input
            v-model="newChildTitle"
            class="flex-1 px-2.5 py-1.5 text-[13px] text-gray-700 bg-white border border-dashed border-gray-300 rounded-md transition-colors focus:outline-none focus:border-blue-500 focus:border-solid placeholder:text-gray-400"
            :placeholder="$t('task.quickAdd')"
            @keydown.enter="onAddChild"
          />
          <button class="px-3 py-1.5 text-[13px] font-medium text-white bg-blue-500 rounded-md transition-colors hover:bg-blue-600" @click="onAddChild">
            {{ $t('task.add') }}
          </button>
        </div>
      </div>

      <div class="px-5 py-4 border-t border-gray-200 flex justify-start">
        <button class="flex items-center gap-1.5 px-4 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md transition-colors hover:bg-red-100" @click="onDelete">
          <Trash2 :size="16" />
          {{ $t('task.delete') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>