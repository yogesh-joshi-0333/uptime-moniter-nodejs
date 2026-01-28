<script setup>
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import AppLayout from '@/components/layout/AppLayout.vue'
import Toast from '@/components/ui/Toast.vue'

const router = useRouter()
const authStore = useAuthStore()
const themeStore = useThemeStore()

onMounted(() => {
  themeStore.initTheme()
  authStore.checkAuth()
})

watch(() => authStore.isAuthenticated, (isAuth) => {
  if (!isAuth && router.currentRoute.value.meta.requiresAuth) {
    router.push('/login')
  }
})
</script>

<template>
  <div :class="{ dark: themeStore.isDark }">
    <AppLayout v-if="authStore.isAuthenticated">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </AppLayout>
    <router-view v-else />
    <Toast />
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
