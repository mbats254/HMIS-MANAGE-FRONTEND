<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTestCasesApi } from '@/composables/useTestCasesApi'
import { useNuxtApp } from '#app'
import { useAuthStore } from '@/stores/auth'

const api = useTestCasesApi()
const { $showToast } = useNuxtApp()
const auth = useAuthStore()

const seeAll = computed(() => auth.isSystemAdmin || auth.platformRole === 'developer')

interface Run {
  id: number
  verdict: 'pass' | 'fail'
  note: string | null
  ran_at: string | null
  tester: string | null
  case_id: string | null
  case_title: string | null
  suite_role: string | null
}

const items = ref<Run[]>([])
const totals = ref<{ pass: number; fail: number }>({ pass: 0, fail: 0 })
const loading = ref(false)
const search = ref('')
const verdict = ref<string | null>(null)
const suite = ref<string | null>(null)
const moduleName = ref<string | null>(null)
const testerId = ref<number | null>(null)
const dateFrom = ref('')
const dateTo = ref('')

// Server-side paging — there can be thousands of runs, and without this the
// page silently showed only the newest 50 with no way to reach the rest.
const page = ref(1)
const perPage = ref(50)
const total = ref(0)

// Option lists come back with the results, limited to values that have runs.
const suiteItems = ref<{ title: string; value: string | null }[]>([])
const moduleItems = ref<{ title: string; value: string | null }[]>([])
const testerItems = ref<{ title: string; value: number | null }[]>([])

const verdictItems = [
  { title: 'All verdicts', value: null },
  { title: 'Passed', value: 'pass' },
  { title: 'Failed', value: 'fail' },
]

async function load() {
  loading.value = true
  try {
    const res = await api.runHistory({
      search: search.value || undefined,
      verdict: verdict.value || undefined,
      suite: suite.value || undefined,
      module: moduleName.value || undefined,
      user_id: testerId.value || undefined,
      date_from: dateFrom.value || undefined,
      date_to: dateTo.value || undefined,
      page: page.value,
      per_page: perPage.value,
    })
    items.value = res.data
    totals.value = res.meta.totals
    total.value = res.meta.total ?? res.data.length

    const f = (res.meta as any).filters
    if (f) {
      suiteItems.value = [{ title: 'All suites', value: null }, ...f.suites]
      moduleItems.value = [{ title: 'All modules', value: null }, ...f.modules.map((m: string) => ({ title: m, value: m }))]
      testerItems.value = [{ title: 'All testers', value: null }, ...f.testers]
    }
  } catch (e: any) {
    $showToast(e?.response?.data?.message || 'Failed to load run history.')
  } finally {
    loading.value = false
  }
}

/** Filters changed — restart at page 1 so you can't land past the last page. */
function applyFilters() {
  page.value = 1
  load()
}

function clearFilters() {
  search.value = ''
  verdict.value = null
  suite.value = null
  moduleName.value = null
  testerId.value = null
  dateFrom.value = ''
  dateTo.value = ''
  applyFilters()
}

const hasFilters = computed(() =>
  !!(search.value || verdict.value || suite.value || moduleName.value || testerId.value || dateFrom.value || dateTo.value),
)

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'
}

const allHeaders = [
  { title: 'Case', key: 'case_id', sortable: false },
  { title: 'Suite', key: 'suite_role', sortable: false },
  { title: 'Verdict', key: 'verdict', sortable: false },
  { title: 'Tester', key: 'tester', sortable: false, adminOnly: true },
  { title: 'When', key: 'ran_at', sortable: false },
  { title: 'Note', key: 'note', sortable: false },
]

const headers = computed(() =>
  allHeaders.filter((h) => !(h as any).adminOnly || seeAll.value),
)

// No onMounted(load) — v-data-table-server fires update:options on mount.
</script>

