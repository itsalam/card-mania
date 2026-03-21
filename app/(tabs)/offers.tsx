import { BuyerHistoryPage } from '@/features/offers/buyer-history'
import { OfferInboxPage } from '@/features/offers/index'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text/base-text'

type Tab = 'inbox' | 'my-offers'

export default function OffersRoute() {
  const [tab, setTab] = useState<Tab>('inbox')
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.tabBar}>
        <Button
          variant={tab === 'inbox' ? 'primary' : 'outline'}
          size="lg"
          onPress={() => setTab('inbox')}
          style={styles.tabButton}
        >
          <Text
            style={[
              tab === 'inbox' ? styles.tabTextActive : styles.tabText,
              { color: Colors.$textDefault },
            ]}
          >
            Inbox
          </Text>
        </Button>
        <Button
          variant={tab === 'my-offers' ? 'primary' : 'outline'}
          size="lg"
          onPress={() => setTab('my-offers')}
          style={styles.tabButton}
        >
          <Text
            style={[
              tab === 'my-offers' ? styles.tabTextActive : styles.tabText,
              { color: Colors.$textDefault },
            ]}
          >
            My Offers
          </Text>
        </Button>
      </View>
      {tab === 'inbox' ? <OfferInboxPage /> : <BuyerHistoryPage />}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  tabButton: {
    flex: 1,
  },
  tabText: {
    fontSize: 14,
  },
  tabTextActive: {
    fontSize: 14,
    fontWeight: '600',
  },
})
