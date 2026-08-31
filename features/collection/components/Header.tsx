import { Text } from '@/components/ui/text/base-text'

import { PAGE_HEADER_CONTAINER_STYLE, PAGE_HEADER_TITLE_STYLE } from '@/components/consts'
import {
  collapsedSearchIconButtonStyle,
  ExpandableSearchBar,
  SearchBarProps,
} from '@/components/ui/search'
import { useOnboardingStore } from '@/features/onboarding'
import { useDebugDoubleTap } from '@/lib/hooks/useDebugDoubleTap'
import { motify } from 'moti'
import React, { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useGetCollection } from '../hooks'
import { DefaultPageTypes, getCollectionIdArgs, useCollectionsPageStore } from '../provider'

const MView = motify(View)()

// Explicit row height so the title (absolutely positioned, can't contribute to auto-sizing) and
// the search button (normal flow, alignItems: 'center') both center against the same definite
// frame — PAGE_HEADER_CONTAINER_STYLE's paddingTop(20) + paddingBottom(12) + PAGE_HEADER_TITLE_
// STYLE's lineHeight(40).
const HEADER_ROW_HEIGHT = 72

export const CollectionsSearchBar = (props: SearchBarProps & { expanded: boolean }) => {
  const { searchQuery, setSearchQuery } = useCollectionsPageStore()

  return (
    <ExpandableSearchBar
      // "sm" while collapsed matches collapsedSearchIconButtonStyle's own explicit height (see
      // components/ui/search/index.tsx) so the collapsed icon renders as a tight 36px circle
      // rather than "2xl"'s full 56px pill height.
      size={props.expanded ? '2xl' : 'sm'}
      // The options/filter side-button only makes sense once actually expanded into a real
      // input — collapsed, it has no room and was cramming into the same tiny width as the
      // search icon.
      hideSideButton={!props.expanded}
      value={searchQuery}
      onChangeText={setSearchQuery}
      {...props}
    />
  )
}

export const ScreenHeader = () => {
  const { searchQuery, currentPage, expanded } = useCollectionsPageStore()
  const collectionKey = getCollectionIdArgs(currentPage)
  const isBasicPage = Boolean(collectionKey.collectionType)
  const isDefault = currentPage === 'default'
  const { data: collection } = useGetCollection(collectionKey)

  const [expandSearch, setExpandSearch] = useState(false)

  // Debug-only: double-tapping the title re-triggers the Collections guided tour, bypassing the
  // "already seen it" gate — lets QA/dev re-run it without clearing onboarding_state by hand.
  // resumeOrStart, not start — if there's already in-progress/dropped tour state this session,
  // reopen at that step ("start the next section") rather than always resetting to step 0.
  const handleTitlePress = useDebugDoubleTap('Collection tour', () =>
    useOnboardingStore.getState().resumeOrStart('collection')
  )

  const title: Record<DefaultPageTypes, string> = {
    default: 'Collections',
    vault: 'Vault',
    wishlist: 'Wishlist',
    selling: 'Selling',
  }

  useEffect(() => {
    if (searchQuery?.length ?? 0 <= 0) {
      setExpandSearch(false)
    }
  }, [searchQuery, currentPage, expanded])

  return (
    <MView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: 500 }}
      style={[{ display: 'flex' }, PAGE_HEADER_CONTAINER_STYLE, { height: HEADER_ROW_HEIGHT }]}
    >
      <MView
        key={!expanded ? 'Collections' : currentPage}
        from={{
          opacity: isDefault && !expandSearch ? 1 : 0,
          translateY: (isDefault ? 0 : expanded ? 1 : -1) * 20,
        }}
        animate={{ opacity: expandSearch ? 0 : 1, translateY: 0 }}
        style={{
          marginVertical: 'auto',
          flex: 1,
          position: 'absolute',
          left: 0,
          // top/bottom pinned to the row's own paddingTop/paddingBottom (rather than 0/'100%')
          // so this box spans exactly the same content band the search button centers within —
          // an absolutely positioned box ignores its parent's padding, so without this its
          // center point would drift from the button's whenever the row's top/bottom padding
          // differ (they do: 20 vs 12).
          top: PAGE_HEADER_CONTAINER_STYLE.paddingTop,
          bottom: PAGE_HEADER_CONTAINER_STYLE.paddingBottom,
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingLeft: 16,
        }}
      >
        <Pressable onPress={handleTitlePress}>
          <Text style={PAGE_HEADER_TITLE_STYLE}>
            {!expanded
              ? 'Collectionszz'
              : (collection?.name ?? title[currentPage as DefaultPageTypes] ?? 'Collections')}
          </Text>
        </Pressable>
      </MView>

      <CollectionsSearchBar
        onLeftIconPress={() => setExpandSearch(!expandSearch)}
        expanded={Boolean(expandSearch)}
        variant={'ghost'}
        style={!expandSearch ? collapsedSearchIconButtonStyle : undefined}
      />
    </MView>
  )
}