<template>
  <div>
    <div class="mb-6">
      <h2 class="text-h4 font-weight-semibold">Run History</h2>
      <p class="textSecondary mb-0">Every time a test case was run — passed or failed — over time.</p>
    </div>

    <!-- Totals -->
    <v-row class="mb-2">
      <v-col cols="6" sm="4" md="3">
        <v-card rounded="lg" elevation="10" class="pa-4 d-flex align-center ga-3">
          <v-avatar color="success" variant="tonal" size="44"><v-icon icon="mdi-check-bold" /></v-avatar>
          <div>
            <div class="text-h5 font-weight-bold">{{ totals.pass }}</div>
            <div class="text-caption textSecondary">Total passes</div>
          </div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4" md="3">
        <v-card rounded="lg" elevation="10" class="pa-4 d-flex align-center ga-3">
          <v-avatar color="error" variant="tonal" size="44"><v-icon icon="mdi-close-thick" /></v-avatar>
          <div>
            <div class="text-h5 font-weight-bold">{{ totals.fail }}</div>
            <div class="text-caption textSecondary">Total failures</div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-card rounded="lg" elevation="10">
      <div class="d-flex flex-wrap ga-3 pa-4">
        <v-text-field
          v-model="search" label="Search case id / title" density="compact" variant="outlined"
          hide-details prepend-inner-icon="mdi-magnify" style="max-width: 300px"
          @keyup.enter="applyFilters"
        />
        <v-select
          v-model="verdict" :items="verdictItems" label="Verdict" density="compact" variant="outlined"
          hide-details style="max-width: 170px" @update:model-value="applyFilters"
        />
        <v-select
          v-model="suite" :items="suiteItems" label="Suite / role" density="compact" variant="outlined"
          hide-details style="max-width: 220px" @update:model-value="applyFilters"
        />
        <v-select
          v-model="moduleName" :items="moduleItems" label="Module" density="compact" variant="outlined"
          hide-details style="max-width: 260px" @update:model-value="applyFilters"
        />
        <v-select
          v-if="seeAll" v-model="testerId" :items="testerItems" label="Tester" density="compact" variant="outlined"
          hide-details style="max-width: 200px" @update:model-value="applyFilters"
        />
      </div>

      <div class="d-flex flex-wrap align-center ga-3 px-4 pb-4">
        <v-text-field
          v-model="dateFrom" type="date" label="Run from" density="compact" variant="outlined"
          hide-details clearable style="max-width: 185px" @keyup.enter="applyFilters"
        />
        <v-text-field
          v-model="dateTo" type="date" label="Run to" density="compact" variant="outlined"
          hide-details clearable style="max-width: 185px" @keyup.enter="applyFilters"
        />
        <v-btn color="primary" prepend-icon="mdi-filter-variant" :loading="loading" @click="applyFilters">Filter</v-btn>
        <v-btn v-if="hasFilters" variant="text" prepend-icon="mdi-close" @click="clearFilters">Clear</v-btn>
        <v-spacer />
        <v-chip v-if="total" variant="tonal" label>{{ total }} runs</v-chip>
      </div>

      <v-data-table-server
        v-model:page="page"
        v-model:items-per-page="perPage"
        :items-length="total"
        :items-per-page-options="[25, 50, 100, 200]"
        :headers="headers" :items="items" :loading="loading" density="comfortable"
        @update:options="load">
        <template #item.case_id="{ item }">
          <div class="font-weight-medium">{{ item.case_id }}</div>
          <div class="text-caption textSecondary text-truncate" style="max-width: 260px">{{ item.case_title }}</div>
        </template>
        <template #item.suite_role="{ item }">{{ item.suite_role || '—' }}</template>
        <template #item.verdict="{ item }">
          <v-chip size="small" :color="item.verdict === 'pass' ? 'success' : 'error'" variant="tonal" label>
            {{ item.verdict === 'pass' ? 'Passed' : 'Failed' }}
          </v-chip>
        </template>
        <template #item.tester="{ item }">{{ item.tester || '—' }}</template>
        <template #item.ran_at="{ item }">{{ fmt(item.ran_at) }}</template>
        <template #item.note="{ item }">
          <span class="text-truncate d-inline-block" style="max-width: 220px">{{ item.note || '—' }}</span>
        </template>
        <template #no-data>
          <div class="pa-10 text-center">
            <v-avatar color="secondary" variant="tonal" size="64" class="mb-3"><v-icon icon="mdi-history" size="34" /></v-avatar>
            <h3 class="text-h6 mb-1">No runs yet</h3>
            <p class="textSecondary mb-0">Once testers start passing/failing cases, every run shows up here.</p>
          </div>
        </template>
      </v-data-table-server>
    </v-card>
  </div>
</template>

<style scoped>
.ga-3 { gap: 12px; }
</style>
