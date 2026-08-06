<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useTesterActivityStore } from '@/stores/testerActivity'

const store = useTesterActivityStore()

// Date-range filter (YYYY-MM-DD). Empty = all time.
const dateFrom = ref('')
const dateTo = ref('')

function todayStr(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

function apply() {
  store.load({ date_from: dateFrom.value || null, date_to: dateTo.value || null })
}
function clearFilter() {
  dateFrom.value = ''
  dateTo.value = ''
  store.load()
}
function setToday() {
  dateFrom.value = todayStr()
  dateTo.value = todayStr()
  apply()
}
function setLast7() {
  dateFrom.value = todayStr(-6)
  dateTo.value = todayStr()
  apply()
}

const rangeActive = computed(() => !!(dateFrom.value || dateTo.value))

onMounted(() => store.load())

const t = computed(() => store.data)

function fmtDate(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// Anyone can run test cases, so any role may appear here.
const ROLE_LABELS: Record<string, string> = {
  tester: 'Tester', qa: 'QA', developer: 'Developer', system_admin: 'System Admin',
}
const ROLE_COLORS: Record<string, string> = {
  tester: 'primary', qa: 'warning', developer: 'info', system_admin: 'success',
}
function roleLabel(r: string) { return ROLE_LABELS[r] ?? r }
function roleColor(r: string) { return ROLE_COLORS[r] ?? 'secondary' }

const headers = [
  { title: 'Tester', key: 'name', sortable: true },
  { title: 'Role', key: 'role', sortable: true },
  { title: 'Passed', key: 'pass', sortable: true, align: 'end' as const },
  { title: 'Failed', key: 'fail', sortable: true, align: 'end' as const },
  { title: 'Untested', key: 'untested', sortable: true, align: 'end' as const },
  { title: 'Pass rate', key: 'pass_rate', sortable: true },
  { title: 'Authored', key: 'authored', sortable: false, align: 'end' as const },
  { title: 'Last active', key: 'last_active_at', sortable: true },
]

const serviceHeaders = [
  { title: 'Service', key: 'name', sortable: true },
  { title: 'Coverage', key: 'coverage', sortable: true },
  { title: 'Passed', key: 'pass', sortable: true, align: 'end' as const },
  { title: 'Failed', key: 'fail', sortable: true, align: 'end' as const },
  { title: 'Outcome', key: 'outcome', sortable: false },
]

// Flatten for the data table.
const rows = computed(() =>
  (t.value?.testers ?? []).map((x) => ({
    ...x,
    pass: x.verdicts.pass,
    fail: x.verdicts.fail,
    untested: x.verdicts.untested,
  })),
)

const verdictColor = (v: string) => (v === 'pass' ? 'success' : v === 'fail' ? 'error' : 'grey')

function downloadExcel() {
  const date = rangeActive.value
    ? `${dateFrom.value || 'start'}_to_${dateTo.value || 'end'}`
    : new Date().toISOString().slice(0, 10)
  const data = rows.value

  // Build CSV content (opens in Excel)
  const headers = ['Name', 'Email', 'Role', 'Passed', 'Failed', 'Untested', 'Total Run', 'Pass Rate (%)', 'Last Active']
  const escapeCell = (v: any) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    headers.join(','),
    ...data.map(r => [
      r.name,
      r.email,
      roleLabel(r.role),
      r.pass,
      r.fail,
      r.untested,
      r.pass + r.fail,
      r.pass_rate,
      r.last_active_at ? new Date(r.last_active_at).toLocaleString() : 'Never',
    ].map(escapeCell).join(',')),
  ]

  const csv = '﻿' + lines.join('\r\n') // BOM for Excel UTF-8
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tester-activity-${date}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between mb-6 ga-3">
      <div>
        <h2 class="text-h4 font-weight-semibold">Tester Activity</h2>
        <p class="textSecondary mb-0">Track everyone who runs test cases — testers, QA, developers and admins — and what they've passed/failed.</p>
      </div>
      <v-btn color="success" variant="tonal" prepend-icon="mdi-microsoft-excel"
        :disabled="!rows.length" @click="downloadExcel">
        Download Excel
      </v-btn>
    </div>

    <!-- Date-range filter -->
    <v-card rounded="lg" elevation="10" class="mb-4">
      <v-card-text>
        <div class="d-flex flex-wrap align-center ga-3">
          <v-icon icon="mdi-calendar-range" color="primary" />
          <v-text-field v-model="dateFrom" type="date" label="From" variant="outlined"
            density="compact" hide-details style="max-width: 190px" />
          <v-text-field v-model="dateTo" type="date" label="To" variant="outlined"
            density="compact" hide-details style="max-width: 190px" />
          <v-btn color="primary" variant="flat" prepend-icon="mdi-filter" @click="apply">Apply</v-btn>
          <v-btn v-if="rangeActive" variant="text" prepend-icon="mdi-close" @click="clearFilter">Clear</v-btn>
          <v-divider vertical class="mx-1" />
          <v-btn size="small" variant="tonal" @click="setToday">Today</v-btn>
          <v-btn size="small" variant="tonal" @click="setLast7">Last 7 days</v-btn>
          <v-spacer />
          <v-chip v-if="rangeActive" color="primary" variant="tonal" label>
            {{ dateFrom || '…' }} → {{ dateTo || '…' }}
          </v-chip>
          <v-chip v-else variant="tonal" label>All time</v-chip>
        </div>
        <p v-if="rangeActive" class="text-caption textSecondary mb-0 mt-2">
          Showing pass/fail runs recorded in this window (from the run history). “Untested” counts apply to all-time only.
        </p>
      </v-card-text>
    </v-card>

    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-4" :text="store.error" />
    <v-progress-linear v-if="store.loading" indeterminate color="primary" class="mb-4" />

    <template v-if="t">
      <!-- Summary totals -->
      <v-row class="mb-2">
        <v-col cols="6" md="3">
          <v-card rounded="lg" elevation="10"><v-card-text>
            <p class="text-overline textSecondary mb-0">Testers</p>
            <p class="text-h4 font-weight-semibold mb-0">{{ t.totals.testers }}</p>
          </v-card-text></v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card rounded="lg" elevation="10"><v-card-text>
            <p class="text-overline textSecondary mb-0">QA</p>
            <p class="text-h4 font-weight-semibold mb-0">{{ t.totals.qa }}</p>
          </v-card-text></v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card rounded="lg" elevation="10"><v-card-text>
            <p class="text-overline textSecondary mb-0">Passed</p>
            <p class="text-h4 font-weight-semibold text-success mb-0">{{ t.totals.pass }}</p>
          </v-card-text></v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card rounded="lg" elevation="10"><v-card-text>
            <p class="text-overline textSecondary mb-0">Failed</p>
            <p class="text-h4 font-weight-semibold text-error mb-0">{{ t.totals.fail }}</p>
          </v-card-text></v-card>
        </v-col>
      </v-row>

      <!-- Per-tester table -->
      <v-card rounded="lg" elevation="10" class="mb-6">
        <v-card-item><v-card-title>Per-tester breakdown</v-card-title></v-card-item>
        <v-data-table :headers="headers" :items="rows" :items-per-page="25" density="comfortable" hover>
          <template #item.name="{ item }">
            <div class="py-1">
              <div class="font-weight-medium">{{ item.name }}</div>
              <div class="text-caption textSecondary">{{ item.email }}</div>
            </div>
          </template>
          <template #item.role="{ item }">
            <v-chip :color="roleColor(item.role)" size="small" variant="tonal" label>
              {{ roleLabel(item.role) }}
            </v-chip>
          </template>
          <template #item.pass="{ item }"><span class="text-success font-weight-medium">{{ item.pass }}</span></template>
          <template #item.fail="{ item }"><span class="text-error font-weight-medium">{{ item.fail }}</span></template>
          <template #item.untested="{ item }"><span class="textSecondary">{{ item.untested }}</span></template>
          <template #item.pass_rate="{ item }">
            <div style="min-width: 120px">
              <!-- bg-color/bg-opacity keep the track neutral; by default Vuetify
                   tints it with the bar colour, so a 0% bar looked 100% full. -->
              <v-progress-linear :model-value="item.pass_rate" height="8" rounded
                bg-color="on-surface" :bg-opacity="0.09"
                :color="item.pass_rate >= 80 ? 'success' : item.pass_rate >= 50 ? 'warning' : 'error'" />
              <span class="text-caption textSecondary">{{ item.pass_rate }}%</span>
            </div>
          </template>
          <template #item.authored="{ item }">
            <span v-if="item.can_author">{{ item.authored.suites }} suites · {{ item.authored.cases }} cases</span>
            <span v-else class="textSecondary">—</span>
          </template>
          <template #item.last_active_at="{ item }">
            <span class="text-caption">{{ fmtDate(item.last_active_at) }}</span>
          </template>
          <template #no-data>
            <div class="pa-8 text-center textSecondary">No testers yet.</div>
          </template>
        </v-data-table>
      </v-card>

      <!-- Service coverage -->
      <v-card rounded="lg" elevation="10" class="mb-6">
        <v-card-item>
          <v-card-title>Service coverage</v-card-title>
          <v-card-subtitle>How far each service's cases have been run{{ rangeActive ? ' in this window' : '' }}, and whether runs mostly passed or failed.</v-card-subtitle>
        </v-card-item>
        <v-data-table :headers="serviceHeaders" :items="t.services" :items-per-page="25" density="comfortable" hover>
          <template #item.name="{ item }">
            <span class="font-weight-medium">{{ item.name }}</span>
          </template>
          <template #item.coverage="{ item }">
            <div style="min-width: 150px">
              <v-progress-linear :model-value="item.coverage" height="8" rounded
                bg-color="on-surface" :bg-opacity="0.09"
                :color="item.coverage >= 80 ? 'success' : item.coverage >= 40 ? 'warning' : 'error'" />
              <span class="text-caption textSecondary">{{ item.tested_cases }}/{{ item.total_cases }} cases · {{ item.coverage }}%</span>
            </div>
          </template>
          <template #item.pass="{ item }"><span class="text-success font-weight-medium">{{ item.pass }}</span></template>
          <template #item.fail="{ item }"><span class="text-error font-weight-medium">{{ item.fail }}</span></template>
          <template #item.outcome="{ item }">
            <v-chip v-if="item.outcome !== 'none'" :color="item.outcome === 'pass' ? 'success' : 'error'" size="small" variant="tonal" label>
              Mostly {{ item.outcome === 'pass' ? 'passing' : 'failing' }}
            </v-chip>
            <span v-else class="textSecondary text-caption">Not run yet</span>
          </template>
          <template #no-data><div class="pa-8 text-center textSecondary">No services found.</div></template>
        </v-data-table>
      </v-card>

      <!-- Recent activity feed -->
      <v-card rounded="lg" elevation="10">
        <v-card-item>
          <v-card-title>Recent activity</v-card-title>
          <v-card-subtitle>The latest pass/fail verdicts across all testers.</v-card-subtitle>
        </v-card-item>
        <v-card-text>
          <v-list v-if="t.recent.length" lines="two" density="comfortable">
            <v-list-item v-for="r in t.recent" :key="r.id">
              <template #prepend>
                <v-avatar :color="verdictColor(r.verdict)" variant="tonal" size="36">
                  <v-icon :icon="r.verdict === 'pass' ? 'mdi-check' : 'mdi-close'" />
                </v-avatar>
              </template>
              <v-list-item-title>
                <span class="font-weight-medium">{{ r.user }}</span>
                marked <v-chip :color="verdictColor(r.verdict)" size="x-small" variant="tonal" label>{{ r.verdict.toUpperCase() }}</v-chip>
                on <span class="font-weight-medium">{{ r.case_id }}</span>
                <v-chip v-if="r.module" size="x-small" variant="tonal" label class="ml-1">{{ r.module }}</v-chip>
              </v-list-item-title>
              <v-list-item-subtitle>
                {{ r.suite }} — {{ r.case_title }}<template v-if="r.note"> · “{{ r.note }}”</template>
              </v-list-item-subtitle>
              <template #append>
                <span class="text-caption textSecondary">{{ fmtDate(r.at) }}</span>
              </template>
            </v-list-item>
          </v-list>
          <p v-else class="textSecondary">No test activity recorded yet.</p>
        </v-card-text>
      </v-card>
    </template>
  </div>
</template>
