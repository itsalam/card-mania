import { FolderTabList, FolderTabsContainer, FolderTabTrigger } from '@/components/tabs/FolderTabs'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent } from '@/components/ui/tabs/tabs'
import { Text } from '@/components/ui/text'
import { MainSearchBar } from '@/features/mainSearchbar'
import { useColorScheme } from '@/lib/hooks/useColorScheme'
import { Compass, LucideIcon, Menu, Newspaper, Sheet } from 'lucide-react-native'
import React from 'react'
import { SafeAreaView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ExplorePage, ExplorePageMenu } from './ExplorePage'
import { FeedPage } from './FeedPage'
import { TabValue, tabValues, useHomePageStore } from './provider'

const tabIcons: Record<TabValue, LucideIcon> = {
  feed: Newspaper,
  explore: Compass,
  sheets: Sheet,
}

const tabContent: Record<TabValue, React.ReactNode> = {
  feed: <FeedPage />,
  explore: <ExplorePage />,
  sheets: <FeedPage />, // Placeholder for sheets
}

export default function HomeScreen() {
  const { currentPage, setCurrentPage } = useHomePageStore()
  const insets = useSafeAreaInsets()
  return (
    <SafeAreaView
      className="flex-1 w-full h-full overflow-visible"
      style={{ paddingTop: insets.top }}
    >
      <MainSearchBar />
      <Tabs className="flex-1 gap-0" value={currentPage} onValueChange={setCurrentPage}>
        <FolderTabList>
          <View className="flex flex-row items-end justify-start gap-2">
            {tabValues.map((tab) => (
              <FolderTabTrigger key={tab} value={tab}>
                {React.createElement(tabIcons[tab], { size: 16 })}
                <Text className="text-xl">{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
              </FolderTabTrigger>
            ))}
          </View>

          <TabOptions currentTab={currentPage} />
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
  )
}

const TabOptions = ({ currentTab }: { currentTab: string }) => {
  const { colorScheme, setColorScheme } = useColorScheme()
  const PageMenu = {
    explore: ExplorePageMenu,
  }[currentTab]
  return (
    <DropdownMenu className="place-self-end justify-self-end">
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="p-2 rounded-t-md rounded-b-none border border-b-0 border-neutral-300 translate-y-px px-3"
        >
          <Menu size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-52">
        {PageMenu && <PageMenu />}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Display Options</DropdownMenuLabel>

        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={colorScheme === 'light'}
          onCheckedChange={() => setColorScheme('light')}
        >
          <Text>Light</Text>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={colorScheme === 'dark'}
          onCheckedChange={() => setColorScheme('dark')}
        >
          <Text>Dark</Text>
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
