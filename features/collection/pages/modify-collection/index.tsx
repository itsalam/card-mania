import { CollectionLike, EditCollectionResult } from '@/client/collections/types'
import { CollectionsAvatar } from '@/components/collections/avatar'
import { Separator } from '@/components/ui/separator'
import { Text } from '@/components/ui/text/base-text'
import { OnboardingTarget } from '@/features/onboarding'
import { ModifyCollectionProvider } from '@/features/tcg-card-views/DetailCardView/provider'
import { ChevronLeft } from 'lucide-react-native'
import React from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import {
  CollectionsDescriptionInput,
  CollectionsNameInput,
  StorefrontOptions,
  SubmitCollectionButton,
} from './components'
import { CreateCollectionChipInput } from './tags-input'
import { VisibilitySelector } from './visibility-selector'

/** The "New/Edit Collection" header chrome — a circular back button + title row. Also used
 *  (imported directly, not through ModifyCollectionView) for the "Save Card To" header in
 *  features/tcg-card-views/DetailCardView/footer/footer.tsx, so all three headers (Save Card To,
 *  and both New/Edit Collection screens — the Collections tab's own and the one reached from the
 *  card detail footer, which now render the exact same ModifyCollectionView) are identically
 *  styled and sized. */
export function ModifyCollectionHeader({
  title,
  onBack,
  paddingHorizontal = 16,
  paddingVertical = 12,
}: {
  title: string
  onBack: () => void
  /** Override for embedding inside a header chrome that already contributes its own padding
   *  (e.g. AppStandaloneHeader's own paddingHorizontal:12 row in footer.tsx's "Save Card To"
   *  usage — passing 4 there lands the chevron at the same 16px total inset as this component's
   *  own 16px default, instead of stacking to 28px). Default 16/12 — this component's own
   *  standalone chrome size, used as-is by ModifyCollectionView below. */
  paddingHorizontal?: number
  paddingVertical?: number
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal,
        paddingVertical,
      }}
    >
      <TouchableOpacity
        onPress={onBack}
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
        {title}
      </Text>
    </View>
  )
}

/** The "New/Edit Collection" scrollable form + Save button — everything below
 *  ModifyCollectionHeader. Must render inside a ModifyCollectionProvider (ModifyCollectionView
 *  does this already; a caller composing Header/Body itself needs to provide one). */
export function ModifyCollectionBody({
  collection,
  onSubmit,
  bottomInset = 0,
}: {
  collection?: CollectionLike
  onSubmit?: (res: EditCollectionResult) => void
  /** Extra bottom clearance below the Save button — e.g. the Collections tab's floating tab bar
   *  height, or a safe-area inset elsewhere. Default 0 — deliberately not read from
   *  useBottomTabBarHeight() internally, since that throws outside a Tab.Navigator screen (the
   *  footer context isn't one). */
  bottomInset?: number
}) {
  return (
    <>
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
        <OnboardingTarget id="collection-details-input">
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
        </OnboardingTarget>

        {/* Settings */}
        <SectionCard label="Settings">
          <VisibilitySelector />
          <Separator style={{ marginVertical: 12 }} orientation="horizontal" />
          <StorefrontOptions />
        </SectionCard>
      </ScrollView>

      {/* ── Save button — clears the floating tab bar (via bottomInset) ─── */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: bottomInset + 8,
        }}
      >
        <SubmitCollectionButton collectionId={collection?.id} onSubmit={(e) => onSubmit?.(e)} />
      </View>
    </>
  )
}

export const ModifyCollectionView = ({
  collection,
  onChange,
  onSubmit,
  onBack,
  bottomInset = 0,
}: {
  collection?: CollectionLike
  onChange?: (c: CollectionLike) => void
  onSubmit?: (res: EditCollectionResult) => void
  /** Required, not read from a store internally — this view is shared across contexts (the
   *  Collections tab's own currentPage/showEditView store, the card detail footer's page
   *  navigation, ...) that each have their own idea of "go back", and some of those contexts
   *  don't mount the Collections tab's provider at all. */
  onBack: () => void
  /** Extra bottom clearance below the Save button — see ModifyCollectionBody's own doc. */
  bottomInset?: number
}) => {
  const isNew = !collection?.id

  return (
    //@ts-ignore
    <ModifyCollectionProvider collection={collection} onChange={onChange}>
      <View style={{ flex: 1 }}>
        <ModifyCollectionHeader
          title={isNew ? 'New Collection' : 'Edit Collection'}
          onBack={onBack}
        />
        <ModifyCollectionBody
          collection={collection}
          onSubmit={onSubmit}
          bottomInset={bottomInset}
        />
      </View>
    </ModifyCollectionProvider>
  )
}

export function SectionCard({
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
