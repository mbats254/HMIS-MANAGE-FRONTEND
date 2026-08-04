import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useHospitalsApi } from '~/composables/useHospitalsApi'
import type { CreateHospitalPayload, CreateHospitalResponse, Hospital, PaginationMeta } from '~/types/hospital'

export const useHospitalsStore = defineStore('hospitals', () => {
  const api = useHospitalsApi()

  const items = ref<Hospital[]>([])
  const meta = ref<PaginationMeta | null>(null)
  const current = ref<Hospital | null>(null)
  const loading = ref(false)
  const error = ref('')
  const saving = ref(false)
  // Full response from the most recent create() call, kept around so the
  // caller can render provisioning outcome instead of only reading it once.
  const lastCreateResult = ref<CreateHospitalResponse | null>(null)
  // Field-level validation errors from the backend (422), keyed by field name.
  const fieldErrors = ref<Record<string, string[]>>({})

  async function fetchList(page = 1, perPage = 25) {
    loading.value = true
    error.value = ''
    try {
      const res = await api.list({ page, per_page: perPage })
      items.value = res.data
      meta.value = res.meta
    } catch (err: any) {
      error.value = err?.response?.data?.message || 'Failed to load hospitals.'
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string) {
    loading.value = true
    error.value = ''
    current.value = null
    try {
      current.value = await api.show(id)
    } catch (err: any) {
      error.value =
        err?.response?.status === 404
          ? 'Hospital not found.'
          : err?.response?.data?.message || 'Failed to load hospital.'
    } finally {
      loading.value = false
    }
  }

  async function create(payload: CreateHospitalPayload) {
    saving.value = true
    error.value = ''
    fieldErrors.value = {}
    try {
      const res = await api.create(payload)
      lastCreateResult.value = res
      return { success: true as const, data: res }
    } catch (err: any) {
      if (err?.response?.status === 422) {
        fieldErrors.value = err.response.data?.errors || {}
        error.value = err.response.data?.message || 'Please fix the highlighted fields.'
      } else {
        error.value = err?.response?.data?.message || 'Failed to create hospital.'
      }
      return { success: false as const }
    } finally {
      saving.value = false
    }
  }

  return { items, meta, current, loading, error, saving, fieldErrors, lastCreateResult, fetchList, fetchOne, create }
})
