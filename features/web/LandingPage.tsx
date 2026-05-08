/**
 * Marketing landing page — web only.
 *
 * Rendered at `/` on the Vercel-deployed web build.
 * Intentionally kept as a single self-contained file until brand + copy
 * decisions are finalised (ITS-19 / ITS-20).
 *
 * TODO: replace placeholder copy + colours once brand identity lands.
 */
import { Text } from '@/components/ui/text/base-text'
import { Link } from 'expo-router'
import React from 'react'
import { Linking, Pressable, ScrollView, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

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
        backgroundColor: secondary
          ? 'transparent'
          : Colors.$backgroundPrimaryLight ?? '#3B82F6',
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
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: Colors.$backgroundDefault }}
      contentContainerStyle={{ minHeight: '100vh' as any }}
    >
      {/* ── Nav ────────────────────────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: Colors.$outlineNeutralLight,
        }}
      >
        <Text variant="large" style={{ fontWeight: '700', letterSpacing: -0.5 }}>
          CardMania
        </Text>
      </View>

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
          <CTAButton label="Download on App Store" onPress={() => Linking.openURL(APP_STORE_URL)} />
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
      {SAMPLE_USERNAMES.length > 0 && (
        <View
          style={{
            alignItems: 'center',
            paddingVertical: 48,
            paddingHorizontal: 24,
            borderTopWidth: 1,
            borderTopColor: Colors.$outlineNeutralLight,
            gap: 12,
          }}
        >
          <Text variant="h3" style={{ textAlign: 'center' }}>
            See a live storefront
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {SAMPLE_USERNAMES.map((handle) => (
              <Link key={handle} href={`/${handle}` as any}>
                <Text
                  variant="default"
                  style={{
                    color: Colors.$textPrimary ?? '#3B82F6',
                    textDecorationLine: 'underline',
                    fontWeight: '500',
                  }}
                >
                  @{handle}
                </Text>
              </Link>
            ))}
          </View>
        </View>
      )}

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
  )
}
