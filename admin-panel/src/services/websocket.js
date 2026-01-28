import { ref } from 'vue'

class EventSourceService {
  constructor() {
    this.eventSource = null
    this.listeners = new Map()
    this.isConnected = ref(false)
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000
  }

  connect(url = '/api/logs/stream') {
    if (this.eventSource) {
      this.disconnect()
    }

    try {
      this.eventSource = new EventSource(url)

      this.eventSource.onopen = () => {
        this.isConnected.value = true
        this.reconnectAttempts = 0
        console.log('SSE connected')
      }

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          this.emit('log', data)
        } catch (e) {
          console.error('Failed to parse SSE message:', e)
        }
      }

      this.eventSource.onerror = (error) => {
        console.error('SSE error:', error)
        this.isConnected.value = false
        this.eventSource.close()

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
          console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
          setTimeout(() => this.connect(url), delay)
        }
      }
    } catch (error) {
      console.error('Failed to create EventSource:', error)
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
      this.isConnected.value = false
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback)
    }
  }

  emit(event, data) {
    const eventListeners = this.listeners.get(event)
    if (eventListeners) {
      eventListeners.forEach(callback => callback(data))
    }
  }

  getConnectionState() {
    return this.isConnected
  }
}

export const sseService = new EventSourceService()
export default sseService
