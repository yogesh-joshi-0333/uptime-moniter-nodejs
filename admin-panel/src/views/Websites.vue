<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWebsitesStore } from '@/stores/websites'
import { useToastStore } from '@/stores/toast'
import Modal from '@/components/ui/Modal.vue'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import LoadingSpinner from '@/components/ui/LoadingSpinner.vue'

const router = useRouter()
const websitesStore = useWebsitesStore()
const toastStore = useToastStore()

const loading = ref(true)
const searchQuery = ref('')
const statusFilter = ref('all')

// Modal states
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteDialog = ref(false)
const formLoading = ref(false)

// Form data
const formData = ref({
  url: '',
  interval_seconds: 60,
  name: '',
  notification_email: ''
})

const editingWebsite = ref(null)
const deletingWebsite = ref(null)

// Filtered websites
const filteredWebsites = computed(() => {
  let result = websitesStore.websites

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(w =>
      w.url.toLowerCase().includes(query) ||
      w.name?.toLowerCase().includes(query)
    )
  }

  if (statusFilter.value !== 'all') {
    result = result.filter(w => w.lastStatus === statusFilter.value)
  }

  return result
})

onMounted(async () => {
  loading.value = true
  await websitesStore.fetchWebsites()
  loading.value = false
})

function openAddModal() {
  formData.value = {
    url: '',
    interval_seconds: 60,
    name: '',
    notification_email: ''
  }
  showAddModal.value = true
}

function openEditModal(website) {
  editingWebsite.value = website
  formData.value = {
    url: website.url,
    interval_seconds: website.interval_seconds,
    name: website.name || '',
    notification_email: website.notification_email || ''
  }
  showEditModal.value = true
}

function openDeleteDialog(website) {
  deletingWebsite.value = website
  showDeleteDialog.value = true
}

async function handleAdd() {
  if (!formData.value.url) {
    toastStore.error('URL is required')
    return
  }

  formLoading.value = true
  const result = await websitesStore.addWebsite(formData.value)
  formLoading.value = false

  if (result.success) {
    toastStore.success('Website added successfully')
    showAddModal.value = false
  } else {
    toastStore.error(result.error)
  }
}

async function handleEdit() {
  if (!formData.value.url) {
    toastStore.error('URL is required')
    return
  }

  formLoading.value = true
  const result = await websitesStore.updateWebsite(editingWebsite.value.id, formData.value)
  formLoading.value = false

  if (result.success) {
    toastStore.success('Website updated successfully')
    showEditModal.value = false
    editingWebsite.value = null
  } else {
    toastStore.error(result.error)
  }
}

async function handleDelete() {
  formLoading.value = true
  const result = await websitesStore.deleteWebsite(deletingWebsite.value.id)
  formLoading.value = false

  if (result.success) {
    toastStore.success('Website deleted successfully')
    showDeleteDialog.value = false
    deletingWebsite.value = null
  } else {
    toastStore.error(result.error)
  }
}

