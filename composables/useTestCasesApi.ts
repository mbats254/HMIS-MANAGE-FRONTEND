import { useNuxtApp } from '#app'

/**
 * Manual test-management API (platform staff: testers / developers).
 *   GET  /v1/platform/staff/test-suites
 *   GET  /v1/platform/staff/test-suites/{slug}
 *   POST /v1/platform/staff/test-suites          (multipart upload)
 *   PUT  /v1/platform/staff/test-cases/{id}/result
 */
export function useTestCasesApi() {
  const { $axios } = useNuxtApp()
  const base = '/v1/platform/staff'

  async function listSuites() {
    const { data } = await $axios.get(`${base}/test-suites`)
    return data.data
  }

  async function getSuite(slug: string) {
    const { data } = await $axios.get(`${base}/test-suites/${slug}`)
    return data.data
  }

  async function uploadSuite(file: File) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await $axios.post(`${base}/test-suites`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  }

  async function recordResult(caseId: number, verdict: string, note?: string) {
    const { data } = await $axios.put(`${base}/test-cases/${caseId}/result`, { verdict, note })
    return data.data
  }

  async function createCase(payload: Record<string, any>) {
    const { data } = await $axios.post(`${base}/test-cases`, payload)
    return data
  }

  async function updateCase(caseId: number, payload: Record<string, any>) {
    const { data } = await $axios.put(`${base}/test-cases/${caseId}`, payload)
    return data
  }

  async function deleteCase(caseId: number) {
    const { data } = await $axios.delete(`${base}/test-cases/${caseId}`)
    return data
  }

  // --- A tester's own submissions + approval status ---
  async function myCases(status?: string) {
    const { data } = await $axios.get(`${base}/my-test-cases`, {
      params: status ? { status } : {},
    })
    return data as {
      data: Array<{
        id: number; case_id: string; title: string
        module_name: string; module_code: string | null
        suite_slug: string | null; suite_role: string | null
        approval_status: 'pending' | 'approved' | 'rejected'
        approval_note: string | null; approved_by: string | null
        approved_at: string | null; created_at: string | null
      }>
      meta: { pending: number; approved: number; rejected: number; total: number }
    }
  }

  // --- System-admin approval workflow ---
  async function pendingCases() {
    const { data } = await $axios.get(`${base}/pending-test-cases`)
    return data.data
  }

  async function approveCase(caseId: number, note?: string) {
    const { data } = await $axios.patch(`${base}/test-cases/${caseId}/approve`, { note })
    return data.data
  }

  async function rejectCase(caseId: number, note?: string) {
    const { data } = await $axios.patch(`${base}/test-cases/${caseId}/reject`, { note })
    return data.data
  }

  // --- Run history (every pass/fail over time) ---
  async function runHistory(params: Record<string, any> = {}) {
    const { data } = await $axios.get(`${base}/run-history`, { params })
    return data as {
      data: Array<{
        id: number; verdict: 'pass' | 'fail'; note: string | null; ran_at: string | null
        tester: string | null; case_id: string | null; case_title: string | null
        suite_slug: string | null; suite_role: string | null
      }>
      meta: { current_page: number; last_page: number; total: number; totals: { pass: number; fail: number } }
    }
  }

  return {
    listSuites, getSuite, uploadSuite, recordResult, createCase, updateCase, deleteCase,
    myCases, pendingCases, approveCase, rejectCase, runHistory,
  }
}
