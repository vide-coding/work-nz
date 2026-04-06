<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Check, Trash2, Pencil, GripVertical } from 'lucide-vue-next'
import draggable from 'vuedraggable'
import type { Task } from '@/types'

interface StatusOption { value: string; label: string; color: string }
interface PriorityOption { value: string; label: string; color: string }

interface Props {
  task: Task | null
  visible: boolean
  statusOptions?: StatusOption[]
  priorityOptions?: PriorityOption[]
  childTasks?: Task[]
  childCount?: { total: number; completed: number }
}

const props = withDefaults(defineProps<Props>(), {
  statusOptions: () => [
    { value: 'todo', label: 'To Do', color: '#9CA3AF' },
    { value: 'in_progress', label: 'In Progress', color: '#3B82F6' },
    { value: 'done', label: 'Done', color: '#10B981' },
  ],
  priorityOptions: () => [
    { value: 'low', label: 'Low', color: '#9CA3AF' },
    { value: 'medium', label: 'Medium', color: '#10B981' },
    { value: 'high', label: 'High', color: '#F59E0B' },
    { value: 'urgent', label: 'Urgent', color: '#EF4444' },
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
  'update-child': [childId: string, title: string]
  'reorder-children': [childIds: string[]]
}>()

const { t } = useI18n()

const editTitle = ref('')
const editDescription = ref('')
const editStatus = ref('')
const editPriority = ref('')
const editAssignee = ref('')
const editDueDate = ref('')
const newChildTitle = ref('')
const pendingDelete = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)
const isVisible = ref(false)

// 子任务编辑状态
const editingChildId = ref<string | null>(null)
const editingChildTitle = ref('')

// 子任务本地副本（vuedraggable 需要）
const localChildTasks = ref<Task[]>([...props.childTasks])

watch(() => props.childTasks, (tasks) => {
  localChildTasks.value = [...tasks]
})

function startEditChild(child: Task) {
  editingChildId.value = child.id
  editingChildTitle.value = child.title
}

function saveEditChild() {
  if (editingChildId.value && editingChildTitle.value.trim()) {
    emit('update-child', editingChildId.value, editingChildTitle.value.trim())
  }
  cancelEditChild()
}

function cancelEditChild() {
  editingChildId.value = null
  editingChildTitle.value = ''
}

function onChildKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    saveEditChild()
  } else if (e.key === 'Escape') {
    cancelEditChild()
  }
}

// vuedraggable 排序变化
function onChildTasksChange(evt: { moved?: { element: Task; newIndex: number } }) {
  if (evt.moved) {
    const orderedIds = localChildTasks.value.map(t => t.id)
    emit('reorder-children', orderedIds)
  }
}

// Animate slide-in/out
watch(
  () => props.visible,
  (v) => {
    if (v) {
      isVisible.value = true
      nextTick(() => titleInput.value?.focus())
    } else {
      setTimeout(() => { isVisible.value = false }, 300)
    }
  }
)

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
      pendingDelete.value = false
    }
  },
  { immediate: true }
)

