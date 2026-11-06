// Push notification preferences (ITS-62).
//
// Design refs (Mobbin):
// - Shop, notification toggles with a one-line description under each label:
//   https://mobbin.com/screens/d8acef45-0f2b-48b6-a2ab-ae7ab42f08f1
// - Jomo, grouped sections plus a master on/off switch:
//   https://mobbin.com/screens/a2cc786d-6daa-42d7-86b4-f440a5d52604
// - Stardust, time values shown as tappable rows in the toggle list:
//   https://mobbin.com/screens/771937b0-9a87-4c49-857a-559e07a58f2a
import {
  deviceTimeZone,
  isPushPlatform,
  PushPreferences,
  registerForPush,
  usePushPreferences,
  useSetPushPreferences,
} from '@/client/notifications/push'
import { NotificationCategory } from '@/client/notifications/types'
import { Switch } from '@/components/ui/switch'
import { Text } from '@/components/ui/text/base-text'
import { SettingRow } from '@/features/collection/pages/modify-collection/components'
import { reportError } from '@/lib/utils/report-error'
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker'
import * as Notifications from 'expo-notifications'
import { useFocusEffect, useRouter } from 'expo-router'
import {
  ArrowLeftRight,
  Bell,
  BellOff,
  ChevronLeft,
  Clock,
  Inbox,
  LucideIcon,
  Moon,
  Sunrise,
  TrendingDown,
  Users,
} from 'lucide-react-native'
import { ReactNode, useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'

const CATEGORIES: {
  key: NotificationCategory
  label: string
  description: string
  icon: LucideIcon
}[] = [
  { key: 'offer', label: 'Offers', description: 'New offers and responses to yours.', icon: Inbox },
  {
    key: 'transaction',
    label: 'Transactions',
    description: 'Payment, shipping and delivery updates.',
    icon: ArrowLeftRight,
  },
  {
    key: 'price',
    label: 'Price alerts',
    description: 'Wishlist hits and price changes on cards you track.',
    icon: TrendingDown,
  },
  {
    key: 'social',
    label: 'Social',
    description: 'Followers and activity on your profile.',
    icon: Users,
  },
  {
    key: 'system',
    label: 'Account & app',
    description: 'Security and service announcements.',
    icon: Bell,
  },
]

type OsPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported'

export function NotificationSettingsPage() {
  const router = useRouter()
  const { data: prefs, isLoading } = usePushPreferences()
  const setPrefs = useSetPushPreferences()
  const [permission, setPermission] = useState<OsPermission>(
    isPushPlatform ? 'undetermined' : 'unsupported'
  )
  const [canAskAgain, setCanAskAgain] = useState(true)

  // Re-read on focus: the user may come back from the OS Settings app.
  useFocusEffect(
    useCallback(() => {
      if (!isPushPlatform) return
      Notifications.getPermissionsAsync().then((p) => {
        setPermission(p.status as OsPermission)
        setCanAskAgain(p.canAskAgain)
        if (p.status === 'granted') {
          registerForPush({ prompt: false }).catch((error) =>
            reportError({ context: 'NotificationSettings.register', error })
          )
        }
      })
    }, [])
  )

  const enableOsPush = () => {
    if (!canAskAgain) {
      Linking.openSettings()
      return
    }
    registerForPush({ prompt: true })
      .then((r) => setPermission(r === 'registered' ? 'granted' : (r as OsPermission)))
      .catch((error) => reportError({ context: 'NotificationSettings.enable', error }))
  }

  const patchQuietHours = (patch: Partial<PushPreferences['quiet_hours']>) =>
    setPrefs.mutate({ quiet_hours: { ...patch, tz: deviceTimeZone() } })

  const masterOn = Boolean(prefs?.enabled)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.$backgroundDefault }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <ChevronLeft size={24} color={Colors.$iconDefault} />
        </TouchableOpacity>
        <Text variant="large" style={{ fontSize: 18, fontWeight: '600' }}>
          Notifications
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 20 }}>
        {permission === 'unsupported' ? (
          <Banner
            icon={BellOff}
            title="Push isn't available here"
            body="Push notifications work in the iOS and Android apps on a physical device. Your preferences below still apply there."
          />
        ) : permission !== 'granted' ? (
          <Banner
            icon={BellOff}
            title="Push notifications are off"
            body={
              canAskAgain
                ? 'Turn them on to hear about offers and wishlist hits when the app is closed.'
                : 'Notifications are blocked for Card Mania. Turn them on in your device settings.'
            }
            action={canAskAgain ? 'Turn on' : 'Open settings'}
            onAction={enableOsPush}
          />
        ) : null}

        {isLoading || !prefs ? (
          <ActivityIndicator color={Colors.$iconNeutral} style={{ marginTop: 24 }} />
        ) : (
          <>
            <Section>
              <SettingRow
                icon={Bell}
                label="Allow push notifications"
                description="In-app notifications are always kept, even when push is off."
                right={
                  <Switch
                    checked={masterOn}
                    onCheckedChange={(v) => setPrefs.mutate({ enabled: v })}
                  />
                }
              />
            </Section>

            <Section label="Notify me about" dimmed={!masterOn}>
              {CATEGORIES.map((c) => (
                <SettingRow
                  key={c.key}
                  icon={c.icon}
                  label={c.label}
                  description={c.description}
                  right={
                    <Switch
                      disabled={!masterOn}
                      checked={Boolean(prefs.categories[c.key])}
                      onCheckedChange={(v) => setPrefs.mutate({ categories: { [c.key]: v } })}
                    />
                  }
                />
              ))}
            </Section>

            <Section label="Quiet hours" dimmed={!masterOn}>
              <SettingRow
                icon={Moon}
                label="Pause push overnight"
                description="Notifications still arrive in the app; urgent alerts always come through."
                right={
                  <Switch
                    disabled={!masterOn}
                    checked={prefs.quiet_hours.enabled}
                    onCheckedChange={(v) => patchQuietHours({ enabled: v })}
                  />
                }
              />
              {prefs.quiet_hours.enabled && (
                <>
                  <TimeRow
                    icon={Clock}
                    label="From"
                    value={prefs.quiet_hours.start}
                    disabled={!masterOn}
                    onChange={(start) => patchQuietHours({ start })}
                  />
                  <TimeRow
                    icon={Sunrise}
                    label="Until"
                    value={prefs.quiet_hours.end}
                    disabled={!masterOn}
                    onChange={(end) => patchQuietHours({ end })}
                  />
                </>
              )}
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({
  label,
  dimmed,
  children,
}: {
  label?: string
  dimmed?: boolean
  children: ReactNode
}) {
  return (
    <View style={{ gap: 6, opacity: dimmed ? 0.5 : 1 }}>
      {label && (
        <Text
          variant="small"
          style={{ fontSize: 13, color: Colors.$textNeutralLight, marginBottom: 2 }}
        >
          {label.toUpperCase()}
        </Text>
      )}
      <View style={{ gap: 14 }}>{children}</View>
    </View>
  )
}

function Banner({
  icon: Icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: LucideIcon
  title: string
  body: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        padding: 14,
        borderRadius: 14,
        backgroundColor: Colors.$backgroundElevated,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
      }}
    >
      <Icon size={20} color={Colors.$iconNeutral} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 14, fontWeight: '600' }}>{title}</Text>
        <Text style={{ fontSize: 13, color: Colors.$textNeutral, lineHeight: 18 }}>{body}</Text>
        {action && (
          <TouchableOpacity
            onPress={onAction}
            style={{
              alignSelf: 'flex-start',
              marginTop: 6,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: Colors.$backgroundPrimaryHeavy,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.$textDefaultLight }}>
              {action}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const toDate = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}
const toHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const formatTime = (hhmm: string) =>
  toDate(hhmm).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function TimeRow({
  icon,
  label,
  value,
  disabled,
  onChange,
}: {
  icon: LucideIcon
  label: string
  value: string
  disabled?: boolean
  onChange: (hhmm: string) => void
}) {
  // iOS: the compact picker is its own tappable pill. Android: open the dialog imperatively.
  // Web just shows the value.
  const right =
    Platform.OS === 'ios' ? (
      <DateTimePicker
        mode="time"
        display="compact"
        value={toDate(value)}
        disabled={disabled}
        onChange={(e, d) => e.type === 'set' && d && onChange(toHHMM(d))}
      />
    ) : (
      <TouchableOpacity
        disabled={disabled || Platform.OS !== 'android'}
        onPress={() =>
          DateTimePickerAndroid.open({
            mode: 'time',
            value: toDate(value),
            onChange: (e, d) => e.type === 'set' && d && onChange(toHHMM(d)),
          })
        }
        style={{
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        }}
      >
        <Text style={{ fontSize: 14 }}>{formatTime(value)}</Text>
      </TouchableOpacity>
    )

  return <SettingRow icon={icon} label={label} right={right} />
}
