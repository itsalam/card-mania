import { Text } from '@/components/ui/text'

import { CollectionIdArgs } from '@/client/collections/types'
import { SearchBar, SearchBarProps } from '@/components/ui/search'
import { motify, MotiView } from 'moti'
import React, { useState } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useGetCollection } from '../hooks'
import { defaultPages, DefaultPageTypes, useCollectionsPageStore } from '../provider'

const MView = motify(View)()
const MSearchBar = motify(SearchBar)()

export const ExpandableSearchBar = (props: SearchBarProps & { expanded: boolean }) => {
  const { expanded, style, ...rest } = props
  const { searchQuery, setSearchQuery } = useCollectionsPageStore()

  return (
    <MotiView
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row-reverse',
        marginVertical: 'auto',
        paddingHorizontal: 12,
        top: 0,
        right: 0,
      }}
    >
      <MotiView
        style={{
          overflow: 'visible',
        }}
        animate={{
          flex: expanded ? 1 : 0.0,
        }}
      >
        <SearchBar
          value={searchQuery}
          style={[{ flexShrink: 0 }, style]}
          {...rest}
          onChangeText={setSearchQuery}
        />
      </MotiView>
    </MotiView>
  )
}

export const ScreenHeader = () => {
  const { currentPage, expanded } = useCollectionsPageStore()
  const collectionKey = {
    ...(defaultPages.includes(currentPage as (typeof defaultPages)[number])
      ? { collectionType: currentPage as DefaultPageTypes }
      : { collectionId: currentPage }),
  } as CollectionIdArgs
  const isBasicPage = Boolean(collectionKey.collectionType)
  const isDefault = currentPage === 'default'
  const { data: collection } = useGetCollection(collectionKey)

  const [expandSearch, setExpandSearch] = useState(false)

  const title: Record<DefaultPageTypes, string> = {
    default: 'Collections',
    vault: 'Vault',
    wishlist: 'Wishlist',
    selling: 'Selling',
  }

  return (
    <MView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: 500 }}
      style={{
        // padding: 12,
        display: 'flex',
        flexDirection: 'row',
        paddingBottom: 12,
      }}
    >
      <MView
        key={!expanded ? 'Collections' : currentPage}
        from={{ opacity: 0, translateY: (expanded ? 1 : -1) * 20 }}
        animate={{ opacity: expandSearch ? 0 : 1, translateY: 0 }}
        style={{
          marginVertical: 'auto',
          flex: 1,
          position: 'absolute',
          right: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 12,
        }}
      >
        <Text
          variant="h2"
          style={{
            color: Colors.$textDefault,
          }}
        >
          {!expanded
            ? 'Collections'
            : collection?.name ?? title[currentPage as DefaultPageTypes] ?? 'Collections'}
        </Text>
      </MView>

      <ExpandableSearchBar
        onLeftIconPress={() => setExpandSearch(!expandSearch)}
        expanded={Boolean(expandSearch)}
        // style={{ position: 'absolute', right: 12 }}
      />
    </MView>
  )
}
