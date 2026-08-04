import { useNuxtApp } from '#app'
import type { NotificationListResponse } from '~/types/notification'

/**
 * Backend:
 *   GET  /v1/platform/notifications
 *   POST /v1/platform/notifications/{id}/read
 *   POST /v1/platform/notifications/read-all
 */
export function useNotificationsApi() {
  const { $axios } = useNuxtApp()

  async function list(): Promise<NotificationListResponse> {
    const { data } = await $axios.get<NotificationListResponse>('/v1/platform/notifications')
    return data
  }

  async function markRead(id: string): Promise<void> {
    await $axios.post(`/v1/platform/notifications/${id}/read`)
  }

  async function markAllRead(): Promise<void> {
    await $axios.post('/v1/platform/notifications/read-all')
  }

  return { list, markRead, markAllRead }
}
