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
import { useCartPanelStore } from '@/lib/store/useCartPanelStore'
import { useCartStore } from '@/lib/store/useCartStore'
import { Link, useRouter } from 'expo-router'
import { Minus, Plus, Trash2, X } from 'lucide-react-native'
import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View, useWindowDimensions } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export function CartPanel() {
  const { open, setOpen } = useCartPanelStore()
  const { width } = useWindowDimensions()
  const isPortrait = width < 768
  const [buyerNote, setBuyerNote] = useState('')
  const router = useRouter()
  const { showToast } = useToast()

  const { items, removeItem, updateQuantity, updateItemPrice } = useCartStore()
  const submitOffer = useSubmitOffer()

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
      setOpen(false)
      router.push('/offers' as any)
    } catch (e: any) {
      showToast({ message: e?.message ?? 'Failed to send offer' })
    }
  }

  const panelStyle: any = isPortrait
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: '70vh',
        zIndex: 200,
        backgroundColor: Colors.$backgroundDefault,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: Colors.$outlineNeutral,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.25s ease',
        overflow: 'hidden',
      }
    : {
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 440,
        zIndex: 200,
        backgroundColor: Colors.$backgroundDefault,
        borderLeftWidth: 1,
        borderColor: Colors.$outlineNeutral,
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        overflow: 'hidden',
      }

  return (
    <>
      {isPortrait && open && (
        <Pressable
          onPress={() => setOpen(false)}
          style={
            {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.4)',
              zIndex: 199,
            } as any
          }
        />
      )}

      <View style={panelStyle}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: isPortrait ? 16 : 52,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: Colors.$outlineNeutral,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '700' }}>Cart</Text>
          <Pressable onPress={() => setOpen(false)} style={{ padding: 4 }}>
            <X size={20} color={Colors.$textDefault} />
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 16 }}>
          {items.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40, gap: 8 }}>
              <Text variant="h3" style={{ color: Colors.$textNeutral }}>
                Your cart is empty
              </Text>
              <Link href="/" onPress={() => setOpen(false)}>
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
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
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
                          gap: 10,
                          padding: 12,
                          borderBottomWidth: 1,
                          borderBottomColor: Colors.$outlineNeutral,
                          alignItems: 'flex-start',
                        }}
                      >
                        <CardImage displayData={displayData} width={48} />
                        <View style={{ flex: 1, gap: 4 }}>
                          <View>
                            <Text
                              style={{
                                fontWeight: '600',
                                color: Colors.$textDefault,
                                fontSize: 13,
                                lineHeight: 14,
                              }}
                              numberOfLines={2}
                            >
                              {displayData?.title ?? '—'}
                            </Text>
                            {displayData?.subHeading ? (
                              <Text variant="muted" style={{ fontSize: 11 }} numberOfLines={1}>
                                {displayData.subHeading}
                              </Text>
                            ) : null}
                          </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {/* Price input */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
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
                                    borderRadius: 6,
                                    paddingHorizontal: 4,
                                    paddingVertical: 4,
                                    fontSize: 18,
                                    color: Colors.$textDefault,
                                    // minWidth: 70,
                                    maxWidth: 95,
                                    flexShrink: 1,
                                    flexGrow: 0,
                                    outlineStyle: 'none',
                                  } as any
                                }
                              />
                              {priceChanged && (
                                <PriceModifiedBadge originalPrice={cartItem.cart.originalPrice} />
                              )}
                            </View>

                            {/* Pill stepper */}
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
                            <Trash2 size={14} color={Colors.$textDanger} />
                          </Pressable>
                          <View style={{ alignItems: 'flex-end', gap: 1 }}>
                            <Text variant="muted" style={{ fontSize: 10 }}>
                              {cartItem.cart.quantity} × {formatPrice(cartItem.cart.price)}
                            </Text>
                            <Text style={{ fontWeight: '700', fontSize: 14 }}>
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
              <View style={{ gap: 6 }}>
                <Text variant="muted" style={{ fontSize: 12 }}>
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
                      borderRadius: 10,
                      padding: 10,
                      fontSize: 13,
                      color: Colors.$textDefault,
                      minHeight: 56,
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
                  paddingTop: 4,
                }}
              >
                <View>
                  <Text variant="muted" style={{ fontSize: 11 }}>
                    Total
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: '700' }}>{formatPrice(totalCents)}</Text>
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

              {/* View full cart */}
              <Link href="/cart" onPress={() => setOpen(false)} asChild>
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: Colors.$outlineNeutral,
                    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.6),
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: Colors.$textNeutral }}>
                    View full cart
                  </Text>
                  <Text style={{ fontSize: 13, color: Colors.$textNeutralLight }}>→</Text>
                </Pressable>
              </Link>
            </>
          )}
        </ScrollView>
      </View>
    </>
  )
}
