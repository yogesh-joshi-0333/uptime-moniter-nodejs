<script setup>
defineProps({
  title: String,
  value: [String, Number],
  subtitle: String,
  icon: String,
  trend: Number,
  color: {
    type: String,
    default: 'primary'
  },
  loading: Boolean
})

const colorClasses = {
  primary: 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
  success: 'bg-success-50 dark:bg-success-500/20 text-success-600 dark:text-success-400',
  danger: 'bg-danger-50 dark:bg-danger-500/20 text-danger-600 dark:text-danger-400',
  warning: 'bg-warning-50 dark:bg-warning-500/20 text-warning-600 dark:text-warning-400'
}
</script>

<template>
  <div class="card p-6">
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ title }}</p>
        <div v-if="loading" class="mt-2">
          <div class="skeleton h-8 w-20"></div>
        </div>
        <p v-else class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{{ value }}</p>
        <div v-if="subtitle || trend !== undefined" class="mt-2 flex items-center gap-2">
          <span v-if="trend !== undefined" :class="[
            'text-sm font-medium flex items-center gap-1',
            trend >= 0 ? 'text-success-600' : 'text-danger-600'
          ]">
            <svg v-if="trend >= 0" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            {{ Math.abs(trend) }}%
          </span>
          <span v-if="subtitle" class="text-sm text-gray-500 dark:text-gray-400">{{ subtitle }}</span>
        </div>
      </div>
      <div :class="['p-3 rounded-xl', colorClasses[color]]">
        <slot name="icon">
          <svg v-if="icon === 'websites'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <svg v-else-if="icon === 'up'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else-if="icon === 'down'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else-if="icon === 'response'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <svg v-else-if="icon === 'checks'" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </slot>
      </div>
    </div>
  </div>
</template>
