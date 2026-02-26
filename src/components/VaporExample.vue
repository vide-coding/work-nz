<script setup vapor lang="ts">
import { ref, getCurrentInstance, onMounted } from "vue";

const count = ref(0);
const instance = getCurrentInstance();

onMounted(() => {
  console.log("VaporExample mounted. Instance:", instance);
  if (instance && (instance as any).vapor) {
    console.log("✅ Running in Vapor Mode!");
  } else {
    console.warn("⚠️ Running in VDOM Mode (not Vapor)!");
  }
});
</script>

<template>
  <div
    class="p-6 border border-gray-200 rounded-xl shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700"
  >
    <h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
      Vapor Mode Example
    </h2>

    <div class="flex items-center gap-4 mb-6">
      <span class="text-lg text-gray-700 dark:text-gray-300"
        >Count: <span class="font-mono font-bold">{{ count }}</span></span
      >
      <button
        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
        @click="count++"
      >
        Increment
      </button>
    </div>

    <div
      class="bg-gray-100 dark:bg-gray-900 p-4 rounded mb-6 text-sm font-mono"
    >
      <p>Check console for "✅ Running in Vapor Mode!" message.</p>
      <p
        v-if="instance && (instance as any).vapor"
        class="text-green-600 font-bold mt-2"
      >
        Status: Active (Vapor)
      </p>
      <p v-else class="text-red-600 font-bold mt-2">Status: Inactive (VDOM)</p>
    </div>
  </div>
</template>
