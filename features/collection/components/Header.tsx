import { Text } from '@/components/ui/text/base-text'

import { ExpandableSearchBar, SearchBarProps } from '@/components/ui/search'
import { motify } from 'moti'
import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useGetCollection } from '../hooks'
import { DefaultPageTypes, getCollectionIdArgs, useCollectionsPageStore } from '../provider'

const MView = motify(View)()

export const CollectionsSearchBar = (props: SearchBarProps & { expanded: boolean }) => {
  const { searchQuery, setSearchQuery } = useCollectionsPageStore()

  return <ExpandableSearchBar value={searchQuery} onChangeText={setSearchQuery} {...props} />
}

export const ScreenHeader = () => {
  const { searchQuery, currentPage, expanded } = useCollectionsPageStore()
  const collectionKey = getCollectionIdArgs(currentPage)
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
      style={{
        // padding: 12,
        display: 'flex',
        flexDirection: 'row',
        paddingBottom: 12,
      }}
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
            : (collection?.name ?? title[currentPage as DefaultPageTypes] ?? 'Collections')}
        </Text>
      </MView>

      <CollectionsSearchBar
        onLeftIconPress={() => setExpandSearch(!expandSearch)}
        expanded={Boolean(expandSearch)}
        variant={'ghost'}
        // style={{ position: 'absolute', right: 12 }}
      />
    </MView>
  )
}
