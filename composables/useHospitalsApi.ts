import { useNuxtApp } from '#app'
import type {
  CreateHospitalPayload,
  CreateHospitalResponse,
  Hospital,
  HospitalListResponse,
  HospitalShowResponse,
  RetryProvisioningResponse,
} from '~/types/hospital'

/**
 * Read access to platform hospitals (organizations / tenants).
 * Backend:
 *   GET  /v1/platform/hospitals       (paginated)
 *   GET  /v1/platform/hospitals/{id}
 *   POST /v1/platform/hospitals/{id}/provision (retry core-service sync)
 */
export function useHospitalsApi() {
  const { $axios } = useNuxtApp()

  async function list(params: { page?: number; per_page?: number } = {}): Promise<HospitalListResponse> {
    const { data } = await $axios.get<HospitalListResponse>('/v1/platform/hospitals', { params })
    return data
  }

  async function show(id: string): Promise<Hospital> {
    const { data } = await $axios.get<HospitalShowResponse>(`/v1/platform/hospitals/${id}`)
    return data.data
  }

  async function create(payload: CreateHospitalPayload): Promise<CreateHospitalResponse> {
    const { data } = await $axios.post<CreateHospitalResponse>('/v1/platform/hospitals', payload)
    return data
  }

  async function retryProvisioning(id: string): Promise<RetryProvisioningResponse> {
    const { data } = await $axios.post<RetryProvisioningResponse>(`/v1/platform/hospitals/${id}/provision`)
    return data
  }

  return { list, show, create, retryProvisioning }
}
