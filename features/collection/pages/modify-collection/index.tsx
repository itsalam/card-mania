import { CollectionLike, EditCollectionResult } from '@/client/collections/types'
import { CollectionsAvatar } from '@/components/collections/avatar'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { ModifyCollectionProvider } from '@/features/tcg-card-views/DetailCardView/provider'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { ChevronLeft } from 'lucide-react-native'
import React from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { useCollectionsPageStore } from '../../provider'
import {
  CollectionsDescriptionInput,
  CollectionsNameInput,
  StorefrontOptions,
  SubmitCollectionButton,
} from './components'
import { CreateCollectionChipInput } from './tags-input'
import { VisibilitySelector } from './visibility-selector'

export const ModifyCollectionView = ({
  collection,
  onChange,
  onSubmit,
}: {
  collection?: CollectionLike
  onChange?: (c: CollectionLike) => void
  onSubmit?: (res: EditCollectionResult) => void
}) => {
  const { currentPage, setCurrentPage, setShowEditView } = useCollectionsPageStore()
  const tabBarHeight = useBottomTabBarHeight()
  const isNew = !collection?.id

  return (
    //@ts-ignore
    <ModifyCollectionProvider collection={collection} onChange={onChange}>
      <View style={{ flex: 1 }}>
        {/* ── Header ────────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setShowEditView(false)
              if (currentPage === 'new') setCurrentPage('default')
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.8),
              borderWidth: 1,
              borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
            }}
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color={Colors.$textDefault} />
          </TouchableOpacity>
          <Text variant="h3" style={{ flex: 1, fontSize: 18, fontWeight: '600' }}>
            {isNew ? 'New Collection' : 'Edit Collection'}
          </Text>
        </View>

        {/* ── Body ──────────────────────────────────────── */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: 16,
          }}
        >
          {/* ── Details card: Name · Description · Tags ─── */}
          {/* No overflow:hidden so suggestions can animate height inside the card */}
          <View
            style={{
              borderRadius: BorderRadiuses.br50,
              borderWidth: 1,
              borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
              backgroundColor: Colors.$backgroundElevatedLight,
            }}
          >
            {/* Name row */}
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 8,
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
              }}
            >
              <CollectionsAvatar iconImageSrc={collection?.cover_image_url ?? undefined} />
              <View style={{ flex: 1 }}>
                <CollectionsNameInput />
              </View>
            </View>

            {/* Description */}
            <View style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
              <CollectionsDescriptionInput />
            </View>

            {/* Tags — render inside the card; suggestions animate height within it */}
            <CreateCollectionChipInput />
          </View>

          {/* Settings */}
          <SectionCard label="Settings">
            <VisibilitySelector />
            <Separator style={{ marginVertical: 12 }} orientation="horizontal" />
            <StorefrontOptions />
          </SectionCard>
        </ScrollView>

        {/* ── Save button — clears the floating tab bar ────── */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: tabBarHeight + 8,
          }}
        >
          <SubmitCollectionButton collectionId={collection?.id} onSubmit={(e) => onSubmit?.(e)} />
        </View>
      </View>
    </ModifyCollectionProvider>
  )
}

function SectionCard({
  label,
  children,
  noPadding,
}: {
  label?: string
  children: React.ReactNode
  noPadding?: boolean
}) {
  return (
    <View
      style={{
        borderRadius: BorderRadiuses.br50,
        borderWidth: 1,
        borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        backgroundColor: Colors.$backgroundElevatedLight,
      }}
    >
      {label && (
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: Colors.$textNeutral,
              textTransform: 'uppercase',
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            {label}
          </Text>
        </View>
      )}
      <View style={noPadding ? undefined : { paddingHorizontal: 16, paddingBottom: 16 }}>
        {children}
      </View>
    </View>
  )
}
