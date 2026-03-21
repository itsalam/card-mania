import React from 'react'
import { ScrollView } from 'react-native'

import { TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from 'react-native-ui-lib'
import { tabsRecords, useUserProfilePage } from '../providers'
import { TabIcons } from './icons'

export function ProfileTabList() {
  const tabs = useUserProfilePage((s) => s.tabs)

  return (
    <TabsList
      style={{ paddingTop: 20, padding: 0, paddingBottom: 0, backgroundColor: 'transparent' }}
    >
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
          {tabs.map((tab) => {
            const { label } = tabsRecords[tab]
            const icon = TabIcons[tab]
            return (
              <TabsTrigger key={tab} value={tab}>
                <TabsLabel
                  containerStyle={{ padding: 4, paddingHorizontal: 6 }}
                  label={label}
                  value={tab}
                  iconLeft={icon}
                />
              </TabsTrigger>
            )
          })}
        </ScrollView>
      </MaskedView>
    </TabsList>
  )
}
