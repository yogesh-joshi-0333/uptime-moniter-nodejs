<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useLogsStore } from '@/stores/logs'
import { useWebsitesStore } from '@/stores/websites'
import sseService from '@/services/websocket'
import api from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const route = useRoute()
const websitesStore = useWebsitesStore()

// State
const loading = ref(true)
const logs = ref([])
const totalRecords = ref(0)
const currentPage = ref(1)
const perPage = ref(50)
const totalPages = computed(() => Math.ceil(totalRecords.value / perPage.value))

const filters = ref({
  websiteId: route.query.websiteId || '',
  status: '',
  from: '',
  to: ''
})

const liveMode = ref(false)
const liveLogs = ref([])

const perPageOptions = [10, 25, 50, 100, 200, 300, 500]

// Fetch logs with pagination
async function fetchLogs() {
  loading.value = true

  try {
    const params = new URLSearchParams()
    params.append('page', currentPage.value)
    params.append('limit', perPage.value)

    if (filters.value.websiteId) params.append('websiteId', filters.value.websiteId)
    if (filters.value.status) params.append('status', filters.value.status)
    if (filters.value.from) params.append('from', filters.value.from)
    if (filters.value.to) params.append('to', filters.value.to)

    const response = await api.get(`/logs?${params.toString()}`)
    logs.value = response.data

    // Get total count for pagination
    const countParams = new URLSearchParams()
    if (filters.value.websiteId) countParams.append('websiteId', filters.value.websiteId)
    if (filters.value.status) countParams.append('status', filters.value.status)
    if (filters.value.from) countParams.append('from', filters.value.from)
    if (filters.value.to) countParams.append('to', filters.value.to)

    const countResponse = await api.get(`/logs/count?${countParams.toString()}`)
    totalRecords.value = countResponse.data.count || logs.value.length

  } catch (err) {
    console.error('Failed to fetch logs:', err)
    // Fallback: estimate total from current page
    totalRecords.value = logs.value.length
  } finally {
    loading.value = false
  }
}

let unsubscribe = null

onMounted(async () => {
  await websitesStore.fetchWebsites()
  await fetchLogs()

  // Subscribe to real-time logs
  unsubscribe = sseService.on('log', (log) => {
    if (liveMode.value) {
      liveLogs.value.unshift(log)
      if (liveLogs.value.length > 500) {
        liveLogs.value = liveLogs.value.slice(0, 500)
      }
    }
  })
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})

// Watch for filter/pagination changes
watch([filters, currentPage, perPage], () => {
  if (!liveMode.value) {
    fetchLogs()
  }
}, { deep: true })

watch(perPage, () => {
  currentPage.value = 1 // Reset to first page when changing per page
})

function toggleLiveMode() {
  liveMode.value = !liveMode.value
  if (liveMode.value) {
    liveLogs.value = []
  } else {
    fetchLogs()
  }
}

