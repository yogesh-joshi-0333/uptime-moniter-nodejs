<script setup>
import { ref, computed, onMounted } from 'vue'
import { useLogsStore } from '@/stores/logs'
import { useWebsitesStore } from '@/stores/websites'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const logsStore = useLogsStore()
const websitesStore = useWebsitesStore()

const loading = ref(true)
const timeRange = ref('24h')

// Group downtime incidents
const incidents = computed(() => {
  const downLogs = logsStore.logs.filter(log => log.status === 'down')

  // Group consecutive down logs into incidents
  const grouped = []
  let currentIncident = null

  for (const log of downLogs) {
    if (!currentIncident ||
        currentIncident.websiteId !== log.website_id ||
        new Date(currentIncident.endTime) - new Date(log.checked_at) > 5 * 60 * 1000) {
      // Start new incident
      if (currentIncident) {
        grouped.push(currentIncident)
      }
      currentIncident = {
        id: log.id,
        websiteId: log.website_id,
        url: log.url || getWebsiteUrl(log.website_id),
        startTime: log.checked_at,
        endTime: log.checked_at,
        errors: [log.error_reason],
        count: 1
      }
    } else {
      // Extend current incident
      currentIncident.endTime = log.checked_at
      currentIncident.errors.push(log.error_reason)
      currentIncident.count++
    }
  }

  if (currentIncident) {
    grouped.push(currentIncident)
  }

  return grouped
})

const activeIncidents = computed(() =>
  incidents.value.filter(i => {
    const timeDiff = Date.now() - new Date(i.endTime).getTime()
    return timeDiff < 5 * 60 * 1000 // Active if within last 5 minutes
  })
)

const resolvedIncidents = computed(() =>
  incidents.value.filter(i => {
    const timeDiff = Date.now() - new Date(i.endTime).getTime()
    return timeDiff >= 5 * 60 * 1000
  })
)

onMounted(async () => {
  loading.value = true
  await Promise.all([
    websitesStore.fetchWebsites(),
    logsStore.fetchLogs({ status: 'down' })
  ])
  loading.value = false
})

function getWebsiteUrl(websiteId) {
  const website = websitesStore.websites.find(w => w.id === websiteId)
  return website?.url || `Website #${websiteId}`
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function getDuration(start, end) {
  const diff = new Date(end) - new Date(start)
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

function getMostCommonError(errors) {
  const counts = {}
  for (const error of errors) {
    if (error) {
      counts[error] = (counts[error] || 0) + 1
    }
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] || 'Unknown error'
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Incidents</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Track and manage downtime incidents
        </p>
      </div>
      <select v-model="timeRange" class="select w-48">
        <option value="1h">Last hour</option>
        <option value="24h">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
      </select>
    </div>

    <!-- Active Incidents -->
    <div v-if="activeIncidents.length" class="card border-danger-500 dark:border-danger-400">
      <div class="card-header bg-danger-50 dark:bg-danger-900/30">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-danger-500 animate-pulse"></span>
          <h3 class="text-lg font-semibold text-danger-700 dark:text-danger-400">
            Active Incidents ({{ activeIncidents.length }})
          </h3>
        </div>
      </div>
      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="incident in activeIncidents"
          :key="incident.id"
          class="p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <router-link
                :to="`/websites/${incident.websiteId}`"
                class="text-lg font-medium text-gray-900 dark:text-white hover:text-primary-600"
              >
                {{ incident.url }}
              </router-link>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Started {{ formatDate(incident.startTime) }}
              </p>
              <p class="text-sm text-danger-600 dark:text-danger-400 mt-2">
                {{ getMostCommonError(incident.errors) }}
              </p>
            </div>
            <div class="text-right">
              <span class="badge badge-danger">Ongoing</span>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Duration: {{ getDuration(incident.startTime, new Date()) }}
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {{ incident.count }} failed checks
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="card p-12">
      <LoadingSpinner size="lg" />
    </div>

    <!-- All Clear -->
    <div v-else-if="!incidents.length" class="card p-8 text-center">
      <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-success-50 dark:bg-success-500/20 flex items-center justify-center">
        <svg class="w-8 h-8 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white">All Systems Operational</h3>
      <p class="text-gray-500 dark:text-gray-400 mt-1">No incidents in the selected time period.</p>
    </div>

    <!-- Resolved Incidents -->
    <div v-else class="card">
      <div class="card-header">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
          Past Incidents ({{ resolvedIncidents.length }})
        </h3>
      </div>

      <EmptyState
        v-if="!resolvedIncidents.length"
        title="No past incidents"
        description="All incidents are currently active or no incidents occurred in this period."
        icon="empty"
      />

      <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
        <div
          v-for="incident in resolvedIncidents"
          :key="incident.id"
          class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <router-link
                :to="`/websites/${incident.websiteId}`"
                class="font-medium text-gray-900 dark:text-white hover:text-primary-600"
              >
                {{ incident.url }}
              </router-link>
              <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                <span>{{ formatDate(incident.startTime) }}</span>
                <span>→</span>
                <span>{{ formatDate(incident.endTime) }}</span>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">
                {{ getMostCommonError(incident.errors) }}
              </p>
            </div>
            <div class="text-right">
              <span class="badge badge-success">Resolved</span>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Duration: {{ getDuration(incident.startTime, incident.endTime) }}
              </p>
              <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {{ incident.count }} failed checks
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="card p-4 text-center">
        <p class="text-3xl font-bold text-gray-900 dark:text-white">{{ incidents.length }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">Total Incidents</p>
      </div>
      <div class="card p-4 text-center">
        <p class="text-3xl font-bold text-danger-600">{{ activeIncidents.length }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">Active</p>
      </div>
      <div class="card p-4 text-center">
        <p class="text-3xl font-bold text-success-600">{{ resolvedIncidents.length }}</p>
        <p class="text-sm text-gray-500 dark:text-gray-400">Resolved</p>
      </div>
    </div>
  </div>
</template>
