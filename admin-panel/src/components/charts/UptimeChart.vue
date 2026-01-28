<script setup>
import { computed } from 'vue'
import { Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps({
  uptime: {
    type: Number,
    default: 100
  },
  size: {
    type: Number,
    default: 200
  }
})

const chartData = computed(() => ({
  labels: ['Uptime', 'Downtime'],
  datasets: [
    {
      data: [props.uptime, 100 - props.uptime],
      backgroundColor: ['#22c55e', '#ef4444'],
      borderWidth: 0,
      cutout: '75%'
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      callbacks: {
        label: (context) => `${context.label}: ${context.parsed.toFixed(2)}%`
      }
    }
  }
}
</script>

<template>
  <div class="relative" :style="{ width: `${size}px`, height: `${size}px` }">
    <Doughnut :data="chartData" :options="chartOptions" />
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <span class="text-3xl font-bold text-gray-900 dark:text-white">{{ uptime.toFixed(1) }}%</span>
      <span class="text-sm text-gray-500 dark:text-gray-400">Uptime</span>
    </div>
  </div>
</template>
