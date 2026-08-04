<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useHospitalsStore } from '@/stores/hospitals'
import { STATUS_COLOR, TIER_COLOR, BILLING_COLOR } from '@/types/hospital'

const route = useRoute()
const store = useHospitalsStore()

const id = computed(() => String(route.params.id))
const h = computed(() => store.current)

const addressLines = computed(() => {
  const a = h.value?.address
  if (!a) return []
  return [a.line1, a.city, a.country].filter(Boolean)
})

onMounted(() => store.fetchOne(id.value))
</script>

<template>
  <div>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-4" to="/hospitals">
      Back to hospitals
    </v-btn>

    <v-alert v-if="store.error" type="error" variant="tonal" class="mb-4" :text="store.error" />
    <v-progress-linear v-if="store.loading" indeterminate color="primary" class="mb-4" />

    <template v-if="h">
      <!-- Header -->
      <div class="d-flex flex-wrap align-center justify-space-between mb-6 ga-3">
        <div>
          <h2 class="text-h4 font-weight-semibold">{{ h.display_name || h.name }}</h2>
          <p class="textSecondary">{{ h.legal_name || h.name }}</p>
        </div>
        <div class="d-flex ga-2">
          <v-chip :color="STATUS_COLOR[h.status]" variant="flat" label>{{ h.status }}</v-chip>
          <v-chip :color="TIER_COLOR[h.subscription_tier]" variant="tonal" label>{{ h.subscription_tier }}</v-chip>
          <v-chip v-if="h.is_sandbox" color="warning" variant="tonal" label>SANDBOX</v-chip>
        </div>
      </div>

      <v-row>
        <!-- 1. Isolation -->
        <v-col cols="12" md="6">
          <v-card rounded="lg" elevation="10" class="h-100">
            <v-card-item>
              <v-card-title><v-icon icon="mdi-shield-lock" class="mr-2" />Tenant & Isolation</v-card-title>
            </v-card-item>
            <v-card-text>
              <v-list density="compact" lines="two">
                <v-list-item title="Tenant ID" :subtitle="h.tenant_id" />
                <v-list-item title="Organization ID" :subtitle="h.id" />
                <v-list-item title="Subdomain" :subtitle="h.subdomain || '—'" />
                <v-list-item title="Custom domain" :subtitle="h.custom_domain || '—'" />
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- 2. Identity & localization -->
        <v-col cols="12" md="6">
          <v-card rounded="lg" elevation="10" class="h-100">
            <v-card-item>
              <v-card-title><v-icon icon="mdi-map-marker" class="mr-2" />Identity & Localization</v-card-title>
            </v-card-item>
            <v-card-text>
              <v-list density="compact" lines="two">
                <v-list-item title="Legal name" :subtitle="h.legal_name || '—'" />
                <v-list-item title="Display name" :subtitle="h.display_name || '—'" />
                <v-list-item title="Timezone" :subtitle="h.timezone" />
                <v-list-item title="Locale" :subtitle="h.locale" />
                <v-list-item title="Address" :subtitle="addressLines.length ? addressLines.join(', ') : '—'" />
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- 3. Billing & tiering -->
        <v-col cols="12" md="6">
          <v-card rounded="lg" elevation="10" class="h-100">
            <v-card-item>
              <v-card-title><v-icon icon="mdi-credit-card" class="mr-2" />Billing & Subscription</v-card-title>
            </v-card-item>
            <v-card-text>
              <v-list density="compact" lines="two">
                <v-list-item title="Subscription tier">
                  <template #subtitle>
                    <v-chip :color="TIER_COLOR[h.subscription_tier]" size="small" variant="tonal" label>
                      {{ h.subscription_tier }}
                    </v-chip>
                  </template>
                </v-list-item>
                <v-list-item title="Billing status">
                  <template #subtitle>
                    <v-chip :color="BILLING_COLOR[h.billing_status]" size="small" variant="tonal" label>
                      {{ h.billing_status }}
                    </v-chip>
                  </template>
                </v-list-item>
                <v-list-item title="Max user slots" :subtitle="String(h.max_user_slots)" />
                <v-list-item title="Max patient records" :subtitle="String(h.max_patient_records)" />
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- 4. System & metadata -->
        <v-col cols="12" md="6">
          <v-card rounded="lg" elevation="10" class="h-100">
            <v-card-item>
              <v-card-title><v-icon icon="mdi-cog" class="mr-2" />System & Metadata</v-card-title>
            </v-card-item>
            <v-card-text>
              <v-list density="compact" lines="two">
                <v-list-item title="Status">
                  <template #subtitle>
                    <v-chip :color="STATUS_COLOR[h.status]" size="small" variant="flat" label>{{ h.status }}</v-chip>
                  </template>
                </v-list-item>
                <v-list-item title="Sandbox" :subtitle="h.is_sandbox ? 'Yes' : 'No'" />
                <v-list-item title="Created" :subtitle="h.created_at || '—'" />
                <v-list-item title="Updated" :subtitle="h.updated_at || '—'" />
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 5. Core-service provisioning -->
      <v-row>
        <v-col cols="12" md="6">
          <v-card rounded="lg" elevation="10">
            <v-card-item>
              <v-card-title><v-icon icon="mdi-cloud-sync" class="mr-2" />Core Service Provisioning</v-card-title>
            </v-card-item>
            <v-card-text>
              <template v-if="h.core_org_id">
                <v-chip color="success" variant="flat" label class="mb-2">Provisioned</v-chip>
                <v-list density="compact" lines="two">
                  <v-list-item title="Core org ID" :subtitle="h.core_org_id" />
                </v-list>
              </template>
              <template v-else>
                <v-chip color="warning" variant="flat" label class="mb-2">Not provisioned in core-service</v-chip>
                <p class="text-body-2 textSecondary mb-0">
                  This hospital exists in hmis-manage but not yet in core-service.
                  Contact platform engineering to provision it manually.
                </p>
              </template>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Integrations shortcut -->
      <v-card rounded="lg" elevation="10" class="mt-6">
        <v-card-text class="d-flex align-center justify-space-between pa-5">
          <div>
            <p class="text-subtitle-1 font-weight-semibold mb-1">Integrations</p>
            <p class="text-body-2 textSecondary mb-0">Connect this hospital to external systems like QuickBooks, Dynamics 365 and more.</p>
          </div>
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-plug" to="/integrations">
            Manage integrations
          </v-btn>
        </v-card-text>
      </v-card>
    </template>
  </div>
</template>
