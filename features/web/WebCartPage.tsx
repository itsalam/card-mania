import { useSubmitOffer } from '@/client/offers'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text/base-text'
import { centsToInputString, formatPrice, inputStringToCents } from '@/components/utils'
import { PriceModifiedBadge, pricesMatch } from '@/features/offers/ui'
import { CardImage } from '@/features/tcg-card-views/card-image'
import { getCardDisplayData } from '@/features/tcg-card-views/helpers'
import { useProfiles } from '@/features/users/client/load-user'
import { UserContact } from '@/features/users/components/UserAvatars'
import { useCartStore } from '@/lib/store/useCartStore'
import { Link, useRouter } from 'expo-router'
import { Minus, Plus, Trash2 } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { GradientBackground } from '@/components/Background'
import { AuthModal } from './AuthModal'
import { useWebUser } from './hooks/useWebUser'
import { NAV_CLEARANCE, NAV_TOP } from './layout-constants'
import { WebNav } from './WebNav'

export default function WebCartPage() {
  const currentUser = useWebUser()
  const { width } = useWindowDimensions()
  const isPortrait = width < 768
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [navQuery, setNavQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)
  const [buyerNote, setBuyerNote] = useState('')
  const router = useRouter()
  const { showToast } = useToast()

  const { items, removeItem, updateQuantity, updateItemPrice, clear } = useCartStore()
  const submitOffer = useSubmitOffer()

  // Group items by seller
  const sellerIds = [
    ...new Set(items.map((i) => (i.data as any).user_id).filter(Boolean)),
  ] as string[]
  const { data: profiles = {} } = useProfiles(sellerIds)

  const grouped = sellerIds.map((sellerId) => ({
    sellerId,
    profile: profiles[sellerId],
    items: items.filter((i) => (i.data as any).user_id === sellerId),
  }))
  const unsorted = items.filter((i) => !(i.data as any).user_id)
  if (unsorted.length > 0)
    grouped.push({ sellerId: '', profile: undefined as any, items: unsorted })

  const totalCents = items.reduce((s, i) => s + i.cart.price * i.cart.quantity, 0)

  async function handleSubmit() {
    if (items.length === 0) return
    try {
      for (const { sellerId, items: groupItems } of grouped) {
        if (!sellerId || groupItems.length === 0) continue
        await submitOffer.mutateAsync({
          seller_id: sellerId,
          buyer_note: buyerNote || undefined,
          total_amount: groupItems.reduce((s, i) => s + i.cart.price * i.cart.quantity, 0),
          items: groupItems.map((i) => ({
            collection_item_id: i.data.id,
            quantity: i.cart.quantity,
            offered_price_per_unit: i.cart.price,
            card_snapshot: {
              title: (i.data as any).name ?? undefined,
              set_name: (i.data as any).set_name ?? undefined,
              listing_price: i.cart.originalPrice,
            },
          })),
        })
      }
      showToast({ message: 'Offer sent!' })
      router.push('/offers' as any)
    } catch (e: any) {
      showToast({ message: e?.message ?? 'Failed to send offer' })
    }
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
          <Text variant="h2">Sign in to view your cart</Text>
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
            maxWidth: 680,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: 16,
            gap: 24,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 8,
            }}
          >
            <Text variant="h1" style={{ fontSize: 28, fontWeight: '700' }}>
              Cart
            </Text>
            {items.length > 0 && (
              <Pressable onPress={clear}>
                <Text variant="muted" style={{ fontSize: 13 }}>
                  Clear all
                </Text>
              </Pressable>
            )}
          </View>

          {items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 60, gap: 12 }}>
              <Text variant="h3" style={{ color: Colors.$textNeutral }}>
                Your cart is empty
              </Text>
              <Link href="/">
                <Text variant="muted" style={{ textDecorationLine: 'underline' }}>
                  Browse storefronts
                </Text>
              </Link>
            </View>
          ) : (
            <>
              {grouped.map(({ sellerId, profile, items: groupItems }) => (
                <View
                  key={sellerId || '__unsorted'}
                  style={{
                    borderWidth: 1,
                    borderColor: Colors.$outlineNeutral,
                    borderRadius: 16,
                    overflow: 'hidden',
                  }}
                >
                  {/* Seller header */}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 14,
                      borderBottomWidth: 1,
                      borderBottomColor: Colors.$outlineNeutral,
                    }}
                  >
                    {profile ? (
                      <UserContact
                        user={{
                          name: profile.display_name ?? profile.username ?? '',
                          handle: `@${profile.username ?? ''}`,
                          avatar: profile.avatar_url ?? '',
                        }}
                        size="sm"
                      />
                    ) : (
                      <Text variant="muted">Unknown seller</Text>
                    )}
                  </View>

                  {/* Items */}
                  {groupItems.map((cartItem) => {
                    const displayData = getCardDisplayData({
                      collectionItem: cartItem.data as any,
                      card: cartItem.data as any,
                    })
                    const priceChanged = !pricesMatch(
                      cartItem.cart.price,
                      cartItem.cart.originalPrice
                    )
                    return (
                      <View
                        key={cartItem.data.id}
                        style={{
                          flexDirection: 'row',
                          gap: 12,
                          padding: 14,
                          borderBottomWidth: 1,
                          borderBottomColor: Colors.$outlineNeutral,
                          alignItems: 'flex-start',
                        }}
                      >
                        <CardImage displayData={displayData} width={56} />
                        <View style={{ flex: 1, gap: 6 }}>
                          <Text
                            style={{ fontWeight: '600', color: Colors.$textDefault }}
                            numberOfLines={2}
                          >
                            {displayData?.title ?? '—'}
                          </Text>
                          {displayData?.subHeading ? (
                            <Text variant="muted" style={{ fontSize: 12 }} numberOfLines={1}>
                              {displayData.subHeading}
                            </Text>
                          ) : null}

                          {/* Price input */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text variant="muted" style={{ fontSize: 12 }}>
                              $
                            </Text>
                            <TextInput
                              defaultValue={centsToInputString(cartItem.cart.price)}
                              onEndEditing={(e) => {
                                const cents = inputStringToCents(e.nativeEvent.text)
                                if (cents != null) updateItemPrice(cartItem.data.id, cents)
                              }}
                              keyboardType="decimal-pad"
                              style={
                                {
                                  borderWidth: 1,
                                  borderColor: Colors.$outlineNeutral,
                                  borderRadius: 8,
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  fontSize: 14,
                                  color: Colors.$textDefault,
                                  width: 80,
                                  outlineStyle: 'none',
                                } as any
                              }
                            />
                            {priceChanged && (
                              <PriceModifiedBadge originalPrice={cartItem.cart.originalPrice} />
                            )}
                          </View>

                          {/* Qty stepper */}
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: Colors.$outlineNeutral,
                              backgroundColor: Colors.$backgroundElevated,
                              paddingHorizontal: 4,
                              paddingVertical: 2,
                              gap: 4,
                              alignSelf: 'flex-start',
                            }}
                          >
                            <Pressable
                              onPress={() => {
                                if (cartItem.cart.quantity <= 1) removeItem(cartItem.data.id)
                                else updateQuantity(cartItem.data.id, cartItem.cart.quantity - 1)
                              }}
                              style={{ padding: 6 }}
                            >
                              <Minus size={12} color={Colors.$textNeutral} />
                            </Pressable>
                            <Text
                              style={{
                                minWidth: 20,
                                textAlign: 'center',
                                fontSize: 13,
                                fontWeight: '500',
                              }}
                            >
                              {cartItem.cart.quantity}
                            </Text>
                            <Pressable
                              onPress={() => {
                                if (cartItem.cart.quantity < cartItem.cart.maxQuantity)
                                  updateQuantity(cartItem.data.id, cartItem.cart.quantity + 1)
                              }}
                              style={{ padding: 6 }}
                            >
                              <Plus size={12} color={Colors.$textNeutral} />
                            </Pressable>
                          </View>
                        </View>

                        {/* Remove + line total */}
                        <View
                          style={{
                            alignItems: 'flex-end',
                            alignSelf: 'stretch',
                            justifyContent: 'space-between',
                          }}
                        >
                          <Pressable
                            onPress={() => removeItem(cartItem.data.id)}
                            style={{ padding: 2 }}
                          >
                            <Trash2 size={15} color={Colors.$textDanger} />
                          </Pressable>
                          <View style={{ alignItems: 'flex-end', gap: 1 }}>
                            <Text variant="muted" style={{ fontSize: 11 }}>
                              {cartItem.cart.quantity} × {formatPrice(cartItem.cart.price)}
                            </Text>
                            <Text style={{ fontWeight: '700', fontSize: 16 }}>
                              {formatPrice(cartItem.cart.price * cartItem.cart.quantity)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    )
                  })}
                </View>
              ))}

              {/* Buyer note */}
              <View style={{ gap: 8 }}>
                <Text variant="muted" style={{ fontSize: 13 }}>
                  Note to seller (optional)
                </Text>
                <TextInput
                  value={buyerNote}
                  onChangeText={setBuyerNote}
                  placeholder="Add a note…"
                  placeholderTextColor={Colors.$textNeutralLight}
                  multiline
                  style={
                    {
                      borderWidth: 1,
                      borderColor: Colors.$outlineNeutral,
                      borderRadius: 12,
                      padding: 12,
                      fontSize: 14,
                      color: Colors.$textDefault,
                      minHeight: 72,
                      outlineStyle: 'none',
                    } as any
                  }
                />
              </View>

              {/* Total + submit */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                }}
              >
                <View>
                  <Text variant="muted" style={{ fontSize: 12 }}>
                    Total
                  </Text>
                  <Text style={{ fontSize: 24, fontWeight: '700' }}>{formatPrice(totalCents)}</Text>
                </View>
                <Button
                  onPress={handleSubmit}
                  disabled={submitOffer.isPending || items.length === 0}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {submitOffer.isPending ? 'Sending…' : 'Send Offer'}
                  </Text>
                </Button>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </GradientBackground>
  )
}
