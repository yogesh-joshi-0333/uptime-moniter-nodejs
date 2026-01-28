<script setup>
import Modal from './Modal.vue'

const props = defineProps({
  show: Boolean,
  title: {
    type: String,
    default: 'Confirm Action'
  },
  message: String,
  confirmText: {
    type: String,
    default: 'Confirm'
  },
  cancelText: {
    type: String,
    default: 'Cancel'
  },
  variant: {
    type: String,
    default: 'danger',
    validator: (v) => ['danger', 'warning', 'primary'].includes(v)
  },
  loading: Boolean
})

const emit = defineEmits(['confirm', 'cancel'])

const variantClasses = {
  danger: 'btn-danger',
  warning: 'bg-warning-500 text-white hover:bg-warning-600',
  primary: 'btn-primary'
}
</script>

<template>
  <Modal :show="show" :title="title" size="sm" @close="emit('cancel')">
    <div class="text-center sm:text-left">
      <div class="mx-auto sm:mx-0 flex items-center justify-center h-12 w-12 rounded-full mb-4"
        :class="variant === 'danger' ? 'bg-danger-50 dark:bg-danger-500/20' : variant === 'warning' ? 'bg-warning-50 dark:bg-warning-500/20' : 'bg-primary-50 dark:bg-primary-500/20'"
      >
        <svg v-if="variant === 'danger'" class="h-6 w-6 text-danger-600 dark:text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <svg v-else-if="variant === 'warning'" class="h-6 w-6 text-warning-600 dark:text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <svg v-else class="h-6 w-6 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-gray-600 dark:text-gray-300">{{ message }}</p>
    </div>

    <template #footer>
      <button
        @click="emit('cancel')"
        class="btn-secondary"
        :disabled="loading"
      >
        {{ cancelText }}
      </button>
      <button
        @click="emit('confirm')"
        :class="['btn', variantClasses[variant]]"
        :disabled="loading"
      >
        <svg v-if="loading" class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ confirmText }}
      </button>
    </template>
  </Modal>
</template>
