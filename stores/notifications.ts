import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useNotificationsApi } from '~/composables/useNotificationsApi'
import type { PlatformNotification } from '~/types/notification'

export const useNotificationsStore = defineStore('notifications', () => {
  const api = useNotificationsApi()

  const items = ref<PlatformNotification[]>([])
  const unread = ref(0)
  const loading = ref(false)
  const error = ref('')

  async function fetch() {
    loading.value = true
    error.value = ''
    try {
      const res = await api.list()
      items.value = res.data
      unread.value = res.unread
    } catch (err: any) {
      error.value = err?.response?.data?.message || 'Failed to load notifications.'
    } finally {
      loading.value = false
    }
  }

  async function markRead(id: string) {
    const item = items.value.find((n) => n.id === id)
    if (!item || item.read) return
    try {
      await api.markRead(id)
      item.read = true
      unread.value = Math.max(0, unread.value - 1)
    } catch (err: any) {
      error.value = err?.response?.data?.message || 'Failed to mark notification read.'
    }
  }

  async function markAllRead() {
    try {
      await api.markAllRead()
      items.value.forEach((n) => (n.read = true))
      unread.value = 0
    } catch (err: any) {
      error.value = err?.response?.data?.message || 'Failed to mark all notifications read.'
    }
  }

  return { items, unread, loading, error, fetch, markRead, markAllRead }
})
