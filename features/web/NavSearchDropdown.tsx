import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Text } from '@/components/ui/text/base-text'
import { Link } from 'expo-router'
import { ActivityIndicator, StyleProp, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useSuggestedSellers } from './hooks/useSuggestedSellers'
import { useUserSearch } from './hooks/useUserSearch'

type UserRow = {
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  is_seller?: boolean | null
}

type Props = {
  query: string
  onSelect: () => void
  style?: StyleProp<ViewStyle>
}

function UserResultRow({ user, onSelect }: { user: UserRow; onSelect: () => void }) {
  const initials = user.display_name?.[0]?.toUpperCase() ?? user.username?.[0]?.toUpperCase() ?? '?'
  return (
    <Link href={`/${user.username}`} onPress={onSelect} style={{ textDecorationLine: 'none' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Avatar size="sm" alt={user.display_name ?? user.username ?? ''}>
          {user.avatar_url ? <AvatarImage source={{ uri: user.avatar_url }} /> : null}
          <AvatarFallback>
            <AvatarFallbackText>{initials}</AvatarFallbackText>
          </AvatarFallback>
        </Avatar>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: 14, fontWeight: '500', color: Colors.$textDefault }}
            numberOfLines={1}
          >
            {user.display_name ?? user.username}
          </Text>
          <Text variant="muted" style={{ fontSize: 12 }} numberOfLines={1}>
            @{user.username}
          </Text>
        </View>
      </View>
    </Link>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: Colors.$outlineNeutralLight,
      }}
    >
      <Text
        variant="muted"
        style={{ fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' }}
      >
        {label}
      </Text>
    </View>
  )
}

export function NavSearchDropdown({ query, onSelect, style }: Props) {
  const isSearching = query.length >= 2
  const { data: searchResults, isLoading: isSearchLoading } = useUserSearch(query)
  const { data: suggested, isLoading: isSuggestedLoading } = useSuggestedSellers()

  const users: UserRow[] = isSearching ? (searchResults ?? []) : (suggested ?? [])
  const isLoading = isSearching ? isSearchLoading : isSuggestedLoading
  const sectionLabel = isSearching ? 'Users' : 'Suggested Sellers'

  return (
    <View
      style={[
        {
          backgroundColor: Colors.$backgroundDefault,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: Colors.$outlineNeutral,
          // @ts-ignore — web-only
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          zIndex: 100,
        },
        style,
      ]}
    >
      <SectionHeader label={sectionLabel} />

      {isLoading && (
        <View style={{ padding: 20, alignItems: 'center' }}>
          <ActivityIndicator size="small" />
        </View>
      )}

      {!isLoading && users.length === 0 && (
        <View style={{ padding: 16, alignItems: 'center' }}>
          <Text variant="muted" style={{ fontSize: 13 }}>
            {isSearching ? 'No users found' : 'No sellers available'}
          </Text>
        </View>
      )}

      {!isLoading &&
        users.map((user) => <UserResultRow key={user.user_id} user={user} onSelect={onSelect} />)}
    </View>
  )
}
