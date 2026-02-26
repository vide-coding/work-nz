<script setup lang="ts">
import { ref, getCurrentInstance, onMounted } from 'vue'

const count = ref(0)
const instance = getCurrentInstance()

onMounted(() => {
  if (instance && (instance as any).vapor) {
    console.log('SimpleVDOM is running in VAPOR mode')
  } else {
    console.log('SimpleVDOM is running in VDOM mode')
  }
})
</script>

<template>
  <div class="p-4 border rounded bg-gray-50 dark:bg-gray-800">
    <h3 class="font-bold">Simple VDOM Component</h3>
    <button @click="count++" class="bg-green-500 text-white px-2 py-1 rounded">
      VDOM Count: {{ count }}
    </button>
  </div>
</template>
