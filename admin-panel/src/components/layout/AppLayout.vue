<script setup>
import { ref } from 'vue'
import Sidebar from './Sidebar.vue'
import Navbar from './Navbar.vue'

const sidebarOpen = ref(false)

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function closeSidebar() {
  sidebarOpen.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <!-- Mobile sidebar backdrop -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
      @click="closeSidebar"
    ></div>

    <!-- Sidebar -->
    <Sidebar
      :open="sidebarOpen"
      @close="closeSidebar"
    />

    <!-- Main content area -->
    <div class="lg:pl-64">
      <Navbar @toggle-sidebar="toggleSidebar" />

      <main class="p-4 lg:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
