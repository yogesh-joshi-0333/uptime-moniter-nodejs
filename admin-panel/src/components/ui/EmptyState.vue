<script setup>
defineProps({
  title: String,
  description: String,
  icon: {
    type: String,
    default: 'empty'
  },
  actionLabel: String
})

defineEmits(['action'])
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div class="w-16 h-16 mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <svg v-if="icon === 'empty'" class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <svg v-else-if="icon === 'search'" class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <svg v-else-if="icon === 'error'" class="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <slot name="icon" v-else />
    </div>
    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">{{ title }}</h3>
    <p v-if="description" class="text-sm text-gray-500 dark:text-gray-400 max-w-sm">{{ description }}</p>
    <button
      v-if="actionLabel"
      @click="$emit('action')"
      class="btn-primary mt-4"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
