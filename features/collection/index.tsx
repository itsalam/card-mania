
import FabMenu from '@/components/FabMenu'
import { FolderTabList, FolderTabsContainer, FolderTabTrigger } from '@/components/FolderTabs'
import { SearchBar } from '@/components/search-bar'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text'
import { Compass, LucideIcon, Newspaper, Sheet } from 'lucide-react-native'
import React from 'react'
import { SafeAreaView, View } from 'react-native'
import CollectionBreakdown from './CollectionBreakdown'
import { TabValue, tabValues, useCollectionPageStore } from './provider'

const tabIcons: Record<TabValue, LucideIcon> = {
  vault: Newspaper,
  wishlist: Compass,
  selling: Sheet,
}

const tabContent: Record<TabValue, React.ReactNode> = {
  vault: <CollectionBreakdown />,
  wishlist: <CollectionBreakdown />,
  selling: <CollectionBreakdown />,
}

export default function CollectionScreen() {
  const { currentPage, setCurrentPage } = useCollectionPageStore();
  
  return (<>

    <FabMenu/>
    <SafeAreaView className="flex-1 relative w-full">

      <CollectionBreakdown/>

      <SearchBar placeholder='Search collections..'/>
            <Tabs className="flex-1 gap-0" value={currentPage} onValueChange={setCurrentPage}>
        <FolderTabList>

          <View className='flex flex-row items-end justify-start gap-2'>
                      {tabValues.map((tab) => (
            <FolderTabTrigger key={tab} value={tab}>
              {React.createElement(tabIcons[tab], { size: 16 })}
              <Text className="text-xl">{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
            </FolderTabTrigger>
          ))}
          </View>
        </FolderTabList>
        <FolderTabsContainer>
          {tabValues.map((tab) => (
            <TabsContent key={tab} value={tab} className="flex-1">
              {tabContent[tab]}
            </TabsContent>
          ))}
        </FolderTabsContainer>
      </Tabs>
    </SafeAreaView>
    </>
  )
}

