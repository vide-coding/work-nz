<template>
  <div
    :class="['markdown-body', `markdown-theme-${theme}`, { 'markdown-body-compact': compact }]"
    v-html="htmlContent"
    @click="handleContentClick"
  />

  <!-- 确认对话框 -->
  <ConfirmDialog
    v-model="confirmDialog.visible"
    :file-type="confirmDialog.fileType"
    :title="confirmDialog.title"
    @confirm="handleConfirmOpen"
  />
</template>

<script setup lang="ts">
import { marked, type Renderer, type Tokens } from 'marked'
import { computed, watch, ref, reactive } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { ThemeName } from '@/types/theme'
import { useMarkdownHighlight } from '@/composables/useMarkdownHighlight'
import { useMarkdownLinkHandler, parseLink } from '@/composables/useMarkdownLinkHandler'
import { processMarkdownExtensions } from '@/composables/useMarkdownExtensions'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const props = withDefaults(
  defineProps<{
    content: string
    basePath?: string
    theme?: ThemeName
    compact?: boolean
    enableHighlight?: boolean
  }>(),
  {
    basePath: '',
    theme: 'light',
    compact: false,
    enableHighlight: true,
  }
)

const emit = defineEmits<{
  (e: 'rendered', content: string): void
}>()

// 代码高亮 composable
const { highlightCode: highlightCodeAsync } = useMarkdownHighlight()

// 链接处理 composable
const { handleExternalLink, handleLocalLink } = useMarkdownLinkHandler()

// 确认对话框状态
const confirmDialog = reactive({
  visible: false,
  title: '',
  fileType: 'link' as 'code' | 'link' | 'directory',
})

// 待处理的链接信息
let pendingLinkInfo: ReturnType<typeof parseLink> = null

// 同步版本的 highlightCode（向后兼容）
function highlightCode(code: string, language: string): string {
  // 同步调用时会返回空字符串，因为 Shiki 是异步的
  // 实际高亮在 postProcess 中处理
  return escapeHtml(code)
}

// 后处理 HTML，替换代码块为高亮版本
async function postProcessHtml(html: string): Promise<string> {
  if (!props.enableHighlight) return html

  // 匹配所有代码块
  const codeBlockRegex =
    /<div class="code-block-wrapper">\s*<div class="code-header">\s*<span class="code-lang">(\w+)<\/span>.*?<pre class="language-(\w+)"[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>\s*<\/div>/g

  const matches: Array<{ lang: string; code: string; start: number; end: number }> = []
  let match

  while ((match = codeBlockRegex.exec(html)) !== null) {
    const fullMatch = match[0]
    const lang = match[1]
    const code = decodeHtmlEntities(match[3])
    matches.push({ lang, code, start: match.index, end: match.index + fullMatch.length })
  }

  // 从后往前替换，避免索引变化
  let result = html
  for (const m of matches.reverse()) {
    const highlightedCode = await highlightCodeAsync(m.code, m.lang)
    const newBlock = `<div class="code-block-wrapper">
      <div class="code-header">
        <span class="code-lang">${m.lang}</span>
        <button class="copy-button" data-code="${encodeURIComponent(m.code)}" title="Copy code">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
      </div>
      <pre class="language-${m.lang}"><code class="language-${m.lang}">${highlightedCode}</code></pre>
    </div>`

    result = result.slice(0, m.start) + newBlock + result.slice(m.end)
  }

  return result
}

// HTML 实体解码
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

// HTML 转义（用于初始渲染）
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 存储渲染后的 HTML
const _html = ref('')

// 创建自定义 renderer
function createRenderer(): Renderer {
  const renderer = new marked.Renderer()

  // 重写图片渲染
  renderer.image = ({ href, title, text }: Tokens.Image) => {
    let finalHref = href

    // 处理相对路径图片
    if (
      finalHref &&
      !finalHref.startsWith('http') &&
      !finalHref.startsWith('data:') &&
      props.basePath
    ) {
      const absolutePath = finalHref.startsWith('/') ? finalHref : `${props.basePath}/${finalHref}`
      finalHref = convertFileSrc(absolutePath)
    }

    return `<img src="${finalHref}" alt="${text}" title="${title || ''}" class="markdown-image" loading="lazy" />`
  }

  // 重写链接渲染 - 外部链接添加 target="_blank"
  renderer.link = ({ href, title, text }: Tokens.Link) => {
    const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'))
    const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : ''
    const classAttr = isExternal ? ' class="external-link"' : ' class="internal-link"'
    return `<a href="${href}" title="${title || ''}"${targetAttr}${classAttr}>${text}</a>`
  }

  // 重写代码块渲染 - 支持语法高亮
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const language = lang || 'text'

    // 直接返回转义后的代码，高亮在 postProcess 中异步处理
    const escapedCode = escapeHtml(text)

    return `<div class="code-block-wrapper">
      <div class="code-header">
        <span class="code-lang">${language}</span>
        <button class="copy-button" data-code="${encodeURIComponent(text)}" title="Copy code">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
      </div>
      <pre class="language-${language}"><code class="language-${language}">${escapedCode}</code></pre>
    </div>`
  }

  // 重写引用块渲染
  renderer.blockquote = ({ text }: Tokens.Blockquote) => {
    // 检测是否是警告框
    const alertMatch = text.match(/\[!([A-Z]+)\]\s*\n?/)
    if (alertMatch) {
      const alertType = alertMatch[1].toLowerCase()
      const cleanText = text.replace(/\[!\w+\]\s*\n?/, '')
      return `<blockquote class="alert alert-${alertType}">${cleanText}</blockquote>`
    }
    return `<blockquote>${text}</blockquote>`
  }

  return renderer
}

