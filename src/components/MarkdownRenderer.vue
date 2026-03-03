<template>
  <div class="prose dark:prose-invert max-w-none prose-sm" v-html="renderedContent" />
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { computed } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'

const props = defineProps<{
  content: string
  basePath?: string // 文件所在目录路径，用于处理相对路径图片
}>()

const renderedContent = computed(() => {
  // 自定义 renderer 处理图片路径
  const renderer = new marked.Renderer()

  renderer.image = ({
    href,
    title,
    text,
  }: {
    href: string
    title?: string | null
    text: string
  }) => {
    // 处理相对路径图片
    if (href && !href.startsWith('http') && !href.startsWith('data:') && props.basePath) {
      const absolutePath = href.startsWith('/') ? href : `${props.basePath}/${href}`
      // 使用 Tauri 的 convertFileSrc 转换为安全 URL
      href = convertFileSrc(absolutePath)
    }
    return `<img src="${href}" alt="${text}" title="${title || ''}" class="max-w-full h-auto" />`
  }

  return marked(props.content, { renderer, async: false })
})
</script>
