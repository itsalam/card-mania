import { CollectionLike } from '@/client/collections/types'
import { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import {
  NAV_CLEARANCE,
  NAV_TOP,
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from './layout-constants'

type SellerProfile = {
  user_id: string
  username: string | null
  display_name?: string | null
  avatar_url?: string | null
  bio?: string | null
  is_seller?: boolean
}

type SellerSidebarProps = {
  profile: SellerProfile | null
  collections: CollectionLike[]
  selectedCollectionId: string | null
  totalItemCount: number
  onSelectCollection: (id: string | null) => void
  portrait?: boolean
}

const EXPANDED_WIDTH = SIDEBAR_EXPANDED_WIDTH
const COLLAPSED_WIDTH = SIDEBAR_COLLAPSED_WIDTH

export function SellerSidebar({
  profile,
  collections,
  selectedCollectionId,
  totalItemCount,
  onSelectCollection,
  portrait = false,
}: SellerSidebarProps) {
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)
  const [hovered, setHovered] = useState(false)

  if (!profile) return null

  const initials =
    profile.display_name?.[0]?.toUpperCase() ?? profile.username?.[0]?.toUpperCase() ?? '?'

  const selectedLabel =
    selectedCollectionId === null
      ? 'All'
      : (collections.find((c) => c.id === selectedCollectionId)?.name ?? 'Untitled')

  if (portrait) {
    return (
      <View style={{ paddingTop: 12, paddingHorizontal: 20 }}>
        {/* Portrait: avatar + collection dropdown in a single row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Avatar
            size="md"
            alt={profile.display_name ?? profile.username ?? ''}
            style={{ marginTop: 8 }}
          >
            {profile.avatar_url ? <AvatarImage source={{ uri: profile.avatar_url }} /> : null}
            <AvatarFallback>
              <AvatarFallbackText>{initials}</AvatarFallbackText>
            </AvatarFallback>
          </Avatar>

          <View style={{ flex: 1, gap: 4, paddingRight: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Text variant="h4" numberOfLines={1} style={{ flexShrink: 1 }}>
                {profile.display_name ?? profile.username}
              </Text>
              {profile.is_seller && <Badge label="Seller" />}
            </View>

            <View>
              {/* Stack container: trigger is the front card; 2 peek layers fade out on open */}
              <View style={{ position: 'relative', paddingBottom: 6 }}>
                <MotiView
                  animate={{ opacity: collectionsOpen ? 0 : 1 }}
                  transition={{ type: 'timing', duration: 150 }}
                  pointerEvents="none"
                >
                  {/* Layer 3 — furthest back */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      right: 6,
                      height: 42,
                      borderRadius: 8,
                      backgroundColor: Colors.rgba(Colors.$backgroundElevatedLight, 1),
                      borderWidth: 1,
                      borderColor: Colors.rgba(Colors.$outlineNeutral, 0.45),
                    }}
                  />
                  {/* Layer 2 */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: 3,
                      right: 3,
                      height: 42,
                      borderRadius: 8,
                      backgroundColor: Colors.rgba(Colors.$backgroundElevatedLight, 1),
                      borderWidth: 1,
                      borderColor: Colors.rgba(Colors.$outlineNeutral, 0.6),
                    }}
                  />
                </MotiView>

                {/* Trigger = front card */}
                <Pressable
                  onPress={() => setCollectionsOpen((v) => !v)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: 8,
                    backgroundColor: Colors.rgba(Colors.$backgroundDefault, 1),
                    borderWidth: 1,
                    borderColor: Colors.rgba(Colors.$outlineNeutral, 0.75),
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      height: '100%',
                      width: '100%',
                      gap: 6,
                      backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.25),
                      paddingVertical: 11,
                      paddingHorizontal: 12,
                    }}
                  >
                    <Text
                      variant="stats"
                      style={{
                        color: Colors.$textNeutralLight,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                      }}
                    >
                      Collection:
                    </Text>
                    <Text variant="stats" style={{ fontWeight: '600', fontSize: 14 }}>
                      {selectedLabel}
                    </Text>
                  </View>
                  <ChevronDown
                    size={14}
                    color={Colors.$textNeutralLight}
                    style={{ transform: [{ rotate: collectionsOpen ? '180deg' : '0deg' }] }}
                  />
                </Pressable>
              </View>

              {/* Dropdown: first 2 items slide from layer positions, rest fade only */}
              <MotiView
                animate={{ maxHeight: collectionsOpen ? 500 : 0 }}
                transition={{ type: 'timing', duration: 220 }}
                style={{ overflow: 'hidden' }}
                pointerEvents={collectionsOpen ? 'auto' : 'none'}
              >
                <View style={{ gap: 4 }}>
                  {[
                    { id: null as string | null, name: 'All' },
                    ...collections.map((c) => ({ id: c.id ?? null, name: c.name ?? 'Untitled' })),
                  ].map((item, index) => (
                    <MotiView
                      key={item.id ?? '__all'}
                      animate={{
                        opacity: collectionsOpen ? 1 : 0,
                        translateY: collectionsOpen ? 0 : index < 2 ? -(8 - index * 4) : 0,
                      }}
                      transition={{
                        type: 'timing',
                        duration: 180,
                        delay: collectionsOpen ? index * 45 : 0,
                      }}
                    >
                      <CollectionRow
                        label={item.name}
                        selected={
                          item.id === null
                            ? selectedCollectionId === null
                            : selectedCollectionId === item.id
                        }
                        onPress={() => {
                          onSelectCollection(item.id)
                          setCollectionsOpen(false)
                        }}
                        cardStyle
                      />
                    </MotiView>
                  ))}
                </View>
              </MotiView>
            </View>
          </View>
        </View>
      </View>
    )
  }

  // Landscape: expandable sidebar
  return (
    <View style={{ flexDirection: 'row', height: '100%' } as any}>
      <MotiView
        animate={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={{ type: 'spring', damping: 200, stiffness: 600 }}
        style={{ overflow: 'hidden', flexShrink: 0, height: '100%' }}
      >
        {isExpanded ? (
          <View
            style={{
              width: EXPANDED_WIDTH,
              padding: 12,
              paddingTop: NAV_CLEARANCE + NAV_TOP * 2,
              height: '100%',
            }}
          >
            <View
              style={{
                paddingTop: 12,
                paddingBottom: 12,
                paddingHorizontal: 8,
                gap: 16,
                borderWidth: 1,
                borderRadius: BorderRadiuses.br30,
                borderColor: Colors.$outlineNeutral,
                height: '100%',
              }}
            >
              {/* Collapse toggle */}
              <Pressable
                onPress={() => setIsExpanded(false)}
                hitSlop={8}
                style={{ alignSelf: 'flex-end' }}
              >
                <ChevronLeft size={16} color={Colors.$textNeutralLight} />
              </Pressable>

              {/* Avatar + profile info */}
              <View style={{ alignItems: 'center', gap: 10, paddingTop: 44 }}>
                <Avatar size="lg" alt={profile.display_name ?? profile.username ?? ''}>
                  {profile.avatar_url ? <AvatarImage source={{ uri: profile.avatar_url }} /> : null}
                  <AvatarFallback>
                    <AvatarFallbackText>{initials}</AvatarFallbackText>
                  </AvatarFallback>
                </Avatar>

                <View style={{ alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap-reverse',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                    }}
                  >
                    <Text variant="h4">{profile.display_name ?? profile.username}</Text>
                  </View>
                  <Text variant="muted">@{profile.username}</Text>
                  {profile.bio ? (
                    <Text
                      variant="small"
                      numberOfLines={3}
                      style={{ textAlign: 'center', color: Colors.$textNeutralHeavy }}
                    >
                      {profile.bio}
                    </Text>
                  ) : null}
                </View>
              </View>

              <Separator />

              {/* Stats */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Text variant="info" style={{ fontWeight: '700' }}>
                    {totalItemCount}
                  </Text>
                  <Text variant="stats" style={{ color: Colors.$textNeutralLight }}>
                    Items
                  </Text>
                </View>
                <View style={{ alignItems: 'center', gap: 2 }}>
                  <Text variant="info" style={{ fontWeight: '700' }}>
                    {collections.length}
                  </Text>
                  <Text variant="stats" style={{ color: Colors.$textNeutralLight }}>
                    Collections
                  </Text>
                </View>
              </View>

              <Separator />

              {/* Collections list */}
              <View style={{ gap: 4 }}>
                <Text
                  variant="stats"
                  style={{
                    color: Colors.$textNeutralLight,
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Collections
                </Text>
                <CollectionRow
                  label="All"
                  selected={selectedCollectionId === null}
                  onPress={() => onSelectCollection(null)}
                />
                {collections.map((col) => (
                  <CollectionRow
                    key={col.id}
                    label={col.name ?? 'Untitled'}
                    selected={selectedCollectionId === col.id}
                    onPress={() => onSelectCollection(col.id ?? null)}
                  />
                ))}
              </View>
            </View>
          </View>
        ) : (
          /* Collapsed: avatar + centered vertical label with thumb brackets */
          <MotiView
            animate={{
              backgroundColor: hovered
                ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.08)
                : 'transparent',
            }}
            transition={{ type: 'timing', duration: 150 }}
            style={{ width: COLLAPSED_WIDTH, height: '100%' }}
          >
            <Pressable
              onPress={() => setIsExpanded(true)}
              // @ts-ignore — web-only hover events
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              style={{
                width: COLLAPSED_WIDTH,
                alignItems: 'center',
                paddingTop: NAV_CLEARANCE + NAV_TOP * 2,
                paddingBottom: 24,
                borderRightColor: Colors.$outlineDefault,
                borderWidth: 1,
                height: '100%',
              }}
            >
              <MotiView
                animate={{ scale: hovered ? 1.08 : 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              >
                <Avatar size="md" alt={profile.display_name ?? profile.username ?? ''}>
                  {profile.avatar_url ? <AvatarImage source={{ uri: profile.avatar_url }} /> : null}
                  <AvatarFallback>
                    <AvatarFallbackText>{initials}</AvatarFallbackText>
                  </AvatarFallback>
                </Avatar>
              </MotiView>

              {/* Centered label with thumb brackets */}
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <MotiView
                  animate={{ opacity: hovered ? 0.7 : 0.25 }}
                  transition={{ type: 'timing', duration: 150 }}
                  style={{
                    width: 16,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: Colors.$outlineNeutral,
                  }}
                />
                <Text
                  variant="stats"
                  numberOfLines={12}
                  style={
                    {
                      fontSize: 10,
                      color: hovered ? Colors.$textDefault : Colors.$textNeutralLight,
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      letterSpacing: 1,
                    } as any
                  }
                >
                  {selectedLabel}
                </Text>
                <MotiView
                  animate={{ opacity: hovered ? 0.7 : 0.25 }}
                  transition={{ type: 'timing', duration: 150 }}
                  style={{
                    width: 16,
                    height: 2,
                    borderRadius: 1,
                    backgroundColor: Colors.$outlineNeutral,
                  }}
                />
              </View>

              <MotiView
                animate={{
                  opacity: hovered ? 1 : 0.4,
                  translateX: hovered ? 3 : 0,
                }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
              >
                <ChevronRight size={14} color={Colors.$textNeutralLight} />
              </MotiView>
            </Pressable>
          </MotiView>
        )}
      </MotiView>

      {/* Vertical divider */}
      {/* <GradientBackground
        style={{ height: '100%', width: 2 }}
        colors={[Colors.$backgroundDark, '#FFFFFF00']}
        positions={[0.9, 1.0]}
      /> */}
    </View>
  )
}

function CollectionRow({
  label,
  selected,
  onPress,
  cardStyle = false,
}: {
  label: string
  selected: boolean
  onPress: () => void
  cardStyle?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 8,
        borderWidth: cardStyle ? 1 : 0,
        borderColor: cardStyle ? Colors.rgba(Colors.$outlineNeutral, 0.75) : 'transparent',
        backgroundColor: cardStyle ? Colors.rgba(Colors.$backgroundDefault, 1) : 'transparent',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: cardStyle ? 11 : 8,
          paddingHorizontal: 12,
          backgroundColor:
            selected && cardStyle
              ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.25)
              : 'transparent',
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: selected ? Colors.$backgroundPrimaryHeavy : Colors.$outlineNeutral,
            backgroundColor: selected ? Colors.$backgroundPrimaryHeavy : 'transparent',
          }}
        />
        <Text
          variant="stats"
          numberOfLines={1}
          style={{
            flex: 1,
            color: selected ? Colors.$textDefault : Colors.$textNeutralHeavy,
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  )
}
