import { GradientBackground } from '@/components/Background'
import { useMyTransactions } from '@/client/transactions'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Text } from '@/components/ui/text/base-text'
import { TransactionListCard } from '@/features/transactions/ui'
import { useRefresh } from '@/lib/hooks/useRefresh'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'

export default function TransactionsRoute() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const currentUserId = useUserStore((s) => s.user?.id)

  const {
    data: buying,
    isLoading: buyingLoading,
    refetch: refetchBuying,
  } = useMyTransactions('buyer')
  const {
    data: selling,
    isLoading: sellingLoading,
    refetch: refetchSelling,
  } = useMyTransactions('seller')
  const { refreshing, onRefresh } = useRefresh([refetchBuying, refetchSelling])

  const buyingCount = buying?.length ?? 0
  const sellingCount = selling?.length ?? 0

  return (
    <GradientBackground style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text variant="h1" style={styles.headerTitle}>
            Transactions
          </Text>
        </View>

        <Separator orientation="horizontal" />

        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <CollapsibleSection
            title="Buying"
            rightElement={
              !buyingLoading && buyingCount > 0 ? (
                <Text variant="muted" style={styles.count}>
                  {buyingCount}
                </Text>
              ) : undefined
            }
          >
            {buyingLoading ? (
              <LoadingSkeleton />
            ) : buyingCount === 0 ? (
              <EmptyState message="Accepted offers you make will appear here." />
            ) : (
              buying!.map((tx) => (
                <TransactionListCard
                  key={tx.id}
                  transaction={tx}
                  currentUserId={currentUserId}
                  onPress={() => router.push(`/transactions/${tx.offer_id}`)}
                />
              ))
            )}
          </CollapsibleSection>

          <Separator orientation="horizontal" />

          <CollapsibleSection
            title="Selling"
            rightElement={
              !sellingLoading && sellingCount > 0 ? (
                <Text variant="muted" style={styles.count}>
                  {sellingCount}
                </Text>
              ) : undefined
            }
          >
            {sellingLoading ? (
              <LoadingSkeleton />
            ) : sellingCount === 0 ? (
              <EmptyState message="Offers you accept will appear here." />
            ) : (
              selling!.map((tx) => (
                <TransactionListCard
                  key={tx.id}
                  transaction={tx}
                  currentUserId={currentUserId}
                  onPress={() => router.push(`/transactions/${tx.offer_id}`)}
                />
              ))
            )}
          </CollapsibleSection>
        </ScrollView>
      </View>
    </GradientBackground>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyInner}>
      <Text variant="default" style={{ color: Colors.$textNeutralLight, textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  )
}

function LoadingSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <View key={i} style={skeletonStyles.row}>
          <Skeleton style={skeletonStyles.avatar} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton style={skeletonStyles.line} />
            <Skeleton style={skeletonStyles.lineShort} />
          </View>
        </View>
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
  },
  list: {
    paddingBottom: 24,
  },
  count: {
    fontSize: 13,
    color: Colors.$textNeutralLight,
  },
  emptyInner: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
})

const skeletonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.$outlineDefault,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  line: { height: 13, borderRadius: 4, width: '60%' },
  lineShort: { height: 12, borderRadius: 4, width: '40%' },
})
