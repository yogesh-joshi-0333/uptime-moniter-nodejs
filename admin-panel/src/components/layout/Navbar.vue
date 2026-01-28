<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useWebsitesStore } from '@/stores/websites'
import sseService from '@/services/websocket'

const emit = defineEmits(['toggle-sidebar'])

const route = useRoute()
const themeStore = useThemeStore()
const websitesStore = useWebsitesStore()

const isConnected = sseService.getConnectionState()

const pageTitle = computed(() => {
  const titles = {
    '/': 'Dashboard',
    '/websites': 'Websites',
    '/logs': 'Logs',
    '/incidents': 'Incidents',
    '/settings': 'Settings'
  }
  return titles[route.path] || route.name || 'Uptime Monitor'
})

onMounted(() => {
  sseService.connect()
})

onUnmounted(() => {
  sseService.disconnect()
})
</script>

<template>
  <header class="sticky top-0 z-30 h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
    <div class="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
      <!-- Left side -->
      <div class="flex items-center gap-4">
        <!-- Mobile menu button -->
        <button
          @click="emit('toggle-sidebar')"
          class="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg class="w-6 h-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <!-- Page title -->
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ pageTitle }}
        </h1>
      </div>

      <!-- Right side -->
      <div class="flex items-center gap-2">
        <!-- Connection status -->
        <div class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          :class="isConnected.value
            ? 'bg-success-50 text-success-600 dark:bg-success-500/20 dark:text-success-400'
            : 'bg-danger-50 text-danger-600 dark:bg-danger-500/20 dark:text-danger-400'"
        >
          <span class="w-2 h-2 rounded-full animate-pulse"
            :class="isConnected.value ? 'bg-success-500' : 'bg-danger-500'"
          ></span>
          {{ isConnected.value ? 'Live' : 'Disconnected' }}
        </div>

        <!-- Stats quick view -->
        <div class="hidden md:flex items-center gap-4 px-4 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-success-500"></span>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ websitesStore.upWebsites }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-danger-500"></span>
            <span class="text-sm font-medium text-gray-700 dark:text-gray-300">{{ websitesStore.downWebsites }}</span>
          </div>
        </div>

        <!-- Theme toggle -->
        <button
          @click="themeStore.toggleTheme"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Toggle theme"
        >
          <!-- Sun icon (shown in dark mode) -->
          <svg v-if="themeStore.isDark" class="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <!-- Moon icon (shown in light mode) -->
          <svg v-else class="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>

        <!-- Refresh button -->
        <button
          @click="websitesStore.fetchWebsites()"
          class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Refresh data"
        >
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>
