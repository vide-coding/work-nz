<template>
  <MarkdownRenderer
    :content="content"
    :theme="effectiveTheme"
    :base-path="basePath"
    :compact="compact"
    :enable-highlight="enableHighlight"
    @rendered="$emit('rendered', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import type { ThemeName } from '@/types/theme'
import type { MarkdownThemeConfig } from '@/types/markdown'

const props = withDefaults(
  defineProps<{
    content: string
    basePath?: string
    /** 主题配置，如果不提供则使用默认 */
    themeConfig?: MarkdownThemeConfig
    /** 当前系统主题模式 */
    systemTheme?: 'light' | 'dark'
    compact?: boolean
    enableHighlight?: boolean
  }>(),
  {
    basePath: '',
    compact: false,
    enableHighlight: true,
  }
)

const emit = defineEmits<{
  (e: 'rendered', content: string): void
}>()

// 计算实际使用的主题
const effectiveTheme = computed<ThemeName>(() => {
  const config = props.themeConfig

  if (!config) {
    // 没有配置时，根据系统主题返回默认值
    return props.systemTheme === 'dark' ? 'dark' : 'light'
  }

  if (config.mode === 'unified') {
    // 统一模式：始终使用同一个主题
    return config.unifiedTheme || 'light'
  } else {
    // 分离模式：根据系统主题选择
    return props.systemTheme === 'dark' ? config.darkTheme || 'dark' : config.lightTheme || 'light'
  }
})
</script>
