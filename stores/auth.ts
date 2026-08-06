import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useNuxtApp, useCookie } from '#app'
import { useTenantStore } from '~/stores/tenant'
import { tenancyErrorMessage } from '~/types/tenancy'

export interface LoginFacility {
  id: string
  name: string
  organization_id: string
  organization_name: string
}

export interface LoginSystem {
  id: string
  name: string
  is_default: boolean
}

export interface AuthUser {
  id: number
  name: string
  email: string
  platform_role: string | null
  roles: string[]
  permissions: string[]
}

/**
 * Two-step authentication against the HMIS backend:
 *   Step 1: POST /login {email, password, step:1}  -> facilities to choose from
 *   Step 2: POST /login {email, password, step:2, facility_id} -> token + session
 *
 * Backend has /logout (revokes token) and /user (current user).
 */
export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()
  const { $axios, $showToast } = useNuxtApp()

  const cookieOpts = { sameSite: 'lax' as const, path: '/', httpOnly: false }

  const cookieToken = useCookie<string | null>('auth_token', cookieOpts)

  // In Nuxt 3 SPA mode the ref returned by useCookie can transiently read back
  // null during a client-side navigation. The previous code only restored from
  // localStorage once, at store setup — so when the ref dropped its value
  // mid-session the global middleware saw isAuthenticated === false and bounced
  // the user to /auth/login on the next page click.
  //
  // Fix: a plain ref is the source of truth, mirrored OUT to the cookie and
  // localStorage. Navigation can no longer clear the session.
  const readPersistedToken = (): string | null => {
    if (cookieToken.value) return cookieToken.value
    if (import.meta.client) {
      try {
        return localStorage.getItem('_auth_token')
      } catch {
        return null // storage blocked (private mode) — cookie still carries it
      }
    }
    return null
  }

  const token = ref<string | null>(readPersistedToken())

  watch(token, (val) => {
    cookieToken.value = val
    if (!import.meta.client) return
    try {
      if (val) localStorage.setItem('_auth_token', val)
      else localStorage.removeItem('_auth_token')
    } catch {
      // storage unavailable — the cookie mirror above is enough
    }
  }, { immediate: true })

  const user = ref<AuthUser | null>(null)
  const apiError = ref('')

  // Step-1 -> Step-2 transient state.
  const step = ref<'idle' | 'system' | 'facility'>('idle')
  const facilities = ref<LoginFacility[]>([])
  const systems = ref<LoginSystem[]>([])
  const activeSystem = ref<LoginSystem | null>(null)
  const organization = ref<{ id: string | null; name: string; logo: string | null } | null>(null)
  const pendingCredentials = ref<{ username: string; password: string } | null>(null)
  const isSelectingFacility = ref(false)
  const isSelectingSystem = ref(false)

  // Persist the chosen system for display / auto-context after reload.
  const systemId = useCookie<string | null>('hmis_system_id', cookieOpts)

  const isAuthenticated = computed(() => !!token.value)
  const roles = computed(() => user.value?.roles ?? [])

  // Platform account type (system_admin/developer/tester/qa) or null for tenant users.
  const platformRole = computed(() => user.value?.platform_role ?? null)
  // System admin = top-level superuser with access to everything.
  const isSystemAdmin = computed(() => platformRole.value === 'system_admin')
  const isDeveloper = computed(() => platformRole.value === 'developer')
  const isTester = computed(() => platformRole.value === 'tester')
  // QA = run-only tester: works with existing tests but cannot author them.
  const isQa = computed(() => platformRole.value === 'qa')
  const isPlatformUser = computed(
    () => isSystemAdmin.value || isDeveloper.value || isTester.value || isQa.value,
  )
  // Hospital admin: driven by the real tenant role_key returned in user.roles.
  const isHospitalAdmin = computed(
    () => !isPlatformUser.value && roles.value.includes('hospital_admin'),
  )
  // Anyone with cross-tenant "sees everything" access.
  const isSuperAccess = computed(() => isSystemAdmin.value || isDeveloper.value)
  // Who may create/edit/delete/upload test cases (QA excluded; system admin allowed).
  const canAuthorTests = computed(() => isSystemAdmin.value || isDeveloper.value || isTester.value)
  // Who may approve/reject pending test cases (developers + system admin).
  const canApproveTests = computed(() => isSystemAdmin.value || isDeveloper.value)

  const applyToken = (t: string | null) => {
    if (t) $axios.defaults.headers.common['Authorization'] = `Bearer ${t}`
    else delete $axios.defaults.headers.common['Authorization']
  }
  applyToken(token.value)
  watch(token, (val) => applyToken(val), { immediate: true })

  const resetLoginState = () => {
    step.value = 'idle'
    facilities.value = []
    systems.value = []
    organization.value = null
    pendingCredentials.value = null
    isSelectingFacility.value = false
    isSelectingSystem.value = false
  }

  // Store the token + user from a completed login response and finish up.
  const finishLogin = async (data: any) => {
    token.value = data.access_token
    applyToken(data.access_token)
    user.value = data.user
    if (data.system) {
      activeSystem.value = data.system
      systemId.value = data.system.id
    }
    resetLoginState()
    $showToast('Signed in successfully!')
    await router.push('/dashboard')
  }

  // ── Step 1: credentials -> facility list ──────────────────────────────
  const login = async (values: { username: string; password: string }) => {
    apiError.value = ''
    try {
      const { data } = await $axios.post('/v1/platform/login', {
        username: values.username,
        password: values.password,
        step: 1,
      })

      // Platform users with a single system sign in directly — the backend
      // returns a token immediately.
      if (data.access_token) {
        await finishLogin(data)
        return { success: true, platformRole: data.platform_role ?? null }
      }

      // Platform user with more than one system -> choose a system first.
      if (data.step === 'system') {
        step.value = 'system'
        systems.value = data.systems || []
        pendingCredentials.value = values
        return { requiresSystemSelection: true }
      }

      if (data.step === 2) {
        step.value = 'facility'
        facilities.value = data.facilities || []
        organization.value = data.organization || null
        pendingCredentials.value = values
        return { requiresFacilitySelection: true }
      }

      // (Backend returns either a token or step 2; this branch is a safety net.)
      return { success: true }
    } catch (err: any) {
      apiError.value = tenancyErrorMessage(
        err?.response?.data?.code,
        err?.response?.data?.message || 'Login failed.',
      )
      $showToast(apiError.value)
      return { error: apiError.value }
    }
  }

  // ── Choose system -> issue token (platform users) ─────────────────────
  const selectSystemAndLogin = async (chosenSystemId: string) => {
    apiError.value = ''
    if (!pendingCredentials.value) {
      apiError.value = 'Session expired. Please login again.'
      $showToast(apiError.value)
      resetLoginState()
      return { error: apiError.value }
    }

    isSelectingSystem.value = true
    try {
      const { data } = await $axios.post('/v1/platform/login', {
        username: pendingCredentials.value.username,
        password: pendingCredentials.value.password,
        step: 1,
        system_id: chosenSystemId,
      })

      if (data.access_token) {
        await finishLogin(data)
        return { success: true, platformRole: data.platform_role ?? null }
      }

      // Safety net: unexpected shape.
      return { error: 'Could not complete system selection.' }
    } catch (err: any) {
      apiError.value = tenancyErrorMessage(
        err?.response?.data?.code,
        err?.response?.data?.message || 'System selection failed.',
      )
      $showToast(apiError.value)
      return { error: apiError.value }
    } finally {
      isSelectingSystem.value = false
    }
  }

  const cancelSystemSelection = () => resetLoginState()

  // ── Step 2: choose facility -> issue token ────────────────────────────
  const selectFacilityAndLogin = async (facilityId: string) => {
    apiError.value = ''
    if (!pendingCredentials.value) {
      apiError.value = 'Session expired. Please login again.'
      $showToast(apiError.value)
      resetLoginState()
      return { error: apiError.value }
    }

    isSelectingFacility.value = true
    try {
      const { data } = await $axios.post('/v1/platform/login', {
        username: pendingCredentials.value.username,
        password: pendingCredentials.value.password,
        step: 2,
        facility_id: facilityId,
      })

      token.value = data.access_token
      applyToken(data.access_token)
      user.value = data.user

      // Hydrate the tenant store for the rest of the app.
      const tenant = useTenantStore()
      tenant.lastEmail = data.user?.email ?? pendingCredentials.value.username
      await tenant.loadContext()

      resetLoginState()
      $showToast('Signed in successfully!')
      await router.push('/dashboard')
      return { success: true }
    } catch (err: any) {
      isSelectingFacility.value = false
      apiError.value = tenancyErrorMessage(
        err?.response?.data?.code,
        err?.response?.data?.message || 'Facility selection failed.',
      )
      $showToast(apiError.value)
      return { error: apiError.value }
    }
  }

  const cancelFacilitySelection = () => resetLoginState()

  // ── In-session facility switch (no password) ──────────────────────────
  const isSwitchingFacility = ref(false)
  const switchFacility = async (facilityId: string) => {
    apiError.value = ''
    isSwitchingFacility.value = true
    try {
      const { data } = await $axios.post('/v1/platform/switch-facility', {
        facility_id: facilityId,
      })

      token.value = data.access_token
      applyToken(data.access_token)

      // Refresh the tenant context so names/active facility reflect the switch.
      await useTenantStore().loadContext()

      $showToast(`Switched to ${data.facility?.name ?? 'facility'}.`)
      return { success: true }
    } catch (err: any) {
      apiError.value = tenancyErrorMessage(
        err?.response?.data?.code,
        err?.response?.data?.message || 'Could not switch facility.',
      )
      $showToast(apiError.value)
      return { error: apiError.value }
    } finally {
      isSwitchingFacility.value = false
    }
  }

  // ── In-session system switch (no password) ────────────────────────────
  const isSwitchingSystem = ref(false)
  const switchSystem = async (targetSystemId: string) => {
    apiError.value = ''
    isSwitchingSystem.value = true
    try {
      const { data } = await $axios.post('/v1/platform/select-system', {
        system_id: targetSystemId,
      })

      token.value = data.access_token
      applyToken(data.access_token)
      if (data.system) {
        activeSystem.value = data.system
        systemId.value = data.system.id
      }

      $showToast(`Switched to ${data.system?.name ?? 'system'}.`)
      return { success: true }
    } catch (err: any) {
      apiError.value = tenancyErrorMessage(
        err?.response?.data?.code,
        err?.response?.data?.message || 'Could not switch system.',
      )
      $showToast(apiError.value)
      return { error: apiError.value }
    } finally {
      isSwitchingSystem.value = false
    }
  }

  const logout = async () => {
    try {
      await $axios.post('/v1/platform/logout')
    } catch {
      // proceed regardless — token may already be invalid
    } finally {
      token.value = null
      if (import.meta.client) localStorage.removeItem('_auth_token')
      applyToken(null)
      user.value = null
      systemId.value = null
      activeSystem.value = null
      resetLoginState()
      useTenantStore().clear()
      $showToast('Logged out.')
      await router.push('/auth/login')
    }
  }

  const fetchCurrentUser = async () => {
    try {
      const { data } = await $axios.get('/v1/platform/user')
      user.value = data.data
      return user.value
    } catch {
      return null
    }
  }

  const hasRole = (r: string) => roles.value.includes(r)

  return {
    token,
    user,
    apiError,
    step,
    facilities,
    systems,
    activeSystem,
    systemId,
    organization,
    isSelectingFacility,
    isSelectingSystem,
    isSwitchingFacility,
    isSwitchingSystem,
    isAuthenticated,
    roles,
    platformRole,
    isSystemAdmin,
    isDeveloper,
    isTester,
    isQa,
    isPlatformUser,
    isHospitalAdmin,
    isSuperAccess,
    canAuthorTests,
    canApproveTests,
    login,
    selectSystemAndLogin,
    cancelSystemSelection,
    selectFacilityAndLogin,
    cancelFacilitySelection,
    switchFacility,
    switchSystem,
    logout,
    fetchCurrentUser,
    hasRole,
  }
})
