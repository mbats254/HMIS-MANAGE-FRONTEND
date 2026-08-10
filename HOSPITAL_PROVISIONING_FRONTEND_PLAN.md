# Hospital Provisioning — Frontend Alignment Plan (v2)

## What changed since v1

Nothing proposed in v1 was ever built — `types/hospital.ts`, `stores/hospitals.ts`,
`pages/hospitals/new.vue`, and `pages/hospitals/[id].vue` are byte-for-byte the
same "gap" state v1 described. What changed is the platform around them: the
backend gained a real notifications system since v1 was written —


- `NotificationController` (`GET /v1/platform/notifications`,
  `POST /notifications/{id}/read`, `POST /notifications/read-all`) is live and
  routed (`routes/api.php:61-63`).
- `App\Models\User` uses Laravel's `Notifiable` trait; four Notification
  classes already exist as precedent (`app/Notifications/ReportAssigned.php`,
  `NewReportSubmitted.php`, `ReportUpdated.php`, `TestCaseApproval.php`), each
  `via() => ['mail', 'database']` with a `toArray()` for the in-app feed.
- On the frontend, the bell dropdown (`components/lc/Full/vertical-header/NotificationDD.vue`)
  still renders **hardcoded mock data** from `_mockApis/headerData.ts` — it
  has never been wired to the real endpoint. There is no
  `useNotificationsApi.ts` composable and no `stores/notifications.ts`.

**Decision for this revision:** route the core-service provisioning failure
through this real notification system — a system admin who isn't the one who
clicked "Register" (or who navigates away first) should still see it — *in
addition to* the immediate inline result panel from v1. A notification alone
is wrong for the person who just submitted the form: they'd have to go check
the bell right after clicking submit instead of seeing the outcome inline.

Everything else in v1's context section (the three-step `store()` behavior,
the partial-success shape of the response, why this matters) is unchanged —
see git history for the original if needed. This revision folds it in below
rather than repeating it.

## Gaps — backend

1. No Notification class for provisioning failure. Mirror
   `ReportAssigned.php`'s shape: `via()`, `toMail()` (optional but consistent
   with precedent), `toArray()` with an `event` key the frontend can switch
   on (e.g. `'hospital.provisioning_failed'`).
2. `CoreServiceProvisioner::provision()` only logs and returns
   `error` — nothing calls `->notify()`. The call site
   (`HospitalController::store`, around line 174) already branches on
   `$coreIds['core_org_id']` being null; that's where `->notify()` belongs.
3. Recipient isn't decided. Recommend: the creating user
   (`$request->user()`) **and** every `system_admin` platform user (query
   similar to whatever backs `PlatformController::hospitals`'s
   `system_admin`-only guard), deduplicated so the creator isn't notified
   twice if they're also a system admin.

## Gaps — frontend

Carried over from v1, still unbuilt:

1. `types/hospital.ts` — `Hospital` has no `core_org_id`; `CreateHospitalResponse`
   has no `facility.core_facility_id`, `core_provisioned`, or
   `core_provisioning_error`, though the backend already returns all four
   (`HospitalController::present()` and `store()`).
2. `stores/hospitals.ts` — `create()` returns the response and the caller
   discards it; nothing retains it for display.
3. `pages/hospitals/new.vue` — `submit()` redirects unconditionally
   (`router.push('/hospitals/{id}')`) regardless of provisioning outcome.
4. `pages/hospitals/[id].vue` — no "Core Service Provisioning" section, even
   though `core_org_id` is already in the `GET /hospitals/{id}` response.

New in this revision:

5. No `types/notification.ts`, `composables/useNotificationsApi.ts`, or
   `stores/notifications.ts` — the real endpoint has no client at all.
6. `NotificationDD.vue` needs its data source swapped from
   `_mockApis/headerData.ts` to the real store, plus an unread badge (backend
   already returns `unread` count in the `index` response) and mark-read
   wiring (both single and "mark all" already have live endpoints).

## Out of scope (no backend support exists — don't build client code that calls nothing)

- **Retry button for failed provisioning.** Still no retry endpoint;
  `CoreServiceProvisioner`'s doc comment says this is future work.
- **Facilities/admins list on the hospital detail page.** Still no
  `GET /hospitals/{id}/facilities` or `/admins` route.
- **Editing an already-created org/facility/admin.** `HospitalController`
  still only has `index`/`show`/`store`.