function viewDetails(website) {
  router.push(`/websites/${website.id}`)
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Websites</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage your monitored websites
        </p>
      </div>
      <button @click="openAddModal" class="btn-primary">
        <svg class="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Website
      </button>
    </div>

    <!-- Filters -->
    <div class="card p-4">
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="flex-1">
          <div class="relative">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search websites..."
              class="input pl-10"
            />
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        <select v-model="statusFilter" class="select w-full sm:w-48">
          <option value="all">All Status</option>
          <option value="up">Up</option>
          <option value="down">Down</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="card p-12">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="!websitesStore.websites.length"
      title="No websites yet"
      description="Add your first website to start monitoring its uptime."
      action-label="Add Website"
      @action="openAddModal"
    />

    <!-- No Results -->
    <EmptyState
      v-else-if="!filteredWebsites.length"
      title="No websites found"
      description="Try adjusting your search or filters."
      icon="search"
    />

    <!-- Websites Table -->
    <div v-else class="card overflow-hidden">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Website</th>
              <th>Status</th>
              <th>Interval</th>
              <th>Last Check</th>
              <th>Response Time</th>
              <th class="text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            <tr
              v-for="website in filteredWebsites"
              :key="website.id"
              class="cursor-pointer"
              @click="viewDetails(website)"
            >
              <td>
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                    <svg class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                  </div>
                  <div>
                    <p class="font-medium text-gray-900 dark:text-white">{{ website.name || website.url }}</p>
                    <p class="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">{{ website.url }}</p>
                  </div>
                </div>
              </td>
              <td>
                <span :class="['badge', website.lastStatus === 'down' ? 'badge-danger' : website.lastStatus === 'up' ? 'badge-success' : 'badge-warning']">
                  {{ website.lastStatus || 'pending' }}
                </span>
              </td>
              <td>
                <span class="text-gray-700 dark:text-gray-300">{{ website.interval_seconds }}s</span>
              </td>
              <td>
                <span class="text-gray-500 dark:text-gray-400 text-sm">{{ formatDate(website.lastChecked) }}</span>
              </td>
              <td>
                <span class="text-gray-700 dark:text-gray-300">{{ website.lastResponseTime || '-' }} ms</span>
              </td>
              <td class="text-right" @click.stop>
                <div class="flex items-center justify-end gap-2">
                  <button
                    @click="openEditModal(website)"
                    class="btn-icon text-gray-500 hover:text-primary-600"
                    title="Edit"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    @click="openDeleteDialog(website)"
                    class="btn-icon text-gray-500 hover:text-danger-600"
                    title="Delete"
                  >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Modal -->
    <Modal :show="showAddModal" title="Add Website" @close="showAddModal = false">
      <form @submit.prevent="handleAdd" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            URL <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="formData.url"
            type="url"
            class="input"
            placeholder="https://example.com"
            required
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name (optional)
          </label>
          <input
            v-model="formData.name"
            type="text"
            class="input"
            placeholder="My Website"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Check Interval
          </label>
          <select v-model="formData.interval_seconds" class="select">
            <option :value="30">Every 30 seconds</option>
            <option :value="60">Every 1 minute</option>
            <option :value="300">Every 5 minutes</option>
            <option :value="600">Every 10 minutes</option>
            <option :value="1800">Every 30 minutes</option>
            <option :value="3600">Every 1 hour</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notification Email (optional)
          </label>
          <input
            v-model="formData.notification_email"
            type="email"
            class="input"
            placeholder="alerts@example.com"
          />
        </div>
      </form>

      <template #footer>
        <button @click="showAddModal = false" class="btn-secondary">Cancel</button>
        <button @click="handleAdd" :disabled="formLoading" class="btn-primary">
          <svg v-if="formLoading" class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Add Website
        </button>
      </template>
    </Modal>

    <!-- Edit Modal -->
    <Modal :show="showEditModal" title="Edit Website" @close="showEditModal = false">
      <form @submit.prevent="handleEdit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            URL <span class="text-danger-500">*</span>
          </label>
          <input
            v-model="formData.url"
            type="url"
            class="input"
            placeholder="https://example.com"
            required
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name (optional)
          </label>
          <input
            v-model="formData.name"
            type="text"
            class="input"
            placeholder="My Website"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Check Interval
          </label>
          <select v-model="formData.interval_seconds" class="select">
            <option :value="30">Every 30 seconds</option>
            <option :value="60">Every 1 minute</option>
            <option :value="300">Every 5 minutes</option>
            <option :value="600">Every 10 minutes</option>
            <option :value="1800">Every 30 minutes</option>
            <option :value="3600">Every 1 hour</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notification Email (optional)
          </label>
          <input
            v-model="formData.notification_email"
            type="email"
            class="input"
            placeholder="alerts@example.com"
          />
        </div>
      </form>

      <template #footer>
        <button @click="showEditModal = false" class="btn-secondary">Cancel</button>
        <button @click="handleEdit" :disabled="formLoading" class="btn-primary">
          <svg v-if="formLoading" class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Save Changes
        </button>
      </template>
    </Modal>

    <!-- Delete Confirmation -->
    <ConfirmDialog
      :show="showDeleteDialog"
      title="Delete Website"
      :message="`Are you sure you want to delete '${deletingWebsite?.url}'? This action cannot be undone and all monitoring data will be lost.`"
      confirm-text="Delete"
      :loading="formLoading"
      @confirm="handleDelete"
      @cancel="showDeleteDialog = false"
    />
  </div>
</template>
