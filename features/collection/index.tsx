import {
  FolderTabComponent,
  FolderTabList,
  FolderTabsContainer,
  FolderTabTrigger,
} from '@/components/tabs/FolderTabs'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text'
import { Coins, Heart, LucideIcon, Plus, Vault } from 'lucide-react-native'
import React from 'react'
import { View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from 'react-native-ui-lib'
import CollectionBreakdown from './CollectionBreakdown'
import { WishlistPage } from './pages/wishlist'
import { TabValue, tabValues, useCollectionPageStore } from './provider'

const tabIcons: Record<TabValue, LucideIcon> = {
  vault: Vault,
  wishlist: Heart,
  selling: Coins,
}

const tabContent: Record<TabValue, React.ReactNode> = {
  vault: <CollectionBreakdown />,
  wishlist: <WishlistPage />,
  selling: <CollectionBreakdown />,
}

export default function CollectionScreen() {
  const { currentPage, setCurrentPage } = useCollectionPageStore()
  const insets = useSafeAreaInsets()

  return (
    <>
      {/* <FabMenu /> */}
      <SafeAreaView
        className="flex-1 w-full max-h-full overflow-hidden"
        style={{ paddingTop: insets.top }}
      >
        <CollectionBreakdown />
        <Tabs className="flex-1 gap-0" value={currentPage} onValueChange={setCurrentPage}>
          <FolderTabList>
            <View className="flex flex-row items-end justify-start gap-2">
              {tabValues.map((tab) => (
                <FolderTabTrigger key={tab} value={tab}>
                  {React.createElement(tabIcons[tab], { size: 16, color: Colors.$textDefault })}
                  <Text className="text-xl" style={{ color: Colors.$textDefault }}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
                </FolderTabTrigger>
              ))}
              <FolderTabComponent>
                <Plus size={16} />
              </FolderTabComponent>
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
