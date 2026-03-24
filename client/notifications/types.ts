export type NotificationCategory = "offer" | "social" | "price" | "system"
export type NotificationPriority = "low" | "normal" | "high" | "urgent"

export type AppNotification = {
  id: string
  user_id: string
  type: string
  category: NotificationCategory
  priority: NotificationPriority
  title: string
  body: string
  image_url: string | null
  action_url: string | null
  payload: Record<string, unknown>
  read_at: string | null
  dismissed_at: string | null
  created_at: string
}
