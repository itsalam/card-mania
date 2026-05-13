import { useCardQuery } from '@/client/card'
import { useSubmitOffer } from '@/client/offers'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { thumbStyles } from '@/components/ui/modal'
import { NumberTicker } from '@/components/ui/number-ticker'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text'
import { centsToInputString, formatPrice, inputStringToCents } from '@/components/utils'
import type { CartItem } from '@/features/cart/types'
import { PriceModifiedBadge, pricesMatch } from '@/features/offers/ui'
import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { useProfiles } from '@/features/users/client/load-user'
import { UserContact } from '@/features/users/components/UserAvatars'
import { UserDisplayInfo } from '@/features/users/types'
import { useRouter } from 'expo-router'
import { EllipsisVertical, Pencil, Trash2 } from 'lucide-react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, TouchableOpacity } from 'react-native-ui-lib'
import { scheduleOnRN } from 'react-native-worklets'
import { getGradingDisplayString } from '../collection/helpers'
import { CardImage } from '../tcg-card-views/card-image'
import { getCardDisplayData } from '../tcg-card-views/helpers'
import {
  useCartItems,
  useCartTotal,
  useClearCart,
  useCloseCart,
  useRemoveFromCart,
  useSetTotalOverride,
  useTotalOverride,
  useUpdateCartPrice,
  useUpdateCartQuantity,
} from './hooks'

