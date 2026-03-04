<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter, useRoute } from 'vue-router'
import { Globe, FolderKanban, ArrowLeft } from 'lucide-vue-next'
import { computed } from 'vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const isGlobalSettings = computed(() => route.path === '/settings/global')

function goBack() {
  router.back()
}
</script>

<template>
  <div class="flex min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Main content with header -->
    <main class="flex-1 overflow-auto">
      <!-- Header -->
      <div
        class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4"
      >
        <div class="flex items-center gap-4">
          <button
            @click="goBack"
            class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <ArrowLeft class="w-4 h-4" />
          </button>
          <div class="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <component :is="isGlobalSettings ? Globe : FolderKanban" class="w-5 h-5" />
            <span class="font-semibold">{{
              isGlobalSettings ? t('settings.global') : t('settings.workspace')
            }}</span>
          </div>
        </div>
      </div>

      <!-- Content -->
      <slot></slot>
    </main>
  </div>
</template>
