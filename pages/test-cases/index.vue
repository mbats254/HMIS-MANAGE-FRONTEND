<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTestCasesStore } from '@/stores/testCases'
import { useAuthStore } from '@/stores/auth'
import { useNuxtApp } from '#app'

const store = useTestCasesStore()
const auth = useAuthStore()
const { $showToast } = useNuxtApp()

const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => store.loadSuites())

const roleIcons: Record<string, string> = {
  'admin-role': 'mdi-shield-account',
  'doctor-role': 'mdi-stethoscope',
  'nurse-role': 'mdi-hospital-box',
  'laboratory-technician-role': 'mdi-flask',
  'pharmacist-role': 'mdi-pill',
  'receptionist-role': 'mdi-account-tie',
  'accountant-role': 'mdi-calculator-variant',
  'procurement-officer-role': 'mdi-truck-delivery',
  'cashier-role': 'mdi-cash-register',
  'theatre-nurse-role': 'mdi-medical-bag',
  'anaesthetist-role': 'mdi-sleep',
}

const overall = computed(() => {
  return store.suites.reduce(
    (acc, s) => ({
      pass: acc.pass + s.stats.pass,
      fail: acc.fail + s.stats.fail,
      untested: acc.untested + s.stats.untested,
      total: acc.total + s.stats.total,
    }),
    { pass: 0, fail: 0, untested: 0, total: 0 },
  )
})

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0)

// Bar segment width. Uses the unrounded ratio so a single result still moves the
// bar (1 of 642 rounds to 0%), with a small floor so it stays visible.
const segWidth = (n: number, total: number) => {
  if (!total || n <= 0) return '0%'
  return `${Math.max((n / total) * 100, 1.5)}%`
}

function pickFile() {
  fileInput.value?.click()
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const res = await store.upload(file)
  if (res.success) $showToast(res.message || 'Test cases imported.')
  else $showToast(store.lastError)
  input.value = ''
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center justify-space-between mb-6 gap-3">
      <div>
        <h2 class="text-h4 font-weight-semibold">Test Cases</h2>
        <p class="textSecondary">Upload a role document, then run its cases and mark each pass or fail.</p>
      </div>
      <div v-if="auth.canAuthorTests" class="d-flex gap-2">
        <input ref="fileInput" type="file" accept=".md,.markdown,text/markdown,text/plain" hidden @change="onFile" />
        <v-btn color="primary" prepend-icon="mdi-plus" to="/test-cases/new">New Test Case</v-btn>
        <v-btn variant="tonal" color="primary" prepend-icon="mdi-upload" :loading="store.uploading" @click="pickFile">
          Upload Doc
        </v-btn>
      </div>
    </div>

    <v-alert v-if="store.lastError" type="error" variant="tonal" rounded="lg" class="mb-4" :text="store.lastError" />

    <!-- Overall progress -->
    <v-card rounded="lg" elevation="10" class="mb-6">
      <v-card-text>
        <div class="d-flex flex-wrap align-center gap-6">
          <div><p class="text-overline textSecondary mb-0">Total</p><p class="text-h4 font-weight-semibold mb-0">{{ overall.total }}</p></div>
          <div><p class="text-overline textSecondary mb-0">Passed</p><p class="text-h4 font-weight-semibold text-success mb-0">{{ overall.pass }}</p></div>
          <div><p class="text-overline textSecondary mb-0">Failed</p><p class="text-h4 font-weight-semibold text-error mb-0">{{ overall.fail }}</p></div>
          <div><p class="text-overline textSecondary mb-0">Untested</p><p class="text-h4 font-weight-semibold textSecondary mb-0">{{ overall.untested }}</p></div>
          <div class="flex-grow-1" style="min-width: 200px">
            <div
              class="run-track"
              style="height: 10px"
              :title="`${overall.pass} passed, ${overall.fail} failed, ${overall.untested} not run`"
            >
              <div class="run-seg bg-success" :style="{ width: segWidth(overall.pass, overall.total) }" />
              <div class="run-seg bg-error" :style="{ width: segWidth(overall.fail, overall.total) }" />
            </div>
            <p class="text-caption textSecondary mt-1 mb-0">{{ pct(overall.pass + overall.fail, overall.total) }}% executed</p>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <v-progress-linear v-if="store.loading" indeterminate color="primary" class="mb-4" />

    <!-- Empty state -->
    <v-card v-if="!store.loading && !store.suites.length" rounded="lg" elevation="10">
      <v-card-text class="text-center py-12">
        <v-avatar color="primary" variant="tonal" size="64" class="mb-4">
          <v-icon icon="mdi-clipboard-text-outline" size="36" />
        </v-avatar>
        <h3 class="text-h6 mb-2">No test cases yet</h3>
        <p class="textSecondary mb-4">
          {{ auth.canAuthorTests ? 'Create a test case with the form, or upload a role document (.md).' : 'No test cases have been published yet.' }}
        </p>
        <div v-if="auth.canAuthorTests" class="d-flex justify-center gap-2">
          <v-btn color="primary" prepend-icon="mdi-plus" to="/test-cases/new">New Test Case</v-btn>
          <v-btn variant="tonal" color="primary" prepend-icon="mdi-upload" :loading="store.uploading" @click="pickFile">Upload Doc</v-btn>
        </div>
      </v-card-text>
    </v-card>

    <!-- Role cards -->
    <v-row v-else>
      <v-col v-for="s in store.suites" :key="s.slug" cols="12" sm="6" md="4">
        <v-card rounded="lg" elevation="10" class="h-100 role-card" :to="`/test-cases/${s.slug}`" hover>
          <v-card-text>
            <div class="d-flex align-center mb-3">
              <v-avatar color="primary" variant="tonal" size="48" class="mr-3">
                <v-icon :icon="roleIcons[s.slug] || 'mdi-clipboard-text'" />
              </v-avatar>
              <div>
                <p class="text-subtitle-1 font-weight-medium mb-0">{{ s.role }}</p>
                <p class="text-caption textSecondary mb-0">{{ s.total }} cases · {{ s.modules }} modules</p>
              </div>
            </div>
            <div class="d-flex align-center justify-space-between mb-1">
              <span class="text-caption textSecondary">{{ pct(s.stats.pass + s.stats.fail, s.total) }}% executed</span>
            </div>
            <div
              class="run-track mb-2"
              style="height: 8px"
              :title="`${s.stats.pass} passed, ${s.stats.fail} failed, ${s.stats.untested} not run`"
            >
              <div class="run-seg bg-success" :style="{ width: segWidth(s.stats.pass, s.total) }" />
              <div class="run-seg bg-error" :style="{ width: segWidth(s.stats.fail, s.total) }" />
            </div>
            <div class="d-flex gap-2">
              <v-chip size="x-small" color="success" variant="tonal">{{ s.stats.pass }} pass</v-chip>
              <v-chip size="x-small" color="error" variant="tonal">{{ s.stats.fail }} fail</v-chip>
              <v-chip size="x-small" variant="tonal">{{ s.stats.untested }} left</v-chip>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.role-card { transition: transform 0.15s ease; }
.role-card:hover { transform: translateY(-2px); }

/* Neutral track so an empty bar reads as empty. Vuetify's v-progress-linear
   tints its own track with the bar colour, which made a 0% bar look full. */
.run-track {
  display: flex;
  width: 100%;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(var(--v-theme-on-surface), 0.09);
}
.run-seg { transition: width 0.35s ease; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-6 { gap: 24px; }
</style>
