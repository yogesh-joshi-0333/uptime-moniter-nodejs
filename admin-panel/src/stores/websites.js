import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export const useWebsitesStore = defineStore('websites', () => {
  const websites = ref([])
  const loading = ref(false)
  const error = ref(null)

  const totalWebsites = computed(() => websites.value.length)
  const upWebsites = computed(() =>
    websites.value.filter(w => w.lastStatus === 'up').length
  )
  const downWebsites = computed(() =>
    websites.value.filter(w => w.lastStatus === 'down').length
  )

  async function fetchWebsites() {
    loading.value = true
    error.value = null
    try {
      const response = await api.get('/websites')
      websites.value = response.data
    } catch (err) {
      error.value = err.response?.data?.error || 'Failed to fetch websites'
    } finally {
      loading.value = false
    }
  }

  async function addWebsite(data) {
    try {
      const response = await api.post('/websites', data)
      websites.value.push(response.data)
      return { success: true, data: response.data }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to add website'
      }
    }
  }

  async function updateWebsite(id, data) {
    try {
      const response = await api.put(`/websites/${id}`, data)
      const index = websites.value.findIndex(w => w.id === id)
      if (index !== -1) {
        websites.value[index] = response.data
      }
      return { success: true, data: response.data }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to update website'
      }
    }
  }

  async function deleteWebsite(id) {
    try {
      await api.delete(`/websites/${id}`)
      websites.value = websites.value.filter(w => w.id !== id)
      return { success: true }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to delete website'
      }
    }
  }

  async function getWebsiteById(id) {
    try {
      const response = await api.get(`/websites/${id}`)
      return { success: true, data: response.data }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to fetch website'
      }
    }
  }

  async function getWebsiteStats(id) {
    try {
      const response = await api.get(`/websites/${id}/stats`)
      return { success: true, data: response.data }
    } catch (err) {
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to fetch website stats'
      }
    }
  }

  function updateWebsiteStatus(websiteId, status) {
    const website = websites.value.find(w => w.id === websiteId)
    if (website) {
      website.lastStatus = status
      website.lastChecked = new Date().toISOString()
    }
  }

  return {
    websites,
    loading,
    error,
    totalWebsites,
    upWebsites,
    downWebsites,
    fetchWebsites,
    addWebsite,
    updateWebsite,
    deleteWebsite,
    getWebsiteById,
    getWebsiteStats,
    updateWebsiteStatus
  }
})
