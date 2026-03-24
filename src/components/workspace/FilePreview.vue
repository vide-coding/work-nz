<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { convertFileSrc } from '@tauri-apps/api/core'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import VueOfficeDocx from '@vue-office/docx'
import VueOfficeExcel from '@vue-office/excel'
import '@vue-office/docx/lib/index.css'
import '@vue-office/excel/lib/index.css'
import type { FileNode } from '@/types'
import type { PreviewKind } from '@/types'
import { fsApi } from '@/composables/useApi'

const props = defineProps<{
  selectedFile: FileNode | null
  fileContent: string
  previewKind: PreviewKind | null
  isLoadingPreview: boolean
  currentDirPath: string
}>()

// 二进制文件内容（用于 docx/excel）
const binaryData = ref<ArrayBuffer | null>(null)
const isLoadingBinary = ref(false)

// 构建文件的完整路径
const fullFilePath = computed(() => {
  if (!props.selectedFile || props.selectedFile.kind === 'dir') return ''
  return props.currentDirPath
    ? `${props.currentDirPath}/${props.selectedFile.name}`
    : props.selectedFile.name
})

// 图片 URL
const imageUrl = computed(() => {
  if (props.previewKind !== 'image' || !fullFilePath.value) return ''
  return convertFileSrc(fullFilePath.value)
})

// Markdown 文件的基础路径（文件所在目录）
const markdownBasePath = computed(() => {
  if (!fullFilePath.value) return ''
  // 获取文件所在的目录路径
  const lastSlash = fullFilePath.value.lastIndexOf('/')
  if (lastSlash === -1) return ''
  return fullFilePath.value.substring(0, lastSlash)
})

// PDF URL
const pdfUrl = computed(() => {
  if (props.previewKind !== 'pdf' || !fullFilePath.value) return ''
  return convertFileSrc(fullFilePath.value)
})

// 加载二进制文件内容
async function loadBinaryContent() {
  if (!fullFilePath.value) return
  if (props.previewKind !== 'word' && props.previewKind !== 'excel') return

  isLoadingBinary.value = true
  try {
    const result = await fsApi.readBinary(fullFilePath.value)
    // 将 Base64 转换为 ArrayBuffer
    const binaryString = atob(result.data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    binaryData.value = bytes.buffer
  } catch (e) {
    console.error('Failed to load binary content:', e)
    binaryData.value = null
  } finally {
    isLoadingBinary.value = false
  }
}

// 监听文件变化，重新加载二进制内容
watch(
  () => props.selectedFile?.path,
  () => {
    binaryData.value = null
    if (props.previewKind === 'word' || props.previewKind === 'excel') {
      loadBinaryContent()
    }
  }
)

// 初始加载
watch(
  () => props.previewKind,
  (kind) => {
    if ((kind === 'word' || kind === 'excel') && fullFilePath.value) {
      loadBinaryContent()
    }
  },
  { immediate: true }
)

// Word/Excel 渲染完成/错误处理
function onDocxRendered() {
  console.log('Docx rendered')
}

function onDocxError(e: any) {
  console.error('Docx error:', e)
}

function onExcelRendered() {
  console.log('Excel rendered')
}

function onExcelError(e: any) {
  console.error('Excel error:', e)
}
</script>

<template>
  <aside
    v-if="selectedFile"
    class="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-auto"
  >
    <div class="p-4">
      <div class="flex items-center gap-3 mb-4">
        <component :is="getFileIcon(selectedFile)" class="w-8 h-8 text-gray-400" />
        <div class="flex-1 min-w-0">
          <p class="font-medium text-gray-900 dark:text-white truncate">
            {{ selectedFile.name }}
          </p>
          <p class="text-xs text-gray-500">
            {{ selectedFile.kind === 'dir' ? $t('workspace.folder') : $t('workspace.file') }}
          </p>
        </div>
      </div>

      <!-- Preview Content -->
      <div v-if="isLoadingPreview || isLoadingBinary" class="flex items-center justify-center py-8">
        <Loader2 class="w-6 h-6 text-indigo-600 animate-spin" />
      </div>

      <!-- Image Preview -->
      <div v-else-if="previewKind === 'image'" class="bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
        <img
          :src="imageUrl"
          :alt="selectedFile?.name"
          class="max-w-full h-auto rounded-lg"
          @error="($event.target as HTMLImageElement).style.display = 'none'"
        />
      </div>

      <!-- Markdown Preview -->
      <div v-else-if="previewKind === 'markdown'" class="prose dark:prose-invert max-w-none">
        <MarkdownRenderer :content="fileContent" :base-path="markdownBasePath" />
      </div>

      <!-- Text Preview -->
      <div v-else-if="previewKind === 'text'" class="prose dark:prose-invert max-w-none">
        <pre
          class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96"
          >{{ fileContent }}</pre
        >
      </div>

      <!-- PDF Preview -->
      <div
        v-else-if="previewKind === 'pdf'"
        class="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"
      >
        <iframe
          :src="pdfUrl"
          class="w-full h-[600px] rounded-lg"
          :title="$t('workspace.pdfPreview')"
        />
      </div>

      <!-- Word Preview -->
      <div
        v-else-if="previewKind === 'word'"
        class="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"
      >
        <VueOfficeDocx
          v-if="binaryData"
          :src="binaryData"
          style="height: 600px"
          @rendered="onDocxRendered"
          @error="onDocxError"
        />
        <div v-else class="flex items-center justify-center h-[600px]">
          <p class="text-gray-500">{{ $t('common.loading') }}</p>
        </div>
      </div>

      <!-- Excel Preview -->
      <div
        v-else-if="previewKind === 'excel'"
        class="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden"
      >
        <VueOfficeExcel
          v-if="binaryData"
          :src="binaryData"
          style="height: 600px"
          @rendered="onExcelRendered"
          @error="onExcelError"
        />
        <div v-else class="flex items-center justify-center h-[600px]">
          <p class="text-gray-500">{{ $t('common.loading') }}</p>
        </div>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>{{ $t('workspace.noPreview') }}</p>
      </div>
    </div>
  </aside>
</template>

<script lang="ts">
import { Folder, File, Image as ImageIcon, FileCode } from 'lucide-vue-next'

function getFileIcon(node: FileNode) {
  if (node.kind === 'dir') return Folder
  const ext = node.name.split('.').pop()?.toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) return ImageIcon
  if (['md', 'txt', 'json', 'js', 'ts', 'vue', 'css', 'html'].includes(ext || '')) return FileCode
  return File
}
</script>