- **Real-time push for notifications.** The Notification classes only
  declare `mail` and `database` channels — no `broadcast` channel, no
  Reverb/Pusher/Echo config found in either repo. Fetch-on-mount (and
  fetch-on-menu-open, since it's a hover/click dropdown) is enough; don't add
  a websocket listener for a channel the backend doesn't broadcast on.

## Proposed changes

### Backend

**1. `app/Notifications/HospitalProvisioningFailed.php`** (new)

```php
class HospitalProvisioningFailed extends Notification
{
    public function __construct(
        public Organization $organization,
        public string $error,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'event' => 'hospital.provisioning_failed',
            'organization_id' => $this->organization->id,
            'organization_name' => $this->organization->name,
            'error' => $this->error,
            'message' => sprintf(
                'Core-service provisioning failed for "%s". The hospital was created but is not yet synced.',
                $this->organization->name,
            ),
        ];
    }

    public function toMail(object $notifiable): MailMessage { /* mirror ReportAssigned's style */ }
}
```

**2. `HospitalController::store()`** — after the existing `if ($coreIds['core_org_id'])` block, add the failure branch:

```php
if (! $coreIds['core_org_id']) {
    $recipients = User::query()
        ->where('id', $request->user()->id)
        ->orWhere(/* system_admin platform role condition */)
        ->get()
        ->unique('id');

    Notification::send($recipients, new HospitalProvisioningFailed(
        $result['organization'],
        $coreIds['error'] ?? 'Unknown error',
    ));
}
```

### Frontend

**3. `types/hospital.ts`** — unchanged from v1:

```ts
export interface Hospital {
  // ...existing fields...
  core_org_id: string | null
}

export interface CreateHospitalResponse {
  data: Hospital
  facility: { id: string; name: string; core_facility_id: string | null } | null
  admin: { id: number; username: string; email: string } | null
  core_provisioned: boolean
  core_provisioning_error: string | null
}
```

**4. `stores/hospitals.ts`** — unchanged from v1: keep `lastCreateResult` alongside the existing return.

**5. `pages/hospitals/new.vue`** — unchanged from v1: swap the unconditional
redirect for a result panel showing facility/admin/provisioning status, with
a single "Done" button that does the redirect. This is the *inline* half of
the feedback loop — it fires from the same response the backend already
returns, no extra request.

**6. `pages/hospitals/[id].vue`** — unchanged from v1: add the "Core Service
Provisioning" card keyed off `core_org_id`.

**7. `types/notification.ts`** (new)

```ts
export interface PlatformNotification {
  id: string
  read: boolean
  data: {
    event: string
    message: string
    [key: string]: unknown
  }
  created_at: string | null
}

export interface NotificationListResponse {
  data: PlatformNotification[]
  unread: number
}
```

**8. `composables/useNotificationsApi.ts`** (new) — same shape as
`useHospitalsApi.ts`:

```ts
export function useNotificationsApi() {
  const { $axios } = useNuxtApp()

  async function list(): Promise<NotificationListResponse> {
    const { data } = await $axios.get<NotificationListResponse>('/v1/platform/notifications')
    return data
  }
  async function markRead(id: string) {
    await $axios.post(`/v1/platform/notifications/${id}/read`)
  }
  async function markAllRead() {
    await $axios.post('/v1/platform/notifications/read-all')
  }

  return { list, markRead, markAllRead }
}
```

**9. `stores/notifications.ts`** (new) — Pinia store holding `items`,
`unread`, `fetch()`, `markRead(id)`, `markAllRead()`, following the same
loading/error pattern as `stores/hospitals.ts`.

**10. `NotificationDD.vue`** — replace the `_mockApis/headerData.ts` import
with the new store: fetch on menu open (`@update:modelValue` on the
`v-menu`, or on mount — either is fine, this dropdown has no polling
elsewhere in the app to match), render `item.data.message` /
`created_at` instead of the mock `title`/`subtitle`/`time`/`avatar` fields,
show the real `unread` count in the chip instead of the hardcoded "5 New",
call `markRead` on item click, wire the "See all Notifications" button to
`markAllRead` (or drop it if there's no `/notifications` page to link to —
confirm before building a link to a route that doesn't exist, same rule as
the Out of Scope section above).

## Testing checklist

- Register a hospital with facility + admin; core-service reachable: result
  panel shows "Synced to core-service"; no notification is created (this is
  the success path, not the failure path — confirm nothing fires).
- Break `CORE_SERVICE_APP_SECRET` (or stop core-service) and register again:
  hospital still created, result panel shows the warning state, **and** the
  bell dropdown (as a different system-admin session, or the same one after
  navigating away) shows the new `hospital.provisioning_failed` notification
  with unread count incremented.
- Click the notification: it marks read (unread count decrements) and — if a
  deep link is built — lands on `/hospitals/{id}`.
- "Mark all read" clears the unread badge.
- Register with "Add facility"/"Create admin" both off: result panel shows
  the neutral "not attempted" state; no notification (nothing to fail).
- Open `/hospitals/{id}` for a pre-existing hospital with `core_org_id` null:
  card degrades to the warning state without crashing.
