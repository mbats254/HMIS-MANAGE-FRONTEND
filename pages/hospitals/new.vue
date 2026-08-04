<script setup lang="ts">
import { reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useHospitalsStore } from '@/stores/hospitals'
import type { CreateHospitalPayload } from '@/types/hospital'

const router = useRouter()
const store = useHospitalsStore()

const TIERS = ['BASIC', 'PREMIUM', 'ENTERPRISE']
const BILLING = ['ACTIVE', 'PAST_DUE', 'SUSPENDED']
const STATUSES = ['PROVISIONING', 'ACTIVE', 'MAINTENANCE', 'ARCHIVED']

const step = ref(1)
const LAST_STEP = 4

const form = reactive<CreateHospitalPayload>({
  name: '',
  legal_name: '',
  display_name: '',
  timezone: 'UTC',
  locale: 'en_US',
  address: { line1: '', city: '', country: '' },
  subdomain: '',
  custom_domain: '',
  subscription_tier: 'BASIC',
  billing_status: 'ACTIVE',
  payment_gateway_customer_id: '',
  max_user_slots: 10,
  max_patient_records: 1000,
  status: 'PROVISIONING',
  is_sandbox: false,
})

const addFacility = ref(true)
const facility = reactive({ name: '' })

const addAdmin = ref(true)
const admin = reactive({ name: '', username: '', email: '', password: '' })

const fieldError = (key: string) => store.fieldErrors[key]?.[0]

// Flat list of every backend field error, so the top banner can show all
// reasons at once even when they span multiple wizard steps.
const allFieldErrors = computed(() => Object.values(store.fieldErrors).flat())

// Per-step "can advance" gates (light client-side; backend still validates).
const step1Valid = computed(() => form.name.trim().length > 0)
const step4Valid = computed(() => {
  if (!addAdmin.value) return true
  return (
    admin.name.trim() &&
    admin.username.trim() &&
    /.+@.+\..+/.test(admin.email) &&
    admin.password.length >= 8
  )
})

function next() {
  if (step.value === 1 && !step1Valid.value) return
  if (step.value < LAST_STEP) step.value++
}
function prev() {
  if (step.value > 1) step.value--
}

function cleaned<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== '' && v !== null && v !== undefined) out[k] = v
  }
  return out as Partial<T>
}

const submitted = ref(false)

const provisioningState = computed(() => {
  const res = store.lastCreateResult
  if (!res) return 'none'
  if (!res.admin && !res.facility) return 'skipped'
  return res.core_provisioned ? 'success' : 'warning'
})

async function submit() {
  const payload: CreateHospitalPayload = {
    ...cleaned(form),
    name: form.name,
    address: cleaned(form.address || {}) as any,
  }
  if (addFacility.value && facility.name) payload.facility = { name: facility.name }
  if (addAdmin.value) payload.admin = { ...admin }

  const res = await store.create(payload)
  if (res.success) {
    submitted.value = true
  } else {
    // Jump back to the step that has the first error.
    const errs = Object.keys(store.fieldErrors)
    if (errs.some((e) => e.startsWith('admin'))) step.value = 4
    else if (errs.some((e) => ['subdomain', 'custom_domain', 'subscription_tier', 'billing_status', 'max_user_slots', 'max_patient_records', 'status'].includes(e))) step.value = 2
    else step.value = 1
  }
}

function done() {
  const id = store.lastCreateResult?.data.id
  if (id) router.push(`/hospitals/${id}`)
  else router.push('/hospitals')
}
</script>

