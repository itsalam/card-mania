import { CollectionLike } from '@/client/collections/types'
import { Text } from '@/components/ui/text/base-text'
import { useUserStore } from '@/lib/store/useUserStore'
import { ChevronDown } from 'lucide-react-native'
import { MotiView } from 'moti'
import { useState } from 'react'
import { Pressable, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useUserStorefront } from '../client'
import { StorefrontView } from '../components/storefront-view'
import { useUserProfilePage } from '../providers'

export function StorefrontPage() {
  const profile = useUserProfilePage((s) => s.user)
  const { user: authUser } = useUserStore()
  const isOwnProfile = !!authUser?.id && authUser.id === profile?.user_id
  const { data: collections, isPending } = useUserStorefront(profile?.user_id)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)

  const isEmpty = !isPending && !collections?.length

  return (
    <View>
      <View style={{ padding: 8 }}>
        <StoreFrontDropdown
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onSelect={setSelectedCollectionId}
          disabled={isEmpty || isPending}
        />
      </View>
      {isEmpty ? (
        <StorefrontEmptyState isOwnProfile={isOwnProfile} />
      ) : selectedCollectionId === null ? (
        <View style={{ gap: 16 }}>
          {(collections ?? []).map((c) => (
            <StorefrontView key={c.id} collectionId={c.id} isOwnProfile={isOwnProfile} />
          ))}
        </View>
      ) : (
        <StorefrontView collectionId={selectedCollectionId} isOwnProfile={isOwnProfile} />
      )}
    </View>
  )
}

function StorefrontEmptyState({ isOwnProfile }: { isOwnProfile: boolean }) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 32,
      }}
    >
      <Text variant="h3" style={{ color: Colors.$textNeutral, marginBottom: 8 }}>
        No storefront yet
      </Text>
      <Text variant="default" style={{ color: Colors.$textNeutralLight, textAlign: 'center' }}>
        {isOwnProfile
          ? 'Add items to a collection to start selling.'
          : 'This seller has no items listed.'}
      </Text>
    </View>
  )
}

function StoreFrontDropdown({
  collections,
  selectedCollectionId,
  onSelect,
  disabled,
}: {
  collections?: CollectionLike[]
  selectedCollectionId: string | null
  onSelect: (id: string | null) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)

  const selectedLabel =
    selectedCollectionId === null
      ? 'All'
      : (collections?.find((c) => c.id === selectedCollectionId)?.name ?? 'Untitled')

  const items = [
    { id: null as string | null, name: 'All' },
    ...(collections ?? []).map((c) => ({ id: c.id ?? null, name: c.name ?? 'Untitled' })),
  ]

  return (
    <View style={{ opacity: disabled ? 0.4 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
      {/* Trigger + decorative stack layers */}
      <View style={{ position: 'relative', paddingBottom: 6 }}>
        {/* Peek layers fade out when open */}
        <MotiView
          animate={{ opacity: open ? 0 : 1 }}
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

        {/* Trigger */}
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={{
            borderRadius: 8,
            borderWidth: 1,
            borderColor: Colors.rgba(Colors.$outlineNeutral, 0.75),
            backgroundColor: Colors.rgba(Colors.$backgroundDefault, 1),
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.25),
              paddingVertical: 11,
              paddingHorizontal: 12,
              gap: 6,
            }}
          >
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                variant="stats"
                style={{
                  color: Colors.$textNeutralLight,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  lineHeight: 18,
                }}
              >
                Collection:
              </Text>
              <Text
                variant="stats"
                style={{ fontWeight: '600', fontSize: 14, lineHeight: 18 }}
                numberOfLines={1}
              >
                {selectedLabel}
              </Text>
            </View>
            <MotiView
              animate={{ rotate: open ? '180deg' : '0deg' }}
              transition={{ type: 'timing', duration: 150 }}
            >
              <ChevronDown size={14} color={Colors.$textNeutralLight} />
            </MotiView>
          </View>
        </Pressable>
      </View>

      {/* Dropdown items */}
      <MotiView
        animate={{ maxHeight: open ? 500 : 0 }}
        transition={{ type: 'timing', duration: 220 }}
        style={{ overflow: 'hidden' }}
        pointerEvents={open ? 'auto' : 'none'}
      >
        <View style={{ gap: 4 }}>
          {items.map((item, index) => (
            <MotiView
              key={item.id ?? '__all'}
              animate={{
                opacity: open ? 1 : 0,
                translateY: open ? 0 : index < 2 ? -(8 - index * 4) : 0,
              }}
              transition={{
                type: 'timing',
                duration: 180,
                delay: open ? index * 45 : 0,
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
                  onSelect(item.id)
                  setOpen(false)
                }}
              />
            </MotiView>
          ))}
        </View>
      </MotiView>
    </View>
  )
}

function CollectionRow({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.75),
        backgroundColor: Colors.rgba(Colors.$backgroundDefault, 1),
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 11,
          paddingHorizontal: 12,
          backgroundColor: selected
            ? Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.25)
            : Colors.$backgroundElevatedLight,
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
