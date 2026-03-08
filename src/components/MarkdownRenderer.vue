<template>
  <div
    :class="['markdown-body', `markdown-theme-${theme}`, { 'markdown-body-compact': compact }]"
    v-html="htmlContent"
  />
</template>

<script setup lang="ts">
import { marked, type Renderer, type Tokens } from 'marked'
import { computed, watch, ref } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { ThemeName } from '@/types/theme'
import { useMarkdownHighlight } from '@/composables/useMarkdownHighlight'

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
const { highlightCode } = useMarkdownHighlight()

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
    return `<a href="${href}" title="${title || ''}"${targetAttr}>${text}</a>`
  }

  // 重写代码块渲染 - 支持语法高亮
  renderer.code = ({ text, lang }: Tokens.Code) => {
    const language = lang || 'text'

    // 如果启用了高亮，使用高亮后的代码
    let highlightedCode = text
    if (props.enableHighlight) {
      highlightedCode = highlightCode(text, language)
    }

    return `<div class="code-block-wrapper">
      <div class="code-header">
        <span class="code-lang">${language}</span>
        <button class="copy-button" data-code="${encodeURIComponent(text)}" title="Copy code">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
        </button>
      </div>
      <pre class="language-${language}"><code class="language-${language}">${highlightedCode}</code></pre>
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

  // 表格渲染 - 使用 v17 正确的 token 结构
  // Tokens.Table 有 header (string) 和 rows (string[])
  renderer.table = (token: Tokens.Table) => {
    const rows = token.rows
      .map((row) => {
        const cells = row.map((cell) => `<td>${cell}</td>`).join('')
        return `<tr>${cells}</tr>`
      })
      .join('')

    return `<div class="table-wrapper">
      <table>
        <thead>${token.header}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`
  }

  // 重写列表项渲染 - 支持任务列表
  renderer.listitem = ({ text, task, checked }: Tokens.ListItem) => {
    if (task) {
      return `<li class="task-list-item">
        <input type="checkbox" ${checked ? 'checked' : ''} disabled />
        <span>${text}</span>
      </li>`
    }
    return `<li>${text}</li>`
  }

  return renderer
}

// 异步渲染 Markdown
async function renderMarkdown(): Promise<string> {
  if (!props.content) return ''
  try {
    const renderer = createRenderer()
    // Marked v17: gfm 选项仍然可用，但默认启用
    const html = await marked(props.content, {
      renderer,
      gfm: true,
    })

    // 发出渲染完成事件
    emit('rendered', html)
    return html
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
