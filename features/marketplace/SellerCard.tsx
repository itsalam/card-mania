import { PublicStorefront } from '@/client/marketplace'
import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Text } from '@/components/ui/text/base-text'
import { useRouter } from 'expo-router'
import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export function SellerCard({ storefront }: { storefront: PublicStorefront }) {
  const router = useRouter()
  const name = storefront.seller_display_name ?? storefront.seller_username ?? '?'
  const initial = name.charAt(0).toUpperCase()

  return (
    <TouchableOpacity
      onPress={() => router.push(`/storefront/${storefront.seller_username}` as any)}
      style={{ alignItems: 'center', gap: 6, width: 60 }}
      activeOpacity={0.75}
    >
      <View style={{ position: 'relative' }}>
        <View
          style={{
            borderRadius: 999,
            borderWidth: 2,
            borderColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.5),
            padding: 2,
          }}
        >
          <Avatar alt={name} size="lg">
            <AvatarImage source={{ uri: storefront.seller_avatar_url ?? undefined }} />
            <AvatarFallback>
              <AvatarFallbackText>{initial}</AvatarFallbackText>
            </AvatarFallback>
          </Avatar>
        </View>
        {storefront.item_count > 0 && (
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              backgroundColor: Colors.$backgroundPrimaryHeavy,
              borderRadius: 999,
              minWidth: 17,
              height: 17,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 3,
              borderWidth: 1.5,
              borderColor: Colors.$backgroundDefault,
            }}
          >
            <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', lineHeight: 11 }}>
              {storefront.item_count > 99 ? '99+' : storefront.item_count}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={{ fontSize: 11, color: Colors.$textDefault, textAlign: 'center' }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </TouchableOpacity>
  )
}
