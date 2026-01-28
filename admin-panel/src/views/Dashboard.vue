<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWebsitesStore } from '@/stores/websites'
import { useLogsStore } from '@/stores/logs'
import sseService from '@/services/websocket'
import StatCard from '@/components/ui/StatCard.vue'
import ResponseTimeChart from '@/components/charts/ResponseTimeChart.vue'
import UptimeChart from '@/components/charts/UptimeChart.vue'
import StatusTimeline from '@/components/charts/StatusTimeline.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const websitesStore = useWebsitesStore()
const logsStore = useLogsStore()

const loading = ref(true)
const recentLogs = ref([])
const responseTimeData = ref([])

// Statistics
const avgResponseTime = computed(() => {
  if (!logsStore.logs.length) return 0
  const sum = logsStore.logs.reduce((acc, log) => acc + (log.response_time_ms || 0), 0)
  return Math.round(sum / logsStore.logs.length)
})

const uptimePercentage = computed(() => {
  if (!logsStore.logs.length) return 100
  const upCount = logsStore.logs.filter(log => log.status === 'up').length
  return (upCount / logsStore.logs.length) * 100
})

const todayChecks = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return logsStore.logs.filter(log => log.checked_at?.startsWith(today)).length
})

// Generate mock timeline data for demo
const timelineData = computed(() => {
  const data = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    data.push({
      date: date.toISOString().split('T')[0],
      status: Math.random() > 0.1 ? 'up' : 'down',
      uptime: 95 + Math.random() * 5,
      incidents: Math.random() > 0.9 ? Math.floor(Math.random() * 3) + 1 : 0
    })
  }
  return data
})

// Generate response time chart data
const chartData = computed(() => {
  const last24Hours = logsStore.logs
    .slice(0, 100)
    .reverse()
    .map((log, index) => ({
      time: new Date(log.checked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: log.response_time_ms || 0
    }))
  return last24Hours
})

let unsubscribe = null

onMounted(async () => {
  loading.value = true

  await Promise.all([
    websitesStore.fetchWebsites(),
    logsStore.fetchLogs()
  ])

  loading.value = false

  // Subscribe to real-time updates
  unsubscribe = sseService.on('log', (log) => {
    logsStore.addRealtimeLog(log)
    websitesStore.updateWebsiteStatus(log.websiteId, log.status)
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

function formatTime(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function getStatusClass(status) {
  return status === 'up' ? 'badge-success' : 'badge-danger'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Websites"
        :value="websitesStore.totalWebsites"
        icon="websites"
        color="primary"
        :loading="loading"
      />
      <StatCard
        title="Sites Up"
        :value="websitesStore.upWebsites"
        icon="up"
        color="success"
        :loading="loading"
      />
      <StatCard
        title="Sites Down"
        :value="websitesStore.downWebsites"
        icon="down"
        color="danger"
        :loading="loading"
      />
      <StatCard
        title="Avg Response"
        :value="`${avgResponseTime} ms`"
        icon="response"
        color="warning"
        :loading="loading"
      />
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Response Time Chart -->
      <div class="lg:col-span-2 card">
        <div class="card-header">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Response Time</h3>
        </div>
        <div class="card-body">
          <ResponseTimeChart :data="chartData" :height="300" />
        </div>
      </div>

      <!-- Uptime Overview -->
      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Overall Uptime</h3>
        </div>
        <div class="card-body flex flex-col items-center justify-center">
          <UptimeChart :uptime="uptimePercentage" :size="200" />
          <div class="mt-4 text-center">
            <p class="text-sm text-gray-500 dark:text-gray-400">Last 24 hours</p>
            <p class="text-lg font-semibold text-gray-900 dark:text-white">{{ todayChecks }} checks</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Timeline -->
    <div class="card">
      <div class="card-header">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">30-Day Status</h3>
      </div>
      <div class="card-body">
        <StatusTimeline :data="timelineData" :days="30" />
      </div>
    </div>

    <!-- Recent Activity & Websites Status -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Recent Activity -->
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
          <router-link to="/logs" class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
            View all
          </router-link>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700">
          <div v-if="loading" class="p-6">
            <LoadingSpinner />
          </div>
          <template v-else-if="logsStore.logs.length">
            <div
              v-for="log in logsStore.logs.slice(0, 8)"
              :key="log.id"
              class="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div class="flex items-center gap-3 min-w-0">
                <span :class="['status-dot', log.status === 'up' ? 'status-dot-up' : 'status-dot-down']"></span>
                <span class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                  {{ log.url || `Website #${log.website_id}` }}
                </span>
              </div>
              <div class="flex items-center gap-4 text-sm">
                <span class="text-gray-500 dark:text-gray-400">{{ log.response_time_ms || 0 }}ms</span>
                <span class="text-gray-400 dark:text-gray-500 text-xs">{{ formatTime(log.checked_at) }}</span>
              </div>
            </div>
          </template>
          <div v-else class="p-6 text-center text-gray-500 dark:text-gray-400">
            No recent activity
          </div>
        </div>
      </div>

      <!-- Websites Status -->
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Websites Status</h3>
          <router-link to="/websites" class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
            Manage
          </router-link>
        </div>
        <div class="divide-y divide-gray-200 dark:divide-gray-700">
          <div v-if="loading" class="p-6">
            <LoadingSpinner />
          </div>
          <template v-else-if="websitesStore.websites.length">
            <div
              v-for="website in websitesStore.websites.slice(0, 8)"
              :key="website.id"
              class="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div class="flex items-center gap-3 min-w-0">
                <span :class="['status-dot', website.lastStatus === 'down' ? 'status-dot-down' : 'status-dot-up']"></span>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                    {{ website.url }}
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">
                    Every {{ website.interval_seconds }}s
                  </p>
                </div>
              </div>
              <span :class="['badge', website.lastStatus === 'down' ? 'badge-danger' : 'badge-success']">
                {{ website.lastStatus || 'pending' }}
              </span>
            </div>
          </template>
          <div v-else class="p-6 text-center text-gray-500 dark:text-gray-400">
            No websites configured
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