<template>
  <div>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" to="/hospitals">
      Back to hospitals
    </v-btn>

    <div class="mb-6">
      <h2 class="text-h4 font-weight-semibold">Register New Hospital</h2>
      <p v-if="!submitted" class="textSecondary">Step {{ step }} of {{ LAST_STEP }}</p>
    </div>

    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-4">
      <p class="font-weight-medium mb-0">{{ store.error }}</p>
      <ul v-if="allFieldErrors.length" class="pl-4 mt-1 mb-0">
        <li v-for="(e, i) in allFieldErrors" :key="i" class="text-body-2">{{ e }}</li>
      </ul>
    </v-alert>

    <!-- Result panel: shown after a successful create() instead of redirecting away immediately, -->
    <!-- so a core-service provisioning failure (partial success) is visible before leaving the page. -->
    <v-card v-if="submitted && store.lastCreateResult" rounded="lg" elevation="10">
      <div class="pa-6">
        <h3 class="text-h5 mb-4"><v-icon icon="mdi-check-circle" color="success" class="mr-2" />Hospital created</h3>

        <v-list density="comfortable" lines="two" class="mb-4">
          <v-list-item title="Facility">
            <template #subtitle>
              {{ store.lastCreateResult.facility
                ? `${store.lastCreateResult.facility.name} (core: ${store.lastCreateResult.facility.core_facility_id || '—'})`
                : 'No facility created' }}
            </template>
          </v-list-item>
          <v-list-item title="Admin">
            <template #subtitle>
              {{ store.lastCreateResult.admin
                ? `${store.lastCreateResult.admin.username} · ${store.lastCreateResult.admin.email}`
                : 'No admin created' }}
            </template>
          </v-list-item>
        </v-list>

        <v-alert v-if="provisioningState === 'success'" type="success" variant="tonal" class="mb-2">
          Synced to core-service.
        </v-alert>
        <v-alert v-else-if="provisioningState === 'warning'" type="warning" variant="tonal" class="mb-2">
          <p class="font-weight-medium mb-1">Not yet synced to core-service.</p>
          <p class="text-body-2 mb-1">{{ store.lastCreateResult.core_provisioning_error }}</p>
          <p class="text-body-2 mb-0">
            This hospital exists in hmis-manage but not yet in core-service.
            Contact platform engineering to provision it manually.
          </p>
        </v-alert>
        <v-alert v-else-if="provisioningState === 'skipped'" type="info" variant="tonal" class="mb-2">
          No facility or admin was created, so core-service provisioning was not attempted.
        </v-alert>

        <div class="d-flex justify-end mt-4">
          <v-btn color="primary" prepend-icon="mdi-check" @click="done">Done</v-btn>
        </div>
      </div>
    </v-card>

    <v-card v-else rounded="lg" elevation="10">
      <v-stepper v-model="step" :items="['Identity', 'Tenant & Billing', 'Facility', 'Admin']" flat hide-actions>
        <!-- STEP 1: Identity & Localization -->
        <template #item.1>
          <div class="pa-2">
            <h3 class="text-h6 mb-4"><v-icon icon="mdi-map-marker" class="mr-2" />Identity & Localization</h3>
            <v-text-field v-model="form.name" label="Hospital name *" variant="outlined" density="comfortable"
              :error-messages="fieldError('name')" class="mb-3" hide-details="auto" />
            <div class="d-flex ga-3 mb-3 flex-wrap">
              <v-text-field v-model="form.legal_name" label="Legal name" variant="outlined" density="comfortable" hide-details="auto" style="min-width:240px" />
              <v-text-field v-model="form.display_name" label="Display name" variant="outlined" density="comfortable" hide-details="auto" style="min-width:240px" />
            </div>
            <div class="d-flex ga-3 mb-3">
              <v-text-field v-model="form.timezone" label="Timezone" variant="outlined" density="comfortable" hide-details="auto" />
              <v-text-field v-model="form.locale" label="Locale" variant="outlined" density="comfortable" hide-details="auto" />
            </div>
            <v-text-field v-model="form.address!.line1" label="Address line" variant="outlined" density="comfortable" class="mb-3" hide-details="auto" />
            <div class="d-flex ga-3">
              <v-text-field v-model="form.address!.city" label="City" variant="outlined" density="comfortable" hide-details="auto" />
              <v-text-field v-model="form.address!.country" label="Country" variant="outlined" density="comfortable" hide-details="auto" />
            </div>
          </div>
        </template>

        <!-- STEP 2: Tenant routing + Billing + System -->
        <template #item.2>
          <div class="pa-2">
            <h3 class="text-h6 mb-4"><v-icon icon="mdi-shield-lock" class="mr-2" />Tenant, Billing & System</h3>
            <div class="d-flex ga-3 mb-3 flex-wrap">
              <v-text-field v-model="form.subdomain" label="Subdomain" placeholder="e.g. st-marys" variant="outlined" density="comfortable"
                suffix=".afya.ai"
                :error-messages="fieldError('subdomain')" hint="Just the prefix — letters, numbers, dashes. The full URL becomes <prefix>.afya.ai" persistent-hint hide-details="auto" style="min-width:240px" />
              <v-text-field v-model="form.custom_domain" label="Custom domain" placeholder="portal.hospital.org" variant="outlined" density="comfortable" hide-details="auto" style="min-width:240px" />
            </div>
            <div class="d-flex ga-3 mb-3 flex-wrap">
              <v-select v-model="form.subscription_tier" :items="TIERS" label="Subscription tier" variant="outlined" density="comfortable" hide-details="auto" style="min-width:200px" />
              <v-select v-model="form.billing_status" :items="BILLING" label="Billing status" variant="outlined" density="comfortable" hide-details="auto" style="min-width:200px" />
              <v-select v-model="form.status" :items="STATUSES" label="Status" variant="outlined" density="comfortable" hide-details="auto" style="min-width:200px" />
            </div>
            <v-text-field v-model="form.payment_gateway_customer_id" label="Payment gateway customer ID" variant="outlined" density="comfortable" class="mb-3" hide-details="auto" />
            <div class="d-flex ga-3 mb-3">
              <v-text-field v-model.number="form.max_user_slots" type="number" label="Max user slots" variant="outlined" density="comfortable"
                :error-messages="fieldError('max_user_slots')" hide-details="auto" />
              <v-text-field v-model.number="form.max_patient_records" type="number" label="Max patient records" variant="outlined" density="comfortable"
                :error-messages="fieldError('max_patient_records')" hide-details="auto" />
            </div>
            <v-switch v-model="form.is_sandbox" color="warning" label="Sandbox / training environment" hide-details inset />
          </div>
        </template>

        <!-- STEP 3: First facility -->
        <template #item.3>
          <div class="pa-2">
            <div class="d-flex align-center justify-space-between mb-4">
              <h3 class="text-h6"><v-icon icon="mdi-hospital-building" class="mr-2" />First Facility</h3>
              <v-switch v-model="addFacility" color="primary" hide-details inset density="compact" label="Add a facility" />
            </div>
            <v-text-field v-model="facility.name" :disabled="!addFacility" label="Facility name" placeholder="e.g. Main Hospital"
              variant="outlined" density="comfortable" hide-details="auto" />
            <p class="text-caption textSecondary mt-2">The first hospital admin will be assigned to this facility.</p>
          </div>
        </template>

        <!-- STEP 4: Admin + review -->
        <template #item.4>
          <div class="pa-2">
            <div class="d-flex align-center justify-space-between mb-4">
              <h3 class="text-h6"><v-icon icon="mdi-account-tie" class="mr-2" />Hospital Admin</h3>
              <v-switch v-model="addAdmin" color="primary" hide-details inset density="compact" label="Create admin" />
            </div>
            <v-text-field v-model="admin.name" :disabled="!addAdmin" label="Full name" variant="outlined" density="comfortable"
              :error-messages="fieldError('admin.name')" class="mb-3" hide-details="auto" />
            <v-text-field v-model="admin.username" :disabled="!addAdmin" label="Username" variant="outlined" density="comfortable"
              :error-messages="fieldError('admin.username')" class="mb-3" hide-details="auto" />
            <v-text-field v-model="admin.email" :disabled="!addAdmin" label="Email" type="email" variant="outlined" density="comfortable"
              :error-messages="fieldError('admin.email')" class="mb-3" hide-details="auto" />
            <v-text-field v-model="admin.password" :disabled="!addAdmin" label="Temporary password" type="password" variant="outlined" density="comfortable"
              :error-messages="fieldError('admin.password')" hint="Min 8 characters. An invite email is sent to this admin." persistent-hint hide-details="auto" />
          </div>
        </template>
      </v-stepper>

      <!-- Custom footer nav -->
      <v-divider />
      <div class="d-flex align-center justify-space-between pa-4">
        <v-btn variant="text" :disabled="step === 1 || store.saving" prepend-icon="mdi-chevron-left" @click="prev">
          Back
        </v-btn>
        <div class="d-flex ga-3">
          <v-btn variant="text" to="/hospitals" :disabled="store.saving">Cancel</v-btn>
          <v-btn v-if="step < LAST_STEP" color="primary" append-icon="mdi-chevron-right"
            :disabled="step === 1 && !step1Valid" @click="next">
            Next
          </v-btn>
          <v-btn v-else color="primary" prepend-icon="mdi-check" :loading="store.saving" :disabled="!step4Valid" @click="submit">
            Register Hospital
          </v-btn>
        </div>
      </div>
    </v-card>
  </div>
</template>

<style scoped>
.ga-3 { gap: 12px; }
</style>
