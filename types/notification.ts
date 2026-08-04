// Mirrors NotificationController::index() on the backend (Laravel database notifications).

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
