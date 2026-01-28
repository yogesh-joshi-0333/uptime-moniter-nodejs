import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token'))

  const isAuthenticated = computed(() => !!token.value)

  function checkAuth() {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken) {
      token.value = storedToken
      api.setAuthToken(storedToken)
    }

    if (storedUser) {
      try {
        user.value = JSON.parse(storedUser)
      } catch (e) {
        user.value = null
      }
    }
  }

  async function login(credentials) {
    try {
      const response = await api.post('/auth/login', credentials)
      const { token: authToken, user: userData } = response.data

      token.value = authToken
      user.value = userData

      localStorage.setItem('token', authToken)
      localStorage.setItem('user', JSON.stringify(userData))
      api.setAuthToken(authToken)

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      }
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    api.setAuthToken(null)
  }

  async function updateProfile(data) {
    try {
      const response = await api.put('/auth/profile', data)
      user.value = response.data.user
      localStorage.setItem('user', JSON.stringify(response.data.user))
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Update failed'
      }
    }
  }

  async function changePassword(data) {
    try {
      await api.put('/auth/password', data)
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Password change failed'
      }
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    checkAuth,
    login,
    logout,
    updateProfile,
    changePassword
  }
})
