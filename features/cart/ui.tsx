import { useCardQuery } from '@/client/card'
import { useSubmitOffer } from '@/client/offers'
import { useToast } from '@/components/Toast'
import { Button } from '@/components/ui/button'
import { thumbStyles } from '@/components/ui/modal'
import { NumberTicker } from '@/components/ui/number-ticker'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text'
import { formatPrice } from '@/components/utils'
import type { CartItem } from '@/features/cart/types'
import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { Ellipsis, Trash2 } from 'lucide-react-native'
import { useEffect, useMemo } from 'react'
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
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
  useUpdateCartQuantity,
} from './hooks'

export function CartSheetInner() {
  const colorScheme = useEffectiveColorScheme()
  const styles = useMemo(
    () =>
      StyleSheet.create({
        keyboardAvoiding: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: '80%',
        },
        sheet: {
          backgroundColor: Colors.$backgroundDefault,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingHorizontal: 16,
          overflow: 'hidden',
        },
      }),
    [colorScheme]
  )
  const closeCart = useCloseCart()
  const clearCart = useClearCart()
  const items = useCartItems()
  const total = useCartTotal()
  const { showToast } = useToast()
  const { mutateAsync: submitOffer, isPending } = useSubmitOffer()
  const { height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()

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

      <KeyboardAvoidingView behavior="translate-with-padding" style={styles.keyboardAvoiding}>
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }, sheetStyle]}
          >
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
                <Text variant="h3">Cart ({items.length})</Text>
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
                    {items.map((item, idx) => (
                      <View key={`${item.data.id}_${item.cart.quantity}`}>
                        <CartItemRow item={item} />
                        {idx < items.length - 1 && <Separator orientation="horizontal" />}
                      </View>
                    ))}
                  </ScrollView>

                  <Separator orientation="horizontal" />

                  <View style={{ paddingVertical: 12, gap: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text variant="h4">Total</Text>
                      <Text variant="h4">{formatPrice(total)}</Text>
                    </View>
                    <Button
                      size="lg"
                      disabled={isPending}
                      onPress={async () => {
                        // Group items by seller
                        showToast({
                          title: 'Offer sent!',
                          message: 'Your offer has been submitted.',
                          preset: 'general',
                        })
                        const bySeller = new Map<string, CartItem[]>()
                        for (const item of items) {
                          const sellerId = item.data.user_id
                          if (!sellerId) continue
                          if (!bySeller.has(sellerId)) bySeller.set(sellerId, [])
                          bySeller.get(sellerId)!.push(item)
                        }

                        try {
                          await Promise.all([
                            ...[...bySeller.entries()].map(([seller_id, sellerItems]) =>
                              submitOffer({
                                seller_id,
                                items: sellerItems.map((item) => ({
                                  collection_item_id: item.data.id,
                                  quantity: item.cart.quantity,
                                  offered_price_per_unit: item.cart.price,
                                  card_snapshot: {
                                    card_id: item.data.ref_id ?? undefined,
                                  },
                                })),
                              })
                            ),
                          ]).then(() => {
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
                          })
                        } catch (err) {
                          console.error('[CartSheet] submitOffer error', err)
                          setTimeout(
                            () =>
                              showToast({
                                autoDismiss: 5000,
                                title: 'Error',
                                message: 'Failed to send offer. Please try again.',
                                preset: 'failure',
                              }),
                            2000
                          )
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
      </KeyboardAvoidingView>
    </View>
  )
}

function CartItemRow({ item }: { item: CartItem }) {
  const removeItem = useRemoveFromCart()
  const updateQuantity = useUpdateCartQuantity()
  const { data: card } = useCardQuery(item.data.ref_id)
  const displayData = useMemo(
    () => getCardDisplayData({ card, collectionItem: item.data }),
    [card, item.data]
  )
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
        <CardImage displayData={displayData} isLoading={!card} />
        <View style={{ flex: 1, justifyContent: 'space-between' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              flex: 1,
            }}
          >
            <View style={{ flex: 1, gap: 0 }}>
              <Text style={{ fontWeight: '600' }}>{card?.name ?? '—'}</Text>
              {item.data.grade_condition && (
                <Text variant="info" style={{ color: Colors.$textNeutralLight, lineHeight: 16 }}>
                  {getGradingDisplayString(item.data).slice(0, 2).join(' ')}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={() => removeItem(item.data.id)} style={{ padding: 4 }}>
              <Ellipsis size={24} color={Colors.$textNeutralLight} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeItem(item.data.id)} style={{ padding: 4 }}>
              <Trash2 size={24} color={Colors.$textDanger} />
            </TouchableOpacity>
          </View>
          <View
            style={{
              width: '100%',
              flexDirection: 'row',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ fontSize: 30, lineHeight: 32 }}>{formatPrice(item.cart.price)}</Text>
            <View style={{ gap: 8, alignItems: 'flex-end' }}>
              <NumberTicker
                key={`${item.data.id}_${item.cart.quantity}`}
                min={1}
                max={item.data.quantity}
                initialNumber={item.cart.quantity}
                onChangeNumber={(n) => updateQuantity(item.data.id, n)}
                containerStyle={{ height: 32 }}
              />
              <Text
                variant="small"
                style={{ color: Colors.$textNeutralLight, alignSelf: 'flex-end' }}
              >
                Subtotal: {formatPrice(item.cart.price * item.cart.quantity)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
