import { useNuxtApp } from '#app'

export interface TesterVerdicts {
  pass: number
  fail: number
  untested: number
  executed: number
  total: number
}

export interface TesterActivityRow {
  id: number
  name: string
  username: string
  email: string
  // Anyone who runs test cases can appear here, so role is any platform role.
  role: 'tester' | 'qa' | 'developer' | 'system_admin'
  can_author: boolean
  verdicts: TesterVerdicts
  pass_rate: number
  authored: { suites: number; cases: number }
  last_active_at: string | null
}

export interface RecentVerdict {
  id: number
  user: string | null
  role: string | null
  verdict: 'pass' | 'fail'
  case_id: string | null
  case_title: string | null
  module: string | null
  module_code: string | null
  suite: string | null
  suite_slug: string | null
  note: string | null
  at: string | null
}

export interface ServiceCoverage {
  name: string
  total_cases: number
  tested_cases: number
  /** % of the service's cases that have been run — execution progress. */
  coverage: number
  /** Distinct roles owning cases here, and how many have run at least one. */
  roles_total: number
  roles_covered: number
  /** Roles with cases here that have run nothing — the real blind spots. */
  roles_pending: string[]
  pass: number
  fail: number
  outcome: 'pass' | 'fail' | 'none'
}

export interface TesterActivity {
  totals: { testers: number; qa: number; contributors?: number; pass: number; fail: number; executed: number }
  testers: TesterActivityRow[]
  recent: RecentVerdict[]
  services: ServiceCoverage[]
  range?: { from: string | null; to: string | null }
}

export interface ActivityDateRange {
  date_from?: string | null
  date_to?: string | null
}

/**
 * Developer-only: track testers' journey (verdicts, authored tests, activity).
 *   GET /v1/platform/staff/tester-activity?date_from=&date_to=
 */
export function useTesterActivityApi() {
  const { $axios } = useNuxtApp()

  async function fetch(range?: ActivityDateRange): Promise<TesterActivity> {
    const params: Record<string, string> = {}
    if (range?.date_from) params.date_from = range.date_from
    if (range?.date_to) params.date_to = range.date_to
    const { data } = await $axios.get('/v1/platform/staff/tester-activity', { params })
    return data.data
  }

  return { fetch }
}
