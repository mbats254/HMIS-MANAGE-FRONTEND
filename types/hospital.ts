// Mirrors HospitalController::present() on the backend.

export type HospitalStatus = 'PROVISIONING' | 'ACTIVE' | 'MAINTENANCE' | 'ARCHIVED'
export type SubscriptionTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE'
export type BillingStatus = 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED'

export interface HospitalAddress {
  line1?: string
  city?: string
  country?: string
  [key: string]: unknown
}

export interface Hospital {
  id: string
  tenant_id: string
  subdomain: string | null
  custom_domain: string | null
  name: string
  legal_name: string | null
  display_name: string | null
  timezone: string
  locale: string
  address: HospitalAddress | null
  subscription_tier: SubscriptionTier
  billing_status: BillingStatus
  max_user_slots: number
  max_patient_records: number
  status: HospitalStatus
  is_sandbox: boolean
  core_org_id: string | null
  created_at: string | null
  updated_at: string | null
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

export interface HospitalListResponse {
  data: Hospital[]
  meta: PaginationMeta
}

export interface HospitalShowResponse {
  data: Hospital
}

// Payload for POST /v1/platform/hospitals (matches StoreHospitalRequest).
export interface CreateHospitalPayload {
  // identity & localization
  name: string
  legal_name?: string
  display_name?: string
  timezone?: string
  locale?: string
  address?: HospitalAddress
  // isolation
  subdomain?: string
  custom_domain?: string
  // billing & tiering
  subscription_tier?: SubscriptionTier
  billing_status?: BillingStatus
  payment_gateway_customer_id?: string
  max_user_slots?: number
  max_patient_records?: number
  // system
  status?: HospitalStatus
  is_sandbox?: boolean
  // optional first facility + admin
  facility?: { name: string }
  admin?: { name: string; username: string; email: string; password: string }
}

export interface CreateHospitalResponse {
  data: Hospital
  facility: { id: string; name: string; core_facility_id: string | null } | null
  admin: { id: number; username: string; email: string } | null
  core_provisioned: boolean
  core_provisioning_error: string | null
}

// Vuetify chip colors per enum value (used in list + detail views).
export const STATUS_COLOR: Record<HospitalStatus, string> = {
  PROVISIONING: 'info',
  ACTIVE: 'success',
  MAINTENANCE: 'warning',
  ARCHIVED: 'grey',
}

export const TIER_COLOR: Record<SubscriptionTier, string> = {
  BASIC: 'grey',
  PREMIUM: 'primary',
  ENTERPRISE: 'secondary',
}

export const BILLING_COLOR: Record<BillingStatus, string> = {
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  SUSPENDED: 'error',
}
