<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import SettingsLayout from '@/components/settings/SettingsLayout.vue'
import { useSettings } from '@/composables/useSettings'

const { loadGlobalSettings } = useSettings()

onMounted(async () => {
  // Preload global settings on mount
  await loadGlobalSettings()
})
</script>

<template>
  <SettingsLayout>
    <RouterView />
  </SettingsLayout>
</template>
