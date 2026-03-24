import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import {
  useDismissNotification,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useUnreadCount,
} from '@/client/notifications'
import { AppNotification, NotificationCategory } from '@/client/notifications/types'
import { useRouter } from 'expo-router'
import { Bell, Inbox, TrendingDown, Users } from 'lucide-react-native'
import React, { useState } from 'react'
import { FlatList, Pressable, StyleSheet, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// ── helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function dateSeparatorLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  if (isSameDay(d, today)) return 'Today'
  if (isSameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── category icon ─────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<NotificationCategory, string> = {
  offer: Colors.$backgroundPrimaryHeavy,
  social: Colors.$backgroundSuccessHeavy,
  price: Colors.$backgroundWarningHeavy,
  system: Colors.$backgroundNeutralMedium,
}

function CategoryIcon({ category }: { category: NotificationCategory }) {
  const bg = CATEGORY_COLORS[category]
  const IconComponent = {
    offer: Inbox,
    social: Users,
    price: TrendingDown,
    system: Bell,
  }[category]

  return (
    <View style={[styles.iconCircle, { backgroundColor: bg }]}>
      <IconComponent size={16} color="#fff" />
    </View>
  )
}

// ── NotificationRow ───────────────────────────────────────────────────────────

function NotificationRow({ notification }: { notification: AppNotification }) {
  const router = useRouter()
  const markRead = useMarkRead(notification.id)
  const dismiss = useDismissNotification(notification.id)
  const isUnread = notification.read_at === null

  const handlePress = () => {
    markRead.mutate()
    if (notification.action_url) {
      router.push(notification.action_url as Parameters<typeof router.push>[0])
    }
  }

  const handleLongPress = () => {
    dismiss.mutate()
  }

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={[
        styles.row,
        {
          borderLeftColor: isUnread ? Colors.$backgroundPrimaryHeavy : 'transparent',
        },
      ]}
    >
      <CategoryIcon category={notification.category} />

      <View style={styles.rowContent}>
        <Text
          style={[styles.rowTitle, { fontWeight: isUnread ? '600' : '400' }]}
          numberOfLines={1}
        >
          {notification.title}
        </Text>
        <Text style={[styles.rowBody, { color: Colors.$textNeutral }]} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={[styles.rowTime, { color: Colors.$textNeutralLight }]}>
          {relativeTime(notification.created_at)}
        </Text>
      </View>

      {isUnread && <View style={styles.unreadDot} />}
    </Pressable>
  )
}

// ── SkeletonCard ──────────────────────────────────────────────────────────────

function SkeletonCard() {
  return <Skeleton height={80} style={styles.skeletonCard} />
}

// ── category chips ────────────────────────────────────────────────────────────

type ChipOption = { label: string; value: 'all' | NotificationCategory }

const CHIPS: ChipOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Offers', value: 'offer' },
  { label: 'Social', value: 'social' },
  { label: 'Price', value: 'price' },
  { label: 'System', value: 'system' },
]

// ── list item types ───────────────────────────────────────────────────────────

type ListItem =
  | { type: 'separator'; label: string; key: string }
  | { type: 'notification'; data: AppNotification; key: string }

function buildListItems(notifications: AppNotification[]): ListItem[] {
  const items: ListItem[] = []
  let lastLabel = ''

  for (const n of notifications) {
    const label = dateSeparatorLabel(n.created_at)
    if (label !== lastLabel) {
      items.push({ type: 'separator', label, key: `sep-${label}` })
      lastLabel = label
    }
    items.push({ type: 'notification', data: n, key: n.id })
  }

  return items
}

// ── main component ────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const insets = useSafeAreaInsets()
  const [selectedCategory, setSelectedCategory] = useState<'all' | NotificationCategory>('all')

  const category = selectedCategory !== 'all' ? selectedCategory : undefined
  const { data: notifications, isLoading } = useNotifications(category)
  const { data: unreadCount = 0 } = useUnreadCount()
  const markAllRead = useMarkAllRead()

  const listItems = buildListItems(notifications ?? [])

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'separator') {
      return (
        <View style={styles.separator}>
          <Text style={styles.separatorText}>{item.label}</Text>
        </View>
      )
    }
    return <NotificationRow notification={item.data} />
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text variant="h1">Notifications</Text>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onPress={() => markAllRead.mutate()}
          >
            Mark all read
          </Button>
        )}
      </View>

      {/* Category chips */}
      <View style={styles.chipsRow}>
        {CHIPS.map((chip) => (
          <Button
            key={chip.value}
            size="sm"
            variant={selectedCategory === chip.value ? 'primary' : 'outline'}
            onPress={() => setSelectedCategory(chip.value)}
            style={styles.chip}
          >
            {chip.label}
          </Button>
        ))}
      </View>

      {/* List */}
      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Bell size={40} color={Colors.$textNeutralLight} />
              <Text style={{ color: Colors.$textNeutralLight, marginTop: 12 }}>
                No notifications
              </Text>
            </View>
          }
        />
      )}
    </View>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    marginRight: 0,
  },
  listContent: {
    paddingBottom: 24,
  },
  separator: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  separatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.$textNeutralLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.$backgroundElevated,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderLeftWidth: 3,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
  },
  rowBody: {
    fontSize: 13,
  },
  rowTime: {
    fontSize: 11,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.$backgroundPrimaryHeavy,
  },
  skeletonContainer: {
    padding: 16,
    gap: 8,
  },
  skeletonCard: {
    borderRadius: 10,
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
})