// 任务列表扩展 - 使用 Marked v17 extensions API
const taskListExtension = {
  name: 'taskList',
  renderer: {
    listitem: (token: Tokens.ListItem): false | string => {
      if (token.task) {
        return `<li class="task-list-item">
        <input type="checkbox" ${token.checked ? 'checked' : ''} disabled />
        <span>${token.text}</span>
      </li>`
      }
      return false // 返回 false 使用默认渲染
    },
  },
}

// 异步渲染 Markdown
async function renderMarkdown(): Promise<string> {
  if (!props.content) return ''
  try {
    const renderer = createRenderer()
    // Marked v17: gfm 选项仍然可用，但默认启用
    const html = await marked(props.content, {
      renderer,
      extensions: [taskListExtension],
      gfm: true,
    })

    // 后处理：异步高亮代码块
    let processedHtml = await postProcessHtml(html)

    // 后处理：处理 mermaid 图表和数学公式
    processedHtml = await processMarkdownExtensions(processedHtml)

    // 发出渲染完成事件
    emit('rendered', processedHtml)
    return processedHtml
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return `<p class="text-[var(--color-error)]">Failed to render markdown: ${error}</p>`
  }
}

// 监听内容变化并重新渲染
watch(
  () => props.content,
  async () => {
    _html.value = await renderMarkdown()
  },
  { immediate: true }
)

// 暴露给模板使用
const htmlContent = computed(() => _html.value)

// 处理内容点击事件
async function handleContentClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  // 检查是否点击了链接
  const link = target.closest('a')
  if (!link) return

  // 阻止默认行为
  event.preventDefault()

  const href = link.getAttribute('href')
  if (!href) return

  // 外部链接直接打开
  if (href.startsWith('http://') || href.startsWith('https://')) {
    await handleExternalLink(href)
    return
  }

  // 本地链接需要确认
  const linkInfo = parseLink(href, props.basePath || '')
  if (!linkInfo) return

  pendingLinkInfo = linkInfo

  if (linkInfo.isCodeFile) {
    confirmDialog.fileType = 'code'
  } else if (linkInfo.isDirectory) {
    confirmDialog.fileType = 'directory'
  } else {
    confirmDialog.fileType = 'link'
  }

  confirmDialog.visible = true
}

// 确认打开文件
async function handleConfirmOpen() {
  if (pendingLinkInfo) {
    await handleLocalLink(pendingLinkInfo)
    pendingLinkInfo = null
  }
}

// 代码复制功能
watch(
  htmlContent,
  () => {
    setTimeout(() => {
      document.querySelectorAll('.copy-button').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const code = btn.getAttribute('data-code')
          if (code) {
            try {
              await navigator.clipboard.writeText(decodeURIComponent(code))
              const originalHTML = btn.innerHTML
              btn.innerHTML =
                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
              btn.classList.add('text-green-500')
              setTimeout(() => {
                btn.innerHTML = originalHTML
                btn.classList.remove('text-green-500')
              }, 2000)
            } catch (err) {
              console.error('Failed to copy:', err)
            }
          }
        })
      })
    }, 0)
  },
  { immediate: true }
)
</script>

<style scoped>
.markdown-body {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.markdown-body-compact {
  padding: 0.5rem;
  font-size: 13px;
}

.markdown-body-compact :deep(h1) {
  font-size: 1.5em;
  margin-top: 1rem;
}

.markdown-body-compact :deep(h2) {
  font-size: 1.25em;
  margin-top: 1rem;
}

.markdown-body-compact :deep(p) {
  margin-bottom: 0.5rem;
}
</style>