function clearFilters() {
  filters.value = {
    websiteId: '',
    status: '',
    from: '',
    to: ''
  }
  currentPage.value = 1
  liveMode.value = false
  liveLogs.value = []
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

function getWebsiteUrl(websiteId) {
  const website = websitesStore.websites.find(w => w.id === websiteId)
  return website?.url || `Website #${websiteId}`
}

function exportLogs() {
  const dataToExport = liveMode.value ? liveLogs.value : logs.value
  const csv = [
    ['Timestamp', 'Website', 'Status', 'Response Time (ms)', 'Error'].join(','),
    ...dataToExport.map(log => [
      log.checked_at,
      `"${log.url || getWebsiteUrl(log.website_id)}"`,
      log.status,
      log.response_time_ms || 0,
      `"${log.error_reason || ''}"`
    ].join(','))
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `uptime-logs-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Computed display logs
const displayLogs = computed(() => {
  if (liveMode.value && liveLogs.value.length) {
    return liveLogs.value
  }
  return logs.value
})

// Pagination range
const paginationRange = computed(() => {
  const range = []
  const delta = 2
  const left = currentPage.value - delta
  const right = currentPage.value + delta + 1

  let l
  for (let i = 1; i <= totalPages.value; i++) {
    if (i === 1 || i === totalPages.value || (i >= left && i < right)) {
      if (l) {
        if (i - l === 2) {
          range.push(l + 1)
        } else if (i - l !== 1) {
          range.push('...')
        }
      }
      range.push(i)
      l = i
    }
  }

  return range
})

// Record range display
const recordRange = computed(() => {
  const start = (currentPage.value - 1) * perPage.value + 1
  const end = Math.min(currentPage.value * perPage.value, totalRecords.value)
  return { start, end }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Logs</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View and filter uptime check logs
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="toggleLiveMode"
          :class="['btn', liveMode ? 'btn-success' : 'btn-secondary']"
        >
          <span :class="['w-2 h-2 rounded-full mr-2', liveMode ? 'bg-white animate-pulse' : 'bg-gray-400']"></span>
          {{ liveMode ? 'Live' : 'Paused' }}
        </button>
        <button @click="exportLogs" class="btn-secondary">
          <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="card p-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Website</label>
          <select v-model="filters.websiteId" class="select">
            <option value="">All Websites</option>
            <option v-for="website in websitesStore.websites" :key="website.id" :value="website.id">
              {{ website.name || website.url }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
          <select v-model="filters.status" class="select">
            <option value="">All Status</option>
            <option value="up">Up</option>
            <option value="down">Down</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From</label>
          <input v-model="filters.from" type="datetime-local" class="input" />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
          <input v-model="filters.to" type="datetime-local" class="input" />
        </div>

        <div class="flex items-end">
          <button @click="clearFilters" class="btn-secondary w-full">
            Clear Filters
          </button>
        </div>
      </div>
    </div>

    <!-- Live indicator -->
    <div v-if="liveMode" class="flex items-center gap-2 text-sm text-success-600 dark:text-success-400">
      <span class="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span>
      Showing live logs. New entries will appear automatically. ({{ liveLogs.length }} new logs)
    </div>

    <!-- Per Page & Info Bar -->
    <div v-if="!liveMode" class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-600 dark:text-gray-400">Show</span>
        <select v-model="perPage" class="select w-24">
          <option v-for="opt in perPageOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
        <span class="text-sm text-gray-600 dark:text-gray-400">entries</span>
      </div>
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Showing {{ recordRange.start }} to {{ recordRange.end }} of {{ totalRecords }} entries
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="card p-12">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="!displayLogs.length"
      title="No logs found"
      description="No logs match your current filters. Try adjusting your search criteria."
      icon="empty"
    />

    <!-- Logs Table -->
    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Website</th>
              <th>Status</th>
              <th>Response Time</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="log in displayLogs"
              :key="log.id || `${log.website_id}-${log.checked_at}`"
              :class="log.status === 'down' ? 'bg-danger-50/50 dark:bg-danger-900/20' : ''"
            >
              <td class="font-mono text-sm">
                {{ formatDate(log.checked_at) }}
              </td>
              <td>
                <router-link
                  :to="`/websites/${log.website_id}`"
                  class="text-primary-600 hover:text-primary-700 dark:text-primary-400 hover:underline"
                >
                  {{ log.url || getWebsiteUrl(log.website_id) }}
                </router-link>
              </td>
              <td>
                <span :class="['badge', log.status === 'up' ? 'badge-success' : 'badge-danger']">
                  {{ log.status }}
                </span>
              </td>
              <td class="text-gray-700 dark:text-gray-300">
                {{ log.response_time_ms || log.responseTime || 0 }} ms
              </td>
              <td class="text-gray-500 dark:text-gray-400 max-w-xs truncate" :title="log.error_reason || log.errorReason">
                {{ log.error_reason || log.errorReason || '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="!liveMode && totalPages > 1" class="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
          <!-- Mobile: Simple prev/next -->
          <div class="flex sm:hidden items-center gap-2 w-full justify-between">
            <button
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage === 1"
              class="btn-secondary"
            >
              Previous
            </button>
            <span class="text-sm text-gray-600 dark:text-gray-400">
              Page {{ currentPage }} of {{ totalPages }}
            </span>
            <button
              @click="goToPage(currentPage + 1)"
              :disabled="currentPage === totalPages"
              class="btn-secondary"
            >
              Next
            </button>
          </div>

          <!-- Desktop: Full pagination -->
          <div class="hidden sm:flex items-center gap-1">
            <!-- First & Previous -->
            <button
              @click="goToPage(1)"
              :disabled="currentPage === 1"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="First page"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
            <button
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage === 1"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <!-- Page Numbers -->
            <template v-for="page in paginationRange" :key="page">
              <span v-if="page === '...'" class="px-3 py-2 text-gray-400">...</span>
              <button
                v-else
                @click="goToPage(page)"
                :class="[
                  'min-w-[40px] h-10 rounded-lg font-medium transition-colors',
                  currentPage === page
                    ? 'bg-primary-600 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                ]"
              >
                {{ page }}
              </button>
            </template>

            <!-- Next & Last -->
            <button
              @click="goToPage(currentPage + 1)"
              :disabled="currentPage === totalPages"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next page"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              @click="goToPage(totalPages)"
              :disabled="currentPage === totalPages"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Last page"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Jump to page -->
          <div class="hidden lg:flex items-center gap-2">
            <span class="text-sm text-gray-600 dark:text-gray-400">Go to page:</span>
            <input
              type="number"
              :min="1"
              :max="totalPages"
              :value="currentPage"
              @change="goToPage(parseInt($event.target.value))"
              class="input w-20 text-center"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