export function CartSheetInner() {
  const colorScheme = useEffectiveColorScheme()

  const insets = useSafeAreaInsets()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        keyboardAvoiding: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: screenHeight * 0.8,
        },
        sheet: {
          flex: 1,
          backgroundColor: Colors.$backgroundDefault,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 16,
          overflow: 'hidden',
        },
      }),
    [colorScheme, screenHeight]
  )
  const closeCart = useCloseCart()
  const clearCart = useClearCart()
  const router = useRouter()
  const items = useCartItems()
  const computedTotal = useCartTotal()
  const totalOverride = useTotalOverride()
  const setTotalOverride = useSetTotalOverride()
  const updatePrice = useUpdateCartPrice()
  const total = totalOverride ?? computedTotal
  const isTotalModified = totalOverride != null && !pricesMatch(totalOverride, computedTotal)
  const [editingTotal, setEditingTotal] = useState(false)
  const [totalInput, setTotalInput] = useState('')
  const { showToast } = useToast()

  const sellerIds = useMemo(
    () => [...new Set(items.map((i) => i.data.user_id).filter(Boolean))],
    [items]
  )
  const { data: profiles } = useProfiles(sellerIds)

  const groupedBySeller = useMemo(() => {
    const map = new Map<string, CartItem[]>()
    for (const item of items) {
      const sid = item.data.user_id
      if (!map.has(sid)) map.set(sid, [])
      map.get(sid)!.push(item)
    }
    return [...map.entries()]
  }, [items])
  const { mutateAsync: submitOffer, isPending } = useSubmitOffer()
  const { height: screenHeight } = useWindowDimensions()
  const { height: kbHeight } = useReanimatedKeyboardAnimation()

  const translateY = useSharedValue(screenHeight)
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 240, easing: Easing.out(Easing.ease) })
    backdropOpacity.value = withTiming(1, { duration: 200 })
  }, [backdropOpacity, translateY])

  const dismiss = () => {
    translateY.value = withTiming(
      screenHeight,
      { duration: 200, easing: Easing.in(Easing.ease) },
      (finished) => {
        if (finished) scheduleOnRN(closeCart)
      }
    )
    backdropOpacity.value = withTiming(0, { duration: 200 })
  }

  const panGesture = Gesture.Pan()
    .onChange((e) => {
      if (e.translationY > 0) translateY.value = e.translationY
    })
    .onEnd((e) => {
      if (e.translationY > screenHeight * 0.2 || e.velocityY > 900) {
        scheduleOnRN(dismiss)
      } else {
        translateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.ease) })
      }
    })

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))

  const kbContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: kbHeight.value }],
  }))

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))
  return (
    // box-none lets touches pass through to the backdrop/sheet children only
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 40 }]} pointerEvents="box-none">
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: Colors.rgba(Colors.$backgroundNeutralIdle, 0.5) },
          backdropStyle,
        ]}
      >
        <Pressable style={{ flex: 1 }} onPress={dismiss} />
      </Animated.View>

      <Animated.View style={[styles.keyboardAvoiding, kbContainerStyle]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheet, sheetStyle]}>
            <View style={thumbStyles.thumbContainer}>
              <View
                style={[
                  thumbStyles.thumb,
                  {
                    backgroundColor: Colors.rgba(Colors.$backgroundNeutralIdle, 0.8),
                    marginHorizontal: 'auto',
                  },
                ]}
              />
            </View>

            <View style={{ flex: 1, width: '100%', paddingTop: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: 12,
                }}
              >
                <Text variant="h2">Cart ({items.length})</Text>
                {items.length > 0 && (
                  <TouchableOpacity onPress={clearCart}>
                    <Text variant="small" style={{ color: Colors.$textDanger }}>
                      Clear all
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Separator orientation="horizontal" />

              {items.length === 0 ? (
                <View
                  style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}
                >
                  <Text style={{ color: Colors.$textNeutralLight }}>Your cart is empty</Text>
                </View>
              ) : (
                <>
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingVertical: 4 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {groupedBySeller.map(([sellerId, sellerItems], groupIdx) => {
                      const profile = profiles?.[sellerId]
                      const user: UserDisplayInfo = {
                        name: profile?.display_name ?? profile?.username ?? 'Unknown',
                        handle: `@${profile?.username ?? 'unknown'}`,
                        avatar: profile?.avatar_url ?? '',
                      }
                      return (
                        <View key={sellerId}>
                          {groupIdx > 0 && (
                            <Separator orientation="horizontal" style={{ marginVertical: 8 }} />
                          )}
                          <TouchableOpacity
                            onPress={() => router.push(`/user/${sellerId}` as any)}
                            style={{
                              paddingVertical: 8,
                              flexDirection: 'row',
                              alignItems: 'center',
                            }}
                          >
                            <UserContact user={profile ? user : undefined} size="sm" />
                          </TouchableOpacity>
                          {sellerItems.map((item, idx) => (
                            <View key={`${item.data.id}_${item.cart.quantity}`}>
                              <CartItemRow item={item} />
                              {idx < sellerItems.length - 1 && (
                                <Separator orientation="horizontal" />
                              )}
                            </View>
                          ))}
                        </View>
                      )
                    })}
                  </ScrollView>

                  <Separator orientation="horizontal" />

                  <View
                    style={{ paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), gap: 12 }}
                  >
                    <View style={{ gap: 4 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={cartStyles.totalText}>Total</Text>
                        {editingTotal ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={cartStyles.totalText}>$</Text>
                            <TextInput
                              autoFocus
                              value={totalInput}
                              onChangeText={setTotalInput}
                              onBlur={() => {
                                const cents = inputStringToCents(totalInput)
                                setEditingTotal(false)
                                if (cents !== null) {
                                  setTotalOverride(cents)
                                  const modifiedItems = items.filter(
                                    (i) => !pricesMatch(i.cart.price, i.cart.originalPrice)
                                  )
                                  if (modifiedItems.length > 0) {
                                    Alert.alert(
                                      'Reset item prices?',
                                      'Some items have custom per-unit prices. Reset all to their original listed prices?',
                                      [
                                        { text: 'Keep custom prices', style: 'cancel' },
                                        {
                                          text: 'Reset all',
                                          onPress: () => {
                                            for (const item of modifiedItems) {
                                              updatePrice(item.data.id, item.cart.originalPrice)
                                            }
                                          },
                                        },
                                      ]
                                    )
                                  }
                                }
                              }}
                              keyboardType="decimal-pad"
                              style={[cartStyles.priceInput, cartStyles.totalText]}
                            />
                          </View>
                        ) : (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View
                              style={[
                                {
                                  paddingHorizontal: 8,
                                  paddingVertical: 4,
                                  borderRadius: 6,
                                  borderWidth: isTotalModified ? 1 : 0,
                                  borderColor: Colors.rgba(Colors.$outlineDefault, 0.35),
                                },
                                isTotalModified && {
                                  backgroundColor: Colors.rgba(
                                    Colors.$backgroundPrimaryLight,
                                    0.18
                                  ),
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  cartStyles.totalText,
                                  isTotalModified && { color: Colors.$outlinePrimary },
                                ]}
                              >
                                {formatPrice(total)}
                              </Text>
                            </View>
                            <Pressable
                              onPress={() => {
                                setTotalInput(centsToInputString(total))
                                setEditingTotal(true)
                              }}
                              hitSlop={8}
                            >
                              <Pencil
                                size={16}
                                color={
                                  isTotalModified ? Colors.$outlinePrimary : Colors.$iconNeutral
                                }
                              />
                            </Pressable>
                          </View>
                        )}
                      </View>
                      {isTotalModified && (
                        <View style={{ alignSelf: 'flex-end' }}>
                          <PriceModifiedBadge originalPrice={computedTotal} label="From:" />
                        </View>
                      )}
                    </View>
                    <Button
                      size="lg"
                      disabled={isPending}
                      onPress={async () => {
                        const bySeller = new Map<string, CartItem[]>()
                        for (const item of items) {
                          const sellerId = item.data.user_id
                          if (!sellerId) continue
                          if (!bySeller.has(sellerId)) bySeller.set(sellerId, [])
                          bySeller.get(sellerId)!.push(item)
                        }

                        // Total override only applies cleanly to a single-seller cart.
                        // For multi-seller, each offer gets its own computed total.
                        const isSingleSeller = bySeller.size === 1

                        try {
                          await Promise.all(
                            [...bySeller.entries()].map(([seller_id, sellerItems]) => {
                              const sellerTotal = sellerItems.reduce(
                                (s, i) => s + i.cart.price * i.cart.quantity,
                                0
                              )
                              return submitOffer({
                                seller_id,
                                total_amount: isSingleSeller ? total : sellerTotal,
                                items: sellerItems.map((item) => ({
                                  collection_item_id: item.data.id,
                                  quantity: item.cart.quantity,
                                  offered_price_per_unit: item.cart.price,
                                  card_snapshot: {
                                    card_id: item.data.ref_id ?? undefined,
                                    title: item.data.name ?? undefined,
                                    set_name: item.data.set_name ?? undefined,
                                    listing_price: item.cart.originalPrice,
                                  },
                                })),
                              })
                            })
                          )
                          dismiss()
                          setTimeout(
                            () =>
                              showToast({
                                autoDismiss: 5000,
                                title: 'Offer sent!',
                                message: 'Your offer has been submitted.',
                                preset: 'general',
                              }),
                            2000
                          )
                        } catch (err) {
                          console.error('[CartSheet] submitOffer error', err)
                          showToast({
                            autoDismiss: 5000,
                            title: 'Error',
                            message: 'Failed to send offer. Please try again.',
                            preset: 'failure',
                          })
                        }
                      }}
                    >
                      <Text>{isPending ? 'Sending…' : 'Send Offer'}</Text>
                    </Button>
                  </View>
                </>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </View>
  )
}

function CartItemRow({ item }: { item: CartItem }) {
  const removeItem = useRemoveFromCart()
  const updateQuantity = useUpdateCartQuantity()
  const updatePrice = useUpdateCartPrice()
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const priceInputRef = useRef('')
  const committedRef = useRef(false)
  const { data: card, loading: cardLoading } = useCardQuery(item.data.ref_id)
  const displayData = useMemo(
    () => getCardDisplayData({ card, collectionItem: item.data }),
    [card, item.data]
  )
  const isPriceModified = !pricesMatch(item.cart.price, item.cart.originalPrice)

  const handlePriceSubmit = () => {
    const cents = inputStringToCents(priceInputRef.current)
    if (cents !== null) {
      committedRef.current = true
      updatePrice(item.data.id, cents)
    }
  }

  const handlePriceBlur = () => {
    if (!committedRef.current) {
      updatePrice(item.data.id, item.cart.originalPrice)
    }
    committedRef.current = false
    setEditingPrice(false)
  }

  return (
    <View style={{ paddingVertical: 10, gap: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <CardImage displayData={displayData} isLoading={cardLoading} />
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              alignSelf: 'stretch',
              flex: 1,
            }}
          >
            <View style={{ flex: 1, gap: 0, alignSelf: 'stretch' }}>
              <Text style={{ fontWeight: '600' }}>{card?.name ?? item.data.name ?? '—'}</Text>
              {(card?.set_name ?? item.data.set_name) && (
                <Text
                  variant={'muted'}
                  className="capitalize"
                  style={{ color: Colors.$textNeutralLight, lineHeight: 16 }}
                >
                  {card?.set_name ?? item.data.set_name}
                </Text>
              )}
              {item.data.grade_condition && (
                <Text variant="info" style={{ color: Colors.$textNeutralLight, lineHeight: 16 }}>
                  {getGradingDisplayString(item.data).slice(0, 2).join(' ')}
                </Text>
              )}
            </View>
            <View style={{ gap: 8 }}>
              <TouchableOpacity onPress={() => removeItem(item.data.id)} style={{ padding: 4 }}>
                <EllipsisVertical size={24} color={Colors.$textNeutralLight} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeItem(item.data.id)} style={{ padding: 4 }}>
                <Trash2 size={24} color={Colors.$textDanger} />
              </TouchableOpacity>
            </View>
          </View>
          <View
            style={{
              flex: 1,
              alignSelf: 'stretch',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              {editingPrice ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, lineHeight: 32 }}>$</Text>
                  <TextInput
                    autoFocus
                    value={priceInput}
                    onChangeText={(text) => {
                      priceInputRef.current = text
                      setPriceInput(text)
                    }}
                    onSubmitEditing={handlePriceSubmit}
                    onBlur={handlePriceBlur}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    style={[cartStyles.priceInput, { fontSize: 30, lineHeight: 32 }]}
                  />
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{
                      fontSize: 30,
                      lineHeight: 32,
                      color: isPriceModified ? Colors.$outlinePrimary : Colors.$textDefault,
                    }}
                  >
                    {formatPrice(item.cart.price)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      const initial = centsToInputString(item.cart.price)
                      priceInputRef.current = initial
                      setPriceInput(initial)
                      setEditingPrice(true)
                    }}
                    hitSlop={8}
                  >
                    <Pencil
                      size={14}
                      color={isPriceModified ? Colors.$outlinePrimary : Colors.$iconNeutral}
                    />
                  </Pressable>
                </View>
              )}
            </View>
            <View style={{ gap: 4, alignItems: 'flex-end' }}>
              <NumberTicker
                key={`${item.data.id}_${item.cart.quantity}`}
                min={1}
                max={item.data.quantity}
                initialNumber={item.cart.quantity}
                onChangeNumber={(n) => updateQuantity(item.data.id, n)}
                containerStyle={{ height: 32 }}
              />
              <View style={{ gap: isPriceModified ? 4 : 0 }}>
                <Text
                  variant="small"
                  style={[
                    {
                      color: Colors.$textNeutralLight,
                      alignSelf: 'flex-end',
                      paddingHorizontal: 6,
                      paddingVertical: 4,
                      fontSize: 12,
                      borderWidth: isPriceModified ? 1 : 0,
                      borderRadius: 6,
                      flexDirection: 'row',
                      alignItems: 'center',
                      borderColor: 'transparent',
                    },
                    isPriceModified && {
                      backgroundColor: Colors.rgba(Colors.$backgroundPrimaryLight, 0.18),
                      color: Colors.$outlinePrimary,
                      borderColor: Colors.rgba(Colors.$outlineDefault, 0.35),
                    },
                  ]}
                >
                  Subtotal: {formatPrice(item.cart.price * item.cart.quantity)}
                </Text>
                {isPriceModified && (
                  <PriceModifiedBadge
                    originalPrice={item.cart.originalPrice * item.cart.quantity}
                    label="From:"
                  />
                )}
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}

const cartStyles = StyleSheet.create({
  priceInput: {
    padding: 0,
    margin: 0,
    minWidth: 60,
    color: Colors.$textDefault,
    includeFontPadding: false,
  },
  totalText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.$textDefault,
    lineHeight: 32,
  },
})
