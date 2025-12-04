import { FolderTabsContainer } from '@/components/tabs/FolderTabs'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Text } from '@/components/ui/text'
import { Coins, Heart, Layers, LucideIcon, Plus, Vault } from 'lucide-react-native'
import { motify } from 'moti'
import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import CollectionBreakdown from './CollectionBreakdown'
import { DefaultCollectionsPage } from './pages/default'
import { WishlistPage } from './pages/wishlist'
import {
  CollectionsViewProvider,
  PageTypes,
  defaultPages,
  useCollectionsPageStore,
} from './provider'

const tabIcons: Record<PageTypes, LucideIcon> = {
  default: Layers,
  vault: Vault,
  wishlist: Heart,
  selling: Coins,
}

const tabContent: Record<PageTypes, React.ReactNode> = {
  default: <DefaultCollectionsPage />,
  vault: <></>,
  wishlist: <WishlistPage />,
  selling: <CollectionBreakdown />,
}

const CollectionDetailPage = (collectionId?: string, collectionType?: PageTypes) => {}

const MText = motify(Text)()

export default function CollectionScreen() {
  return (
    <CollectionsViewProvider>
      {/* <FabMenu /> */}
      <SafeAreaView className="flex-1 w-full max-h-full overflow-hidden" style={{ paddingTop: 8 }}>
        <MText
          variant="h1"
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ duration: 500 }}
          style={{
            color: Colors.$textDefault,
          }}
        >
          {'Collections'}
        </MText>
        <CollectionBreakdown
          style={{
            paddingTop: 64,
            paddingVertical: 40,
          }}
        />
        <Pages />
      </SafeAreaView>
    </CollectionsViewProvider>
  )
}

const Pages = () => {
  const { currentPage, setCurrentPage, preferenceState } = useCollectionsPageStore()
  const { preferences } = preferenceState
  const tabs = preferences.tabs ?? defaultPages.slice(1)

  console.log(currentPage, preferences)

  return (
    <Tabs className="flex-1 gap-2" value={currentPage} onValueChange={setCurrentPage}>
      <TabsList className="ml-2 gap-2">
        <TabsTrigger key={defaultPages[0]} value={defaultPages[0]}>
          <TabsLabel
            label={''}
            value={defaultPages[0]}
            className="text-xl"
            style={{ color: Colors.$textDefault }}
          >
            {React.createElement(tabIcons[defaultPages[0]], {
              size: 24,
              color: Colors.$textDefault,
            })}
            {/* {tab.charAt(0).toUpperCase() + tab.slice(1)} */}
          </TabsLabel>
        </TabsTrigger>
        <Separator orientation="vertical" />
        <ScrollView horizontal>
          {tabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              <TabsLabel
                label={tab}
                value={tab}
                className="text-xl"
                style={{ color: Colors.$textDefault }}
              >
                {React.createElement(
                  tabIcons[tab as keyof typeof tabIcons] ?? tabIcons['default'],
                  {
                    size: 20,
                    color: Colors.$textDefault,
                  }
                )}
                {/* {tab.charAt(0).toUpperCase() + tab.slice(1)} */}
              </TabsLabel>
            </TabsTrigger>
          ))}

          <TouchableOpacity
            style={{
              alignSelf: 'stretch',
              aspectRatio: 1,
              padding: 2,
            }}
          >
            <View
              style={{
                borderColor: Colors.$outlineDefault,
                display: 'flex',
                borderWidth: 2,
                borderRadius: BorderRadiuses.br40,
                justifyContent: 'center',
                alignItems: 'center',
                aspectRatio: 1,
              }}
            >
              <Plus size={18} color={Colors.$textDefault} />
            </View>
          </TouchableOpacity>
        </ScrollView>
      </TabsList>
      <FolderTabsContainer>
        <TabsContent key={defaultPages[0]} value={defaultPages[0]} className="flex-1">
          {tabContent[defaultPages[0] as keyof typeof TabsContent]}
        </TabsContent>
        {tabs.map((tab) => (
          <TabsContent key={tab} value={tab} className="flex-1">
            {tabContent[tab as keyof typeof TabsContent]}
          </TabsContent>
        ))}
      </FolderTabsContainer>
    </Tabs>
  )
}
