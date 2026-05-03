import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { UserAvatar } from '@/features/users/components/UserAvatars'
import { UserDisplayInfo } from '@/features/users/types'
import { useUserStore } from '@/lib/store/useUserStore'
import { useRouter } from 'expo-router'
import { LogOut } from 'lucide-react-native'
import React from 'react'
import { Alert, FlatList, TouchableOpacity, useWindowDimensions, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export function ProfileHeader() {
  const { height } = useWindowDimensions()
  const { user, profile, signOut } = useUserStore()
  const router = useRouter()

  // Resolve display name and handle from profile, falling back to auth data
  const displayName = profile?.display_name ?? profile?.username ?? 'CardMania User'
  const handle = profile?.username ?? user?.email?.split('@')[0] ?? 'username'

  const displayInfo: UserDisplayInfo = {
    name: displayName,
    handle: `@${handle}`,
    avatar: profile?.avatar_url ?? '',
  }

  const stats = [
    { label: 'Followers', value: 0 },
    { label: 'Following', value: 0 },
  ]

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            signOut()
            if (router.canDismiss()) router.dismissAll()
          },
        },
      ],
      { cancelable: true }
    )
  }

  return (
    <View
      style={{
        paddingTop: Math.round(height * 0.15),
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 20,
      }}
    >
      <UserAvatar size="2xl" user={displayInfo} />
      <View
        style={{
          paddingTop: 20,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Text variant={'h4'}>{displayName}</Text>
        <Text variant={'large'}>@{handle}</Text>
      </View>
      <FlatList
        contentContainerStyle={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'stretch',
        }}
        horizontal
        data={stats}
        renderItem={({ item }) => {
          const { label, value } = item
          return (
            <View
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: Colors.$iconDefault }}>{label}</Text>
              <Text variant={'large'}>{value}</Text>
            </View>
          )
        }}
        ItemSeparatorComponent={(props) => <Separator orientation="vertical" {...props} />}
      />

      <Button style={{ marginVertical: 12 }}>
        <Text variant={'large'}>View Profile</Text>
      </Button>

      <Separator
        style={{
          paddingVertical: 4,
          width: '100%',
          backgroundColor: Colors.$backgroundNeutral,
        }}
      />

      <TouchableOpacity
        onPress={handleSignOut}
        accessibilityLabel="Sign out"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 20,
          paddingVertical: 16,
          width: '100%',
        }}
      >
        <LogOut size={22} color={Colors.$iconDangerLight ?? Colors.red30} />
        <Text
          variant={'large'}
          style={{ fontSize: 18, color: Colors.$iconDangerLight ?? Colors.red30 }}
        >
          Sign out
        </Text>
      </TouchableOpacity>

      <Separator
        style={{
          paddingVertical: 4,
          width: '100%',
          backgroundColor: Colors.$backgroundNeutral,
        }}
      />
    </View>
  )
}
