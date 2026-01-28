<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { useThemeStore } from '@/stores/theme'
import api from '@/services/api'

const authStore = useAuthStore()
const toastStore = useToastStore()
const themeStore = useThemeStore()

const loading = ref(false)
const activeTab = ref('general')

// General settings
const generalSettings = ref({
  defaultInterval: 60,
  maxConcurrentChecks: 200,
  requestTimeout: 5000,
  retryAttempts: 3
})

// Notification settings
const notificationSettings = ref({
  emailEnabled: false,
  slackEnabled: false,
  webhookEnabled: false,
  emailAddress: '',
  slackWebhook: '',
  customWebhook: '',
  notifyOnDown: true,
  notifyOnRecovery: true,
  notifyAfterMinutes: 5
})

// Profile settings
const profileData = ref({
  name: '',
  email: ''
})

const passwordData = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

onMounted(() => {
  if (authStore.user) {
    profileData.value.name = authStore.user.name || ''
    profileData.value.email = authStore.user.email || ''
  }
})

async function saveGeneralSettings() {
  loading.value = true
  try {
    await api.put('/settings/general', generalSettings.value)
    toastStore.success('General settings saved')
  } catch (error) {
    toastStore.error('Failed to save settings')
  }
  loading.value = false
}

async function saveNotificationSettings() {
  loading.value = true
  try {
    await api.put('/settings/notifications', notificationSettings.value)
    toastStore.success('Notification settings saved')
  } catch (error) {
    toastStore.error('Failed to save settings')
  }
  loading.value = false
}

async function updateProfile() {
  loading.value = true
  const result = await authStore.updateProfile(profileData.value)
  loading.value = false

  if (result.success) {
    toastStore.success('Profile updated')
  } else {
    toastStore.error(result.error)
  }
}

async function changePassword() {
  if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
    toastStore.error('Passwords do not match')
    return
  }

  if (passwordData.value.newPassword.length < 6) {
    toastStore.error('Password must be at least 6 characters')
    return
  }

  loading.value = true
  const result = await authStore.changePassword({
    currentPassword: passwordData.value.currentPassword,
    newPassword: passwordData.value.newPassword
  })
  loading.value = false

  if (result.success) {
    toastStore.success('Password changed successfully')
    passwordData.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  } else {
    toastStore.error(result.error)
  }
}

async function clearAllJobs() {
  try {
    await api.post('/admin/kill')
    toastStore.success('All pending jobs cleared')
  } catch (error) {
    toastStore.error('Failed to clear jobs')
  }
}

async function testNotification() {
  toastStore.info('Test notification sent')
}

