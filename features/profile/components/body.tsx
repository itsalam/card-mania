import React, { ReactNode } from 'react'
import { ScrollView } from 'react-native'

import { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import Animated from 'react-native-reanimated'
import { Colors } from 'react-native-ui-lib'
import { tabsRecords, TabType, useUserProfilePage } from '../providers'
import { TabIcons } from './icons'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

export function Body({ tabContent }: { tabContent: Partial<Record<TabType, ReactNode>> }) {
  const currentTab = useUserProfilePage((s) => s.currentTab)

  const setCurrentTab = useUserProfilePage((s) => s.setCurrentTab)

  return (
    <Tabs
      className="flex-1"
      value={currentTab}
      onValueChange={(value) => setCurrentTab(value as TabType)}
      style={{ height: 400, width: '100%' }}
    >
      <TabsList style={{ padding: 0, paddingBottom: 12, backgroundColor: 'transparent' }}>
        <MaskedView
          style={[{ flex: 1.0, position: 'relative' }]}
          maskElement={
            <LinearGradient
              // MaskedView uses the alpha channel: solid shows content, transparent hides it.
              colors={['transparent', 'black', 'black', 'transparent']}
              start={{ x: 0.0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              locations={[0, 0.025, 0.95, 1]}
              style={{
                position: 'absolute',
                height: '100%',
                width: '100%',
                // top: '-2.5%',
                left: '-0%',
              }}
            />
          }
        >
          <ScrollView
            style={{
              alignSelf: 'stretch',
              paddingHorizontal: 8,
              marginBottom: 12,
              backgroundColor: Colors.$backgroundElevated,
              overflow: 'visible',
            }}
            scrollIndicatorInsets={{
              bottom: -10,
            }}
            contentContainerStyle={{
              backgroundColor: Colors.$backgroundElevated,
            }}
            horizontal
          >
            {Object.entries(tabsRecords).map(([tabType, tabData]) => (
              <TabsTrigger key={tabType} value={tabType}>
                <TabsLabel
                  containerStyle={{ padding: 4, paddingHorizontal: 6 }}
                  label={tabData.label}
                  value={tabType}
                  iconLeft={TabIcons[tabType as TabType]}
                />
              </TabsTrigger>
            ))}

            {/* <TabOptions currentTab={currentPage} /> */}
          </ScrollView>
        </MaskedView>
      </TabsList>
      <AnimatedScrollView
        className="flex-grow"
        contentContainerStyle={{
          flexGrow: 1,
        }}
      >
        {Object.keys(tabsRecords).map((tab) => (
          <TabsContent key={tab} value={tab} className="flex-1">
            {tabContent[tab as TabType]}
          </TabsContent>
        ))}
      </AnimatedScrollView>
    </Tabs>
  )
}
