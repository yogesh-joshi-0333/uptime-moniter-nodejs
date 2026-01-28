<script setup>
import { computed } from 'vue'

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  days: {
    type: Number,
    default: 30
  }
})

// Generate timeline data for the last N days
const timelineData = computed(() => {
  const result = []
  const today = new Date()

  for (let i = props.days - 1; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]

    // Find data for this date
    const dayData = props.data.find(d => d.date === dateStr)

    result.push({
      date: dateStr,
      status: dayData?.status || 'unknown',
      uptime: dayData?.uptime || null,
      incidents: dayData?.incidents || 0
    })
  }

  return result
})

function getStatusColor(status, uptime) {
  if (status === 'unknown') return 'bg-gray-200 dark:bg-gray-700'
  if (uptime === null) return 'bg-gray-200 dark:bg-gray-700'
  if (uptime >= 99.9) return 'bg-success-500'
  if (uptime >= 99) return 'bg-success-400'
  if (uptime >= 95) return 'bg-warning-500'
  return 'bg-danger-500'
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div>
    <div class="flex gap-0.5">
      <div
        v-for="(day, index) in timelineData"
        :key="day.date"
        class="group relative flex-1"
      >
        <div
          :class="['h-8 rounded-sm transition-transform hover:scale-110 cursor-pointer', getStatusColor(day.status, day.uptime)]"
          :title="`${formatDate(day.date)}: ${day.uptime !== null ? day.uptime.toFixed(2) + '%' : 'No data'}`"
        ></div>

        <!-- Tooltip -->
        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-10">
          <div class="font-medium">{{ formatDate(day.date) }}</div>
          <div v-if="day.uptime !== null">Uptime: {{ day.uptime.toFixed(2) }}%</div>
          <div v-else>No data</div>
          <div v-if="day.incidents > 0" class="text-danger-400">{{ day.incidents }} incident(s)</div>
          <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center justify-between mt-3 text-xs text-gray-500 dark:text-gray-400">
      <span>{{ days }} days ago</span>
      <div class="flex items-center gap-4">
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-sm bg-success-500"></span> 99.9%+
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-sm bg-warning-500"></span> 95-99%
        </span>
        <span class="flex items-center gap-1">
          <span class="w-3 h-3 rounded-sm bg-danger-500"></span> &lt;95%
        </span>
      </div>
      <span>Today</span>
    </div>
  </div>
</template>
