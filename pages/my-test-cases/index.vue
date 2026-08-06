<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTestCasesApi } from '@/composables/useTestCasesApi'
import { useNuxtApp } from '#app'

interface MyCase {
  id: number
  case_id: string
  title: string
  module_name: string
  module_code: string | null
  suite_slug: string | null
  suite_role: string | null
  approval_status: 'pending' | 'approved' | 'rejected'
  approval_note: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string | null
}

const api = useTestCasesApi()
const router = useRouter()
const { $showToast } = useNuxtApp()

const items = ref<MyCase[]>([])
const counts = ref({ pending: 0, approved: 0, rejected: 0, total: 0 })
const loading = ref(false)
const filter = ref<'all' | 'pending' | 'approved' | 'rejected'>('all')

async function load() {
  loading.value = true
  try {
    const res = await api.myCases(filter.value === 'all' ? undefined : filter.value)
    items.value = res.data
    counts.value = res.meta
  } catch (e: any) {
    $showToast(e?.response?.data?.message || 'Failed to load your test cases.')
  } finally {
    loading.value = false
  }
}

function setFilter(f: typeof filter.value) {
  filter.value = f
  load()
}

const STATUS = {
  pending: { color: 'warning', icon: 'mdi-clock-outline', label: 'Pending approval' },
  approved: { color: 'success', icon: 'mdi-check-circle', label: 'Approved' },
  rejected: { color: 'error', icon: 'mdi-close-circle', label: 'Rejected' },
} as const

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

const headers = [
  { title: 'Case ID', key: 'case_id', sortable: false },
  { title: 'Title', key: 'title', sortable: false },
  { title: 'Module', key: 'module_name', sortable: false },
  { title: 'Suite', key: 'suite_role', sortable: false },
  { title: 'Status', key: 'approval_status', sortable: false },
  { title: 'Reviewed', key: 'approved_at', sortable: false },
]

onMounted(load)
</script>

<template>
  <div>
    <div class="mb-4">
      <h2 class="text-h4 font-weight-semibold">My Test Cases</h2>
      <p class="textSecondary mb-0">Test cases you created and where they are in the approval process.</p>
    </div>

    <!-- Status filter chips -->
    <div class="d-flex flex-wrap ga-2 mb-4">
      <v-chip :color="filter === 'all' ? 'primary' : undefined" :variant="filter === 'all' ? 'flat' : 'tonal'"
        label @click="setFilter('all')">All ({{ counts.total }})</v-chip>
      <v-chip :color="filter === 'pending' ? 'warning' : undefined" :variant="filter === 'pending' ? 'flat' : 'tonal'"
        label @click="setFilter('pending')">Pending ({{ counts.pending }})</v-chip>
      <v-chip :color="filter === 'approved' ? 'success' : undefined" :variant="filter === 'approved' ? 'flat' : 'tonal'"
        label @click="setFilter('approved')">Approved ({{ counts.approved }})</v-chip>
      <v-chip :color="filter === 'rejected' ? 'error' : undefined" :variant="filter === 'rejected' ? 'flat' : 'tonal'"
        label @click="setFilter('rejected')">Rejected ({{ counts.rejected }})</v-chip>
      <v-spacer />
      <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" to="/test-cases/new">New Test Case</v-btn>
    </div>

    <v-card rounded="lg" elevation="10">
      <v-data-table :headers="headers" :items="items" :loading="loading" density="comfortable">
        <template #item.case_id="{ item }"><span class="font-weight-medium">{{ item.case_id }}</span></template>
        <template #item.module_name="{ item }">
          {{ item.module_name }}<span v-if="item.module_code" class="textSecondary text-caption"> ({{ item.module_code }})</span>
        </template>
        <template #item.suite_role="{ item }">
          <a v-if="item.suite_slug && item.approval_status === 'approved'" class="text-primary text-decoration-none" href="#"
            @click.prevent="router.push(`/test-cases/${item.suite_slug}`)">{{ item.suite_role }}</a>
          <span v-else>{{ item.suite_role || '—' }}</span>
        </template>
        <template #item.approval_status="{ item }">
          <v-tooltip v-if="item.approval_note" :text="item.approval_note" location="top">
            <template #activator="{ props }">
              <v-chip v-bind="props" :color="STATUS[item.approval_status].color" size="small" variant="tonal" label>
                <v-icon start :icon="STATUS[item.approval_status].icon" size="14" />
                {{ STATUS[item.approval_status].label }}
                <v-icon end icon="mdi-message-text-outline" size="12" />
              </v-chip>
            </template>
          </v-tooltip>
          <v-chip v-else :color="STATUS[item.approval_status].color" size="small" variant="tonal" label>
            <v-icon start :icon="STATUS[item.approval_status].icon" size="14" />
            {{ STATUS[item.approval_status].label }}
          </v-chip>
        </template>
        <template #item.approved_at="{ item }">
          <span v-if="item.approved_at">
            {{ fmt(item.approved_at) }}
            <span v-if="item.approved_by" class="textSecondary text-caption d-block">by {{ item.approved_by }}</span>
          </span>
          <span v-else class="textSecondary">—</span>
        </template>
        <template #no-data>
          <div class="pa-10 text-center">
            <v-avatar color="primary" variant="tonal" size="64" class="mb-3"><v-icon icon="mdi-clipboard-text-outline" size="34" /></v-avatar>
            <h3 class="text-h6 mb-1">No test cases yet</h3>
            <p class="textSecondary mb-3">Cases you create will appear here with their approval status.</p>
            <v-btn color="primary" prepend-icon="mdi-plus" to="/test-cases/new">Create a test case</v-btn>
          </div>
        </template>
      </v-data-table>
    </v-card>
  </div>
</template>

<style scoped>
.ga-2 { gap: 8px; }
</style>
