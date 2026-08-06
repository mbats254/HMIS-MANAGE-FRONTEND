// Route guard: every page requires a session except the auth pages.
// Unauthenticated users are redirected to the login page. Authenticated users
// are also kept out of pages their account type isn't allowed to see, so
// typing a URL directly can't bypass the role-filtered sidebar.

// Which account types may access a given path prefix. Omitted = everyone.
const ROLE_ROUTES: { prefix: string; roles: string[] }[] = [
  // More specific prefixes first (first match wins).
  // NOTE: system_admin bypasses ALL of these (see below) — so these lists only
  // gate the NON-system-admin roles.
  { prefix: '/hospitals/new', roles: ['system_admin'] },   // only system admin creates hospitals
  { prefix: '/hospitals', roles: ['system_admin', 'hospital_admin'] },
  { prefix: '/my-test-cases', roles: ['developer', 'tester'] }, // authors' own submissions
  { prefix: '/test-cases/new', roles: ['developer', 'tester'] }, // authoring only
  { prefix: '/test-cases', roles: ['developer', 'tester', 'qa'] },
  { prefix: '/test-approvals', roles: ['developer', 'system_admin'] }, // devs approve too
  { prefix: '/systems', roles: ['system_admin'] },
  { prefix: '/tester-activity', roles: ['system_admin'] },
  // /run-history is open to all platform users — no rule needed.
  { prefix: '/feedback-admin', roles: ['system_admin'] },
  { prefix: '/work', roles: ['developer'] }, // system_admin bypasses this check
  // /feedback (submit + my reports) is open to everyone — no rule.
]

export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  const isAuthRoute = to.path.startsWith('/auth')

  // Not signed in -> only auth pages are reachable.
  if (!auth.isAuthenticated && !isAuthRoute) {
    return navigateTo('/auth/login')
  }

  // Already signed in -> keep users out of the login/auth screens.
  if (auth.isAuthenticated && isAuthRoute) {
    return navigateTo('/dashboard')
  }

  // Send the bare root to the dashboard for signed-in users.
  if (auth.isAuthenticated && to.path === '/') {
    return navigateTo('/dashboard')
  }

  // Role-gating for known feature areas.
  if (auth.isAuthenticated) {
    // After a hard reload the token cookie persists but the user object does
    // not — hydrate it before deciding the role, or we'd misroute (client only).
    if (import.meta.client && !auth.user) {
      await auth.fetchCurrentUser()
    }

    // If the user still could not be hydrated (slow backend, transient error)
    // we don't know their role — skip client-side gating rather than misroute
    // them to /dashboard. The API enforces permissions on every request anyway.
    if (!auth.user) return

    // System admin is a superuser — every route is allowed.
    if (!auth.isSystemAdmin) {
      const role = auth.platformRole ?? 'hospital_admin'
      const rule = ROLE_ROUTES.find((r) => to.path.startsWith(r.prefix))
      if (rule && !rule.roles.includes(role)) {
        return navigateTo('/dashboard')
      }
    }
  }
})
