import { useMyTransactions } from '@/client/transactions'
import { Text } from '@/components/ui/text/base-text'
import { TransactionListCard } from '@/features/transactions/ui'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { GradientBackground } from '@/components/Background'
import { AuthModal } from './AuthModal'
import { useWebUser } from './hooks/useWebUser'
import { NAV_CLEARANCE, NAV_TOP } from './layout-constants'
import { WebNav } from './WebNav'

export default function WebTransactionsPage() {
  const currentUser = useWebUser()
  const userId = useUserStore((s) => s.user?.id)
  const { width } = useWindowDimensions()
  const isPortrait = width < 768
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [navQuery, setNavQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const router = useRouter()

  const { data: buying, isLoading: buyingLoading } = useMyTransactions('buyer')
  const { data: selling, isLoading: sellingLoading } = useMyTransactions('seller')

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
          <Text variant="h2">Sign in to view transactions</Text>
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
        searchQuery={navQuery}
        onSearchChange={setNavQuery}
        onSignInPress={() => setShowAuthModal(true)}
      />
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: isPortrait ? 8 : NAV_CLEARANCE + NAV_TOP,
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
            gap: 24,
          }}
        >
          <Text variant="h1" style={{ fontSize: 28, fontWeight: '700', paddingTop: 8 }}>
            Transactions
          </Text>

          <Section
            label="Buying"
            isLoading={buyingLoading}
            transactions={buying ?? []}
            currentUserId={userId}
            onPress={(t) => router.push(`/transactions/${t.offer_id}` as any)}
          />
          <Section
            label="Selling"
            isLoading={sellingLoading}
            transactions={selling ?? []}
            currentUserId={userId}
            onPress={(t) => router.push(`/transactions/${t.offer_id}` as any)}
          />
        </View>
      </ScrollView>
    </GradientBackground>
  )
}

function Section({
  label,
  isLoading,
  transactions,
  currentUserId,
  onPress,
}: {
  label: string
  isLoading: boolean
  transactions: any[]
  currentUserId: string | undefined
  onPress: (t: any) => void
}) {
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 2,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: Colors.$textNeutral,
          }}
        >
          {label}
        </Text>
        {!isLoading && transactions.length > 0 && (
          <View
            style={{
              backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.12),
              borderRadius: 999,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{ fontSize: 11, fontWeight: '600', color: Colors.$backgroundPrimaryHeavy }}
            >
              {transactions.length}
            </Text>
          </View>
        )}
      </View>
      {isLoading ? (
        <ActivityIndicator style={{ alignSelf: 'flex-start', marginLeft: 4 }} />
      ) : transactions.length === 0 ? (
        <Text variant="muted" style={{ paddingHorizontal: 2 }}>
          No {label.toLowerCase()} transactions.
        </Text>
      ) : (
        <View
          style={{
            borderWidth: 1,
            borderColor: Colors.$outlineNeutral,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {transactions.map((t) => (
            <TransactionListCard
              key={t.id}
              transaction={t}
              currentUserId={currentUserId}
              onPress={() => onPress(t)}
            />
          ))}
        </View>
      )}
    </View>
  )
}
