import { GradientBackground } from '@/components/Background'
import { Text } from '@/components/ui/text/base-text'
import { useSetting } from '@/features/settings'
import LocationPicker from '@/features/settings/components/location-picker'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import type { LucideIcon } from 'lucide-react-native'
import { LogOut, Monitor, Moon, Settings, Sun } from 'lucide-react-native'
import React, { ReactNode, useEffect, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

// Directly observes the `dark` class on <html> — stays in sync with ThemeProvider
function useDarkClass() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const mo = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    )
    mo.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])
  return isDark
}
import { AuthModal } from './AuthModal'
import { useWebUser } from './hooks/useWebUser'
import { NAV_CLEARANCE, NAV_TOP } from './layout-constants'
import { WebNav } from './WebNav'

// ─── Layout helpers ──────────────────────────────────────────────────────────

function SectionCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 5 }}>
      <Text
        variant="muted"
        style={{
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          paddingHorizontal: 4,
          color: Colors.$textNeutralLight,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.3),
          backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
          overflow: 'hidden',
        }}
      >
        {children}
      </View>
    </View>
  )
}

function SettingsRow({
  label,
  last,
  children,
}: {
  label: string
  last?: boolean
  children: ReactNode
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderBottomWidth: last ? 0 : 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.2),
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 15, color: Colors.$textDefault }}>{label}</Text>
      {children}
    </View>
  )
}

// ─── Shared pill-toggle container (matches CLAUDE.md design system) ──────────
// Computed as a function so Colors tokens are read at render time, not module load

function pillContainer() {
  return {
    flexDirection: 'row' as const,
    backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
    borderWidth: 1,
    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
    borderRadius: 999,
    padding: 3,
    gap: 2,
  }
}

// ─── Theme toggle ─────────────────────────────────────────────────────────────

const THEME_ITEMS: { value: 'light' | 'dark' | 'system'; Icon: LucideIcon }[] = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'system', Icon: Monitor },
]

function ThemeToggle() {
  const { value, set } = useSetting('themeMode')

  return (
    <View style={pillContainer()}>
      {THEME_ITEMS.map(({ value: v, Icon }) => {
        const active = value === v
        return (
          <Pressable
            key={v}
            onPress={() => set(v)}
            style={{
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: active
                ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35)
                : 'transparent',
            }}
          >
            <Icon size={15} color={active ? Colors.$backgroundPrimaryHeavy : Colors.$iconNeutral} />
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Currency toggle ──────────────────────────────────────────────────────────

const CURRENCIES = ['CAD', 'USD', 'TWD'] as const

function CurrencyToggle() {
  const { value, set } = useSetting('priceCurrency')

  return (
    <View style={pillContainer()}>
      {CURRENCIES.map((c) => {
        const active = value === c
        return (
          <Pressable
            key={c}
            onPress={() => set(c)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: active
                ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35)
                : 'transparent',
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '500',
                color: active ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral,
              }}
            >
              {c}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function LocationMapPreview() {
  const loc = useSetting('location').value
  const isDark = useDarkClass()
  if (!loc?.latitude || !loc?.longitude) return null
  const { latitude: lat, longitude: lon, viewport } = loc as any
  const west = viewport?.low?.longitude ?? lon - 0.08
  const south = viewport?.low?.latitude ?? lat - 0.08
  const east = viewport?.high?.longitude ?? lon + 0.08
  const north = viewport?.high?.latitude ?? lat + 0.08
  return (
    <View
      style={{
        height: 180,
        overflow: 'hidden',
        borderBottomWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.2),
      }}
    >
      {React.createElement('iframe', {
        src: `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=hot&marker=${lat},${lon}`,
        style: {
          width: '100%',
          height: '100%',
          border: 'none',
          filter: isDark
            ? 'grayscale(0.45) invert(1) hue-rotate(180deg) brightness(0.82) saturate(0.5) contrast(1.05)'
            : 'grayscale(0.15) saturate(0.8) contrast(1.05)',
        },
        loading: 'lazy',
        title: 'Current location',
      } as any)}
    </View>
  )
}

export default function WebSettingsPage() {
  const currentUser = useWebUser()
  const { signOut } = useUserStore()
  const router = useRouter()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.replace('/')
  }

  if (!currentUser) {
    return (
      <GradientBackground style={{ flex: 1 }}>
        <WebNav
          currentUser={null}
          scrolled={scrolled}
          onSignInPress={() => setShowAuthModal(true)}
        />
        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Settings size={40} color={Colors.$iconNeutral} />
          <Text variant="h2">Sign in to view settings</Text>
          <Pressable
            onPress={() => setShowAuthModal(true)}
            style={{
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: Colors.$backgroundPrimaryHeavy,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Sign in</Text>
          </Pressable>
        </View>
      </GradientBackground>
    )
  }

  return (
    <GradientBackground style={{ flex: 1 }}>
      <WebNav
        currentUser={currentUser}
        scrolled={scrolled}
        onSignInPress={() => setShowAuthModal(true)}
      />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: NAV_CLEARANCE + NAV_TOP,
          paddingBottom: 60,
        }}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 10)}
        scrollEventThrottle={16}
      >
        <View
          style={{
            maxWidth: 720,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: 16,
            gap: 16,
          }}
        >
          <Text
            style={{ fontSize: 20, fontWeight: '600', color: Colors.$textDefault, paddingTop: 4 }}
          >
            Settings
          </Text>

          {/* ── Appearance ── */}
          <SectionCard label="Appearance">
            <SettingsRow label="Theme" last>
              <ThemeToggle />
            </SettingsRow>
          </SectionCard>

          {/* ── Preferences ── */}
          <SectionCard label="Preferences">
            {/* Location row — LocationPicker owns its trigger layout */}
            <View
              style={{
                paddingHorizontal: 12,
                borderBottomWidth: 1,
                borderColor: Colors.rgba(Colors.$outlineNeutral, 0.2),
              }}
            >
              <LocationPicker>
                <Text style={{ fontSize: 15, color: Colors.$textDefault }}>Location</Text>
              </LocationPicker>
            </View>

            {/* Static map of saved location */}
            <LocationMapPreview />

            <SettingsRow label="Currency" last>
              <CurrencyToggle />
            </SettingsRow>
          </SectionCard>

          {/* ── Account ── */}
          <SectionCard label="Account">
            <Pressable
              onPress={handleSignOut}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 16,
                paddingVertical: 11,
              }}
            >
              <LogOut size={16} color={Colors.$textDanger} />
              <Text style={{ color: Colors.$textDanger, fontSize: 15 }}>Sign out</Text>
            </Pressable>
          </SectionCard>
        </View>
      </ScrollView>
    </GradientBackground>
  )
}