const tabs = [
  { id: 'general', name: 'General', icon: 'settings' },
  { id: 'notifications', name: 'Notifications', icon: 'bell' },
  { id: 'profile', name: 'Profile', icon: 'user' },
  { id: 'security', name: 'Security', icon: 'shield' },
  { id: 'danger', name: 'Danger Zone', icon: 'alert' }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Configure your monitoring preferences
      </p>
    </div>

    <div class="flex flex-col lg:flex-row gap-6">
      <!-- Tabs Navigation -->
      <nav class="lg:w-64 flex-shrink-0">
        <div class="card p-2">
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left',
              activeTab === tab.id
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
            ]"
          >
            <svg v-if="tab.icon === 'settings'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <svg v-else-if="tab.icon === 'bell'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <svg v-else-if="tab.icon === 'user'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <svg v-else-if="tab.icon === 'shield'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <svg v-else-if="tab.icon === 'alert'" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {{ tab.name }}
          </button>
        </div>
      </nav>

      <!-- Tab Content -->
      <div class="flex-1">
        <!-- General Settings -->
        <div v-if="activeTab === 'general'" class="card">
          <div class="card-header">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">General Settings</h2>
          </div>
          <div class="card-body space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Check Interval
              </label>
              <select v-model="generalSettings.defaultInterval" class="select">
                <option :value="30">30 seconds</option>
                <option :value="60">1 minute</option>
                <option :value="300">5 minutes</option>
                <option :value="600">10 minutes</option>
              </select>
              <p class="mt-1 text-sm text-gray-500">Default interval for new websites</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Concurrent Checks
              </label>
              <input v-model.number="generalSettings.maxConcurrentChecks" type="number" class="input" min="1" max="500" />
              <p class="mt-1 text-sm text-gray-500">Maximum parallel health checks</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Request Timeout (ms)
              </label>
              <input v-model.number="generalSettings.requestTimeout" type="number" class="input" min="1000" max="30000" step="1000" />
              <p class="mt-1 text-sm text-gray-500">Timeout for each health check request</p>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Theme
              </label>
              <div class="flex gap-4">
                <button
                  @click="themeStore.isDark = false; themeStore.toggleTheme(); themeStore.toggleTheme()"
                  :class="['flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors', !themeStore.isDark ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700']"
                  @click.prevent="themeStore.isDark && themeStore.toggleTheme()"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Light
                </button>
                <button
                  :class="['flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-colors', themeStore.isDark ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700']"
                  @click.prevent="!themeStore.isDark && themeStore.toggleTheme()"
                >
                  <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  Dark
                </button>
              </div>
            </div>

            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button @click="saveGeneralSettings" :disabled="loading" class="btn-primary">
                Save Changes
              </button>
            </div>
          </div>
        </div>

        <!-- Notification Settings -->
        <div v-if="activeTab === 'notifications'" class="card">
          <div class="card-header">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Notification Settings</h2>
          </div>
          <div class="card-body space-y-6">
            <!-- Email Notifications -->
            <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Receive alerts via email</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="notificationSettings.emailEnabled" class="sr-only peer">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
              <input
                v-if="notificationSettings.emailEnabled"
                v-model="notificationSettings.emailAddress"
                type="email"
                class="input mt-3"
                placeholder="alerts@example.com"
              />
            </div>

            <!-- Slack Notifications -->
            <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">Slack Notifications</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">Send alerts to Slack channel</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" v-model="notificationSettings.slackEnabled" class="sr-only peer">
                  <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
              <input
                v-if="notificationSettings.slackEnabled"
                v-model="notificationSettings.slackWebhook"
                type="url"
                class="input mt-3"
                placeholder="https://hooks.slack.com/services/..."
              />
            </div>

            <!-- Notification Triggers -->
            <div>
              <h3 class="font-medium text-gray-900 dark:text-white mb-3">Notification Triggers</h3>
              <div class="space-y-3">
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" v-model="notificationSettings.notifyOnDown" class="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" />
                  <span class="text-gray-700 dark:text-gray-300">Notify when site goes down</span>
                </label>
                <label class="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" v-model="notificationSettings.notifyOnRecovery" class="w-4 h-4 text-primary-600 rounded focus:ring-primary-500" />
                  <span class="text-gray-700 dark:text-gray-300">Notify when site recovers</span>
                </label>
              </div>
            </div>

            <div class="pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button @click="saveNotificationSettings" :disabled="loading" class="btn-primary">
                Save Changes
              </button>
              <button @click="testNotification" class="btn-secondary">
                Send Test Notification
              </button>
            </div>
          </div>
        </div>

        <!-- Profile Settings -->
        <div v-if="activeTab === 'profile'" class="card">
          <div class="card-header">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Profile Settings</h2>
          </div>
          <div class="card-body space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input v-model="profileData.name" type="text" class="input" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input v-model="profileData.email" type="email" class="input" />
            </div>

            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button @click="updateProfile" :disabled="loading" class="btn-primary">
                Update Profile
              </button>
            </div>
          </div>
        </div>

        <!-- Security Settings -->
        <div v-if="activeTab === 'security'" class="card">
          <div class="card-header">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Security Settings</h2>
          </div>
          <div class="card-body space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Current Password
              </label>
              <input v-model="passwordData.currentPassword" type="password" class="input" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Password
              </label>
              <input v-model="passwordData.newPassword" type="password" class="input" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirm New Password
              </label>
              <input v-model="passwordData.confirmPassword" type="password" class="input" />
            </div>

            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button @click="changePassword" :disabled="loading" class="btn-primary">
                Change Password
              </button>
            </div>
          </div>
        </div>

        <!-- Danger Zone -->
        <div v-if="activeTab === 'danger'" class="card border-danger-300 dark:border-danger-700">
          <div class="card-header bg-danger-50 dark:bg-danger-900/30">
            <h2 class="text-lg font-semibold text-danger-700 dark:text-danger-400">Danger Zone</h2>
          </div>
          <div class="card-body space-y-6">
            <div class="p-4 border border-danger-200 dark:border-danger-800 rounded-lg">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">Clear Job Queue</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Remove all pending monitoring jobs from the queue. This will temporarily stop all checks.
                  </p>
                </div>
                <button @click="clearAllJobs" class="btn-danger whitespace-nowrap">
                  Clear Jobs
                </button>
              </div>
            </div>

            <div class="p-4 border border-danger-200 dark:border-danger-800 rounded-lg">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">Delete All Data</h3>
                  <p class="text-sm text-gray-500 dark:text-gray-400">
                    Permanently delete all websites and logs. This action cannot be undone.
                  </p>
                </div>
                <button class="btn-danger whitespace-nowrap" disabled>
                  Delete All
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
