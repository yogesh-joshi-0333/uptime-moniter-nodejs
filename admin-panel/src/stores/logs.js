import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'

export const useLogsStore = defineStore('logs', () => {
  const logs = ref([])
  const loading = ref(false)
  const error = ref(null)
  const hasMore = ref(true)
  const currentPage = ref(1)
  const pageSize = ref(50)

  async function fetchLogs(filters = {}, append = false) {
    loading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()

      if (filters.websiteId) params.append('websiteId', filters.websiteId)
      if (filters.from) params.append('from', filters.from)
      if (filters.to) params.append('to', filters.to)
      if (filters.status) params.append('status', filters.status)
      params.append('page', append ? currentPage.value : 1)
      params.append('limit', pageSize.value)

      const response = await api.get(`/logs?${params.toString()}`)

      if (append) {
        logs.value = [...logs.value, ...response.data]
      } else {
        logs.value = response.data
        currentPage.value = 1
      }

      hasMore.value = response.data.length === pageSize.value
      if (append) currentPage.value++

      return { success: true }
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch logs'
      return { success: false, error: error.value }
    } finally {
      loading.value = false
    }
  }

  function addRealtimeLog(log) {
    logs.value.unshift(log)
    // Keep only last 1000 logs in memory
    if (logs.value.length > 1000) {
      logs.value = logs.value.slice(0, 1000)
    }
  }

  function clearLogs() {
    logs.value = []
    currentPage.value = 1
    hasMore.value = true
  }

  return {
    logs,
    loading,
    error,
    hasMore,
    currentPage,
    pageSize,
    fetchLogs,
    addRealtimeLog,
    clearLogs
  }
})