function triggerSave() {
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

function onStatusChange(val: string) {
  editStatus.value = val
  triggerSave()
}

function onPriorityChange(val: string) {
  editPriority.value = val
  triggerSave()
}

function onDelete() {
  if (!props.task) return
  if (pendingDelete.value) {
    emit('delete', props.task.id)
    pendingDelete.value = false
  } else {
    pendingDelete.value = true
  }
}

function cancelDelete() {
  pendingDelete.value = false
}

function onClose() {
  triggerSave()
  emit('close')
}

function onAddChild() {
  const title = newChildTitle.value.trim()
  if (!title || !props.task) return
  emit('add-child', props.task.id, title)
  newChildTitle.value = ''
}


const subtaskProgress = ref(0)
watch(
  () => props.childCount,
  (count) => {
    subtaskProgress.value = count.total > 0 ? (count.completed / count.total) * 100 : 0
  },
  { immediate: true }
)
</script>

<template>
  <!-- Slide-out panel -->
  <div
    class="relative flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
    :class="isVisible ? 'w-[400px]' : 'w-0'"
  >
    <div class="w-[400px] h-screen bg-white dark:bg-gray-800 shadow-[-4px_0_24px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
        <div class="flex items-center gap-2 min-w-0">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white truncate">{{ $t('task.task') }}</h3>
        </div>
        <button
          class="flex items-center justify-center w-8 h-8 text-gray-500 dark:text-gray-400 bg-transparent border-none rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @click="onClose"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Scrollable content -->
      <div class="flex-1 px-5 py-4 overflow-y-auto flex flex-col gap-4">

        <!-- Title -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ $t('task.task') }}</label>
          <input
            ref="titleInput"
            v-model="editTitle"
            class="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md transition-colors focus:outline-none focus:border-indigo-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            :placeholder="$t('task.titlePlaceholder')"
            @blur="triggerSave"
          />
        </div>

        <!-- Status & Priority -->
        <div class="flex flex-col gap-3">
          <!-- Status pills -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ $t('task.status') }}</label>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="opt in statusOptions"
                :key="opt.value"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border transition-all duration-150 cursor-pointer"
                :class="editStatus === opt.value
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
                @click="onStatusChange(opt.value)"
              >
                <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: opt.color }" />
                <span class="truncate max-w-[80px]">{{ opt.label }}</span>
              </button>
            </div>
          </div>

          <!-- Priority pills -->
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ $t('task.priority') }}</label>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="opt in priorityOptions"
                :key="opt.value"
                class="flex items-center gap-1 px-2 py-1.5 rounded-md text-[12px] font-medium border transition-all duration-150 cursor-pointer"
                :class="editPriority === opt.value
                  ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'"
                @click="onPriorityChange(opt.value)"
              >
                <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ backgroundColor: opt.color }" />
                {{ opt.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ $t('task.description') }}</label>
          <textarea
            v-model="editDescription"
            class="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md resize-y min-h-20 transition-colors focus:outline-none focus:border-indigo-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            :placeholder="$t('task.descriptionPlaceholder')"
            rows="3"
            @blur="triggerSave"
          />
        </div>

        <!-- Assignee + Due Date -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ $t('task.assignee') }}</label>
            <input
              v-model="editAssignee"
              class="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md transition-colors focus:outline-none focus:border-indigo-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              :placeholder="$t('task.assigneePlaceholder')"
              @blur="triggerSave"
            />
          </div>

          <div class="flex flex-col gap-1">
            <label class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{{ $t('task.dueDate') }}</label>
            <input
              v-model="editDueDate"
              type="date"
              class="w-full px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md transition-colors focus:outline-none focus:border-indigo-500 cursor-pointer"
              @change="triggerSave"
            />
          </div>
        </div>

        <!-- Subtasks -->
        <div class="border-t border-gray-100 dark:border-gray-700 px-0 pt-4 -mx-5 px-5">
          <!-- Header with progress -->
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {{ $t('task.subtasks') }}
            </span>
            <span
              v-if="childCount.total > 0"
              class="text-[11px] font-medium px-2 py-0.5 rounded-full"
              :class="subtaskProgress === 100
                ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
            >
              {{ childCount.completed }}/{{ childCount.total }}
            </span>
          </div>

          <!-- Progress bar -->
          <div v-if="childCount.total > 0" class="mb-3">
            <div class="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500 ease-out"
                :class="subtaskProgress === 100 ? 'bg-green-400' : 'bg-indigo-400'"
                :style="{ width: `${subtaskProgress}%` }"
              />
            </div>
          </div>

          <!-- Add subtask input (放在前面) -->
          <div class="flex items-center gap-2 mb-3">
            <input
              v-model="newChildTitle"
              class="flex-1 px-3 py-2 text-[13px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg transition-colors focus:outline-none focus:border-indigo-400 focus:border-solid focus:bg-gray-50 dark:focus:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              :placeholder="$t('task.addSubtaskPlaceholder')"
              @keydown.enter="onAddChild"
            />
            <button
              class="px-3 py-2 text-[13px] font-medium text-white bg-indigo-600 dark:bg-indigo-500 rounded-lg transition-colors hover:bg-indigo-700 dark:hover:bg-indigo-600 cursor-pointer border-none"
              @click="onAddChild"
            >
              {{ $t('task.add') }}
            </button>
          </div>

          <!-- Subtask list -->
          <div class="flex flex-col gap-1.5 mb-2">
            <draggable
              v-model="localChildTasks"
              item-key="id"
              handle=".subtask-drag-handle"
              class="flex flex-col gap-1.5"
              animation="200"
              force-fallback="true"
              ghost-class="opacity-50"
              @change="onChildTasksChange"
            >
              <template #item="{ element: child }">
                <div
                  class="group flex items-center gap-2 p-2 bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-lg hover:border-gray-200 dark:hover:border-gray-500 transition-colors"
                >
                  <!-- Drag handle -->
                  <div class="subtask-drag-handle cursor-grab text-gray-300 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-500 flex-shrink-0 active:cursor-grabbing">
                    <GripVertical :size="14" />
                  </div>

                  <!-- Checkbox -->
                  <button
                    class="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all duration-150 cursor-pointer"
                    :class="child.isCompleted
                      ? 'bg-green-500 border-green-500'
                      : 'border-gray-300 dark:border-gray-500 hover:border-indigo-400'"
                    @click="emit('toggle-child', child.id)"
                  >
                    <Check v-if="child.isCompleted" :size="9" class="text-white stroke-[3]" />
                  </button>

                  <!-- Title (editable) -->
                  <template v-if="editingChildId === child.id">
                    <input
                      v-model="editingChildTitle"
                      class="flex-1 px-2 py-1 text-[13px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-indigo-300 dark:border-indigo-500 rounded focus:outline-none focus:border-indigo-500"
                      @keydown="onChildKeydown"
                      @blur="saveEditChild"
                    />
                    <button
                      class="flex items-center justify-center w-5 h-5 text-green-500 hover:text-green-600 flex-shrink-0 bg-transparent border-none cursor-pointer"
                      @click="saveEditChild"
                    >
                      <Check :size="14" />
                    </button>
                    <button
                      class="flex items-center justify-center w-5 h-5 text-gray-400 hover:text-gray-600 flex-shrink-0 bg-transparent border-none cursor-pointer"
                      @click="cancelEditChild"
                    >
                      <X :size="14" />
                    </button>
                  </template>
                  <template v-else>
                    <span
                      class="flex-1 text-[13px] text-gray-700 dark:text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer"
                      :class="{ 'line-through text-gray-400 dark:text-gray-500': child.isCompleted }"
                      @dblclick="startEditChild(child)"
                    >
                      {{ child.title }}
                    </span>
                    <button
                      class="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 text-gray-300 hover:text-indigo-500 dark:text-gray-500 dark:hover:text-indigo-400 rounded transition-all flex-shrink-0 bg-transparent border-none cursor-pointer"
                      @click="startEditChild(child)"
                    >
                      <Pencil :size="12" />
                    </button>
                    <button
                      class="opacity-0 group-hover:opacity-100 flex items-center justify-center w-5 h-5 text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded transition-all flex-shrink-0 bg-transparent border-none cursor-pointer"
                      @click="emit('delete-child', child.id)"
                    >
                      <X :size="12" />
                    </button>
                  </template>
                </div>
              </template>
            </draggable>

            <!-- Empty state -->
            <div v-if="childCount.total === 0" class="flex items-center justify-center py-6">
              <p class="text-[12px] text-gray-400 dark:text-gray-500">{{ $t('task.noSubtasks') }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-4 border-t border-gray-200 dark:border-gray-700">
        <template v-if="pendingDelete">
          <div class="flex items-center gap-2">
            <p class="flex-1 text-[13px] text-gray-600 dark:text-gray-400">{{ $t('task.deleteConfirm') }}</p>
            <button
              class="px-3 py-1.5 text-[13px] font-medium text-white bg-red-500 dark:bg-red-600 rounded-md transition-colors hover:bg-red-600 dark:hover:bg-red-500 cursor-pointer border-none"
              @click="onDelete"
            >
              {{ $t('common.confirm') }}
            </button>
            <button
              class="px-3 py-1.5 text-[13px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md transition-colors hover:bg-gray-200 dark:hover:bg-gray-600 cursor-pointer"
              @click="cancelDelete"
            >
              {{ $t('common.cancel') }}
            </button>
          </div>
        </template>
        <button
          v-else
          class="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg transition-colors hover:bg-red-100 dark:hover:bg-red-900/40 cursor-pointer w-full justify-center"
          @click="onDelete"
        >
          <Trash2 :size="14" />
          {{ $t('task.delete') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* List animations */
.list-enter-active {
  transition: all 0.2s ease-out;
}
.list-leave-active {
  transition: all 0.15s ease-in;
}
.list-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.list-leave-to {
  opacity: 0;
  transform: translateX(6px);
}
.list-move {
  transition: transform 0.2s ease;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #E5E7EB;
  border-radius: 2px;
}
.dark ::-webkit-scrollbar-thumb {
  background: #374151;
}
</style>
