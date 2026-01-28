<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWebsitesStore } from '@/stores/websites'
import { useLogsStore } from '@/stores/logs'
import { useToastStore } from '@/stores/toast'
import sseService from '@/services/websocket'
import StatCard from '@/components/ui/StatCard.vue'
import ResponseTimeChart from '@/components/charts/ResponseTimeChart.vue'
import StatusTimeline from '@/components/charts/StatusTimeline.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const route = useRoute()
const router = useRouter()
const websitesStore = useWebsitesStore()
const logsStore = useLogsStore()
const toastStore = useToastStore()

const websiteId = computed(() => parseInt(route.params.id))
const website = ref(null)
const loading = ref(true)
const logs = ref([])

const uptimePercentage = computed(() => {
  if (!logs.value.length) return 100
  const upCount = logs.value.filter(log => log.status === 'up').length
  return ((upCount / logs.value.length) * 100).toFixed(2)
})

const avgResponseTime = computed(() => {
  if (!logs.value.length) return 0
  const sum = logs.value.reduce((acc, log) => acc + (log.response_time_ms || 0), 0)
  return Math.round(sum / logs.value.length)
})

const lastDowntime = computed(() => {
  const downLog = logs.value.find(log => log.status === 'down')
  return downLog ? new Date(downLog.checked_at).toLocaleString() : 'Never'
})

const chartData = computed(() => {
  return logs.value
    .slice(0, 100)
    .reverse()
    .map(log => ({
      time: new Date(log.checked_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      value: log.response_time_ms || 0
    }))
})

const timelineData = computed(() => {
  const data = []
  const today = new Date()

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    const dayLogs = logs.value.filter(log => log.checked_at?.startsWith(dateStr))
    const upCount = dayLogs.filter(log => log.status === 'up').length
    const uptime = dayLogs.length ? (upCount / dayLogs.length) * 100 : null

    data.push({
      date: dateStr,
      status: uptime === null ? 'unknown' : uptime >= 99 ? 'up' : 'down',
      uptime,
      incidents: dayLogs.filter(log => log.status === 'down').length
    })
  }

  return data
})

let unsubscribe = null

onMounted(async () => {
  loading.value = true

  // Fetch website details
  const result = await websitesStore.getWebsiteById(websiteId.value)
  if (result.success) {
    website.value = result.data
  } else {
    toastStore.error('Website not found')
    router.push('/websites')
    return
  }

  // Fetch logs for this website
  await logsStore.fetchLogs({ websiteId: websiteId.value })
  logs.value = logsStore.logs

  loading.value = false

  // Subscribe to real-time updates for this website
  unsubscribe = sseService.on('log', (log) => {
    if (log.websiteId === websiteId.value) {
      logs.value.unshift(log)
      if (logs.value.length > 1000) {
        logs.value = logs.value.slice(0, 1000)
      }
    }
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function goBack() {
  router.push('/websites')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <button @click="goBack" class="btn-icon">
        <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white truncate">
          {{ website?.name || website?.url || 'Loading...' }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ website?.url }}</p>
      </div>
      <div class="flex items-center gap-2">
        <span :class="['badge', website?.lastStatus === 'down' ? 'badge-danger' : 'badge-success']">
          {{ website?.lastStatus || 'pending' }}
        </span>
      </div>
    </div>

    <div v-if="loading" class="card p-12">
      <LoadingSpinner size="lg" />
    </div>

    <template v-else>
      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Uptime"
          :value="`${uptimePercentage}%`"
          icon="up"
          color="success"
        />
        <StatCard
          title="Avg Response"
          :value="`${avgResponseTime} ms`"
          icon="response"
          color="primary"
        />
        <StatCard
          title="Total Checks"
          :value="logs.length"
          icon="checks"
          color="warning"
        />
        <StatCard
          title="Check Interval"
          :value="`${website?.interval_seconds}s`"
          icon="websites"
          color="primary"
        />
      </div>

      <!-- Response Time Chart -->
      <div class="card">
        <div class="card-header">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Response Time History</h3>
        </div>
        <div class="card-body">
          <ResponseTimeChart :data="chartData" :height="300" />
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

      <!-- Website Info & Recent Logs -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Website Info -->
        <div class="card">
          <div class="card-header">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Details</h3>
          </div>
          <div class="card-body space-y-4">
            <div>
              <label class="text-sm text-gray-500 dark:text-gray-400">URL</label>
              <p class="text-gray-900 dark:text-white break-all">{{ website?.url }}</p>
            </div>
            <div>
              <label class="text-sm text-gray-500 dark:text-gray-400">Check Interval</label>
              <p class="text-gray-900 dark:text-white">Every {{ website?.interval_seconds }} seconds</p>
            </div>
            <div>
              <label class="text-sm text-gray-500 dark:text-gray-400">Created</label>
              <p class="text-gray-900 dark:text-white">{{ formatDate(website?.created_at) }}</p>
            </div>
            <div>
              <label class="text-sm text-gray-500 dark:text-gray-400">Last Downtime</label>
              <p class="text-gray-900 dark:text-white">{{ lastDowntime }}</p>
            </div>
          </div>
        </div>

        <!-- Recent Logs -->
        <div class="lg:col-span-2 card">
          <div class="card-header flex items-center justify-between">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Checks</h3>
            <router-link :to="`/logs?websiteId=${websiteId}`" class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400">
              View all
            </router-link>
          </div>
          <div class="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
            <div
              v-for="log in logs.slice(0, 20)"
              :key="log.id"
              class="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div class="flex items-center gap-3">
                <span :class="['status-dot', log.status === 'up' ? 'status-dot-up' : 'status-dot-down']"></span>
                <div>
                  <p class="text-sm text-gray-900 dark:text-white">
                    {{ log.status === 'up' ? 'Online' : 'Offline' }}
                    <span v-if="log.error_reason" class="text-danger-500"> - {{ log.error_reason }}</span>
                  </p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{{ formatDate(log.checked_at) }}</p>
                </div>
              </div>
              <span class="text-sm text-gray-700 dark:text-gray-300">{{ log.response_time_ms || 0 }} ms</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
