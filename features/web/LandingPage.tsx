/**
 * Marketing landing page — web only.
 *
 * Rendered at `/` on the Vercel-deployed web build.
 * Intentionally kept as a single self-contained file until brand + copy
 * decisions are finalised (ITS-19 / ITS-20).
 *
 * TODO: replace placeholder copy + colours once brand identity lands.
 */
import { GradientBackground } from '@/components/Background'
import { Text } from '@/components/ui/text/base-text'
import React, { useState } from 'react'
import { Linking, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { AuthModal } from './AuthModal'
import { useWebUser } from './hooks/useWebUser'
import { NAV_CLEARANCE, NAV_TOP } from './layout-constants'
import StorefrontCTA from './StorefrontCTA'
import { WebNav } from './WebNav'

// ---------------------------------------------------------------------------
// Temporary placeholder data — swap for real assets once brand is confirmed
// ---------------------------------------------------------------------------
const APP_STORE_URL = 'https://apps.apple.com' // replace with real link
const PLAY_STORE_URL = 'https://play.google.com' // replace with real link
const SAMPLE_USERNAMES = ['johndoe'] // real usernames to showcase when ready

function CTAButton({
  label,
  onPress,
  secondary = false,
}: {
  label: string
  onPress: () => void
  secondary?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: secondary ? 'transparent' : (Colors.$backgroundPrimaryLight ?? '#3B82F6'),
        borderWidth: secondary ? 1 : 0,
        borderColor: Colors.$outlineNeutralLight,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 12,
        opacity: pressed ? 0.75 : 1,
        minWidth: 180,
        alignItems: 'center',
      })}
    >
      <Text
        variant="default"
        style={{
          fontWeight: '600',
          color: secondary ? Colors.$textNeutral : '#fff',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const currentUser = useWebUser()
  const { width } = useWindowDimensions()
  const isPortrait = width < 768

  return (
    <GradientBackground style={{ flex: 1 }}>
      <WebNav
        currentUser={currentUser}
        scrolled={scrolled}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSignInPress={() => setShowAuthModal(true)}
      />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          minHeight: '100vh' as any,
          paddingTop: isPortrait ? 8 : NAV_CLEARANCE + NAV_TOP,
        }}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 10)}
        scrollEventThrottle={16}
      >
        {/* ── Hero ───────────────────────────────────────────────────── */}

        <View
          style={{
            alignItems: 'center',
            paddingVertical: 80,
            paddingHorizontal: 24,
            gap: 20,
          }}
        >
          <Text
            variant="h1"
            style={{
              textAlign: 'center',
              maxWidth: 560,
              fontSize: 40,
              lineHeight: 48,
              fontWeight: '700',
            }}
          >
            Buy & Sell Sports Cards{`\n`}with Confidence
          </Text>

          <Text
            variant="muted"
            style={{
              textAlign: 'center',
              maxWidth: 440,
              fontSize: 18,
              lineHeight: 28,
              color: Colors.$textNeutralHeavy,
            }}
          >
            Build your collection. List your storefront. Connect with collectors worldwide.
          </Text>

          <View
            style={{
              flexDirection: 'row',
              gap: 12,
              marginTop: 12,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <CTAButton
              label="Download on App Store"
              onPress={() => Linking.openURL(APP_STORE_URL)}
            />
            <CTAButton
              label="Get it on Google Play"
              onPress={() => Linking.openURL(PLAY_STORE_URL)}
              secondary
            />
          </View>
        </View>

        {/* ── Feature highlights ─────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16,
            paddingHorizontal: 24,
            paddingBottom: 64,
            maxWidth: 900,
            alignSelf: 'center',
            width: '100%',
          }}
        >
          {[
            {
              icon: '🗂️',
              title: 'Manage Collections',
              body: 'Organise your cards by set, series, or custom tags.',
            },
            {
              icon: '🏪',
              title: 'Public Storefront',
              body: 'Share your store with a personal link: cardmania.app/you.',
            },
            {
              icon: '💬',
              title: 'Make Offers',
              body: 'Send and receive offers with real-time notifications.',
            },
            {
              icon: '📈',
              title: 'Live Prices',
              body: 'Market price data powered by eBay and PriceCharting.',
            },
          ].map(({ icon, title, body }) => (
            <View
              key={title}
              style={{
                backgroundColor: Colors.$backgroundElevated,
                borderRadius: 16,
                padding: 24,
                gap: 8,
                width: 200,
                flexGrow: 1,
                maxWidth: 260,
              }}
            >
              <Text style={{ fontSize: 28 }}>{icon}</Text>
              <Text variant="h3">{title}</Text>
              <Text variant="muted">{body}</Text>
            </View>
          ))}
        </View>

        {/* ── Sample storefront CTA ──────────────────────────────────── */}
        <StorefrontCTA />

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: Colors.$outlineNeutralLight,
            paddingVertical: 24,
            paddingHorizontal: 24,
            alignItems: 'center',
          }}
        >
          <Text variant="muted" style={{ textAlign: 'center' }}>
            © {new Date().getFullYear()} CardMania. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </GradientBackground>
  )
}
