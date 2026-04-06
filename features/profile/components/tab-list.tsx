import React, { useState } from 'react'
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native'

import { TabsLabel, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { tabsRecords, useUserProfilePage } from '../providers'
import { TabIcons } from './icons'

export function ProfileTabList({ style }: { style: StyleProp<ViewStyle> }) {
  const tabs = useUserProfilePage((s) => s.tabs)
  const [isScrolling, setIsScrolling] = useState(false)

  return (
    <TabsList
      style={[
        {
          padding: 0,
          backgroundColor: Colors.$backgroundElevated,
          borderRadius: BorderRadiuses.br70,
          marginBottom: -8,
          overflow: 'visible',
        },
        style,
      ]}
    >
      <MaskedView
        style={[{ flex: 1.0, position: 'relative', overflow: 'visible' }]}
        maskElement={
          <View
            style={{
              // opacity: isScrolling ? 1 : 0,
              position: 'absolute',
              height: '100%',
              width: '100%',
              // top: '-2.5%',
              left: '-0%',
              overflow: 'visible',
            }}
          >
            <LinearGradient
              // MaskedView uses the alpha channel: solid shows content, transparent hides it.
              colors={
                isScrolling
                  ? ['transparent', 'black', 'black', 'transparent']
                  : ['black', 'black', 'black', 'transparent']
              }
              start={{ x: 0.01, y: 0.5 }}
              end={{ x: 0.99, y: 0.5 }}
              locations={[0, 0.025, 0.95, 1]}
              style={{
                borderRadius: BorderRadiuses.br70,
                // opacity: isScrolling ? 1 : 0,
                height: '100%',
                width: '100%',
                // top: '-2.5%',
                left: '-0%',
              }}
            />
            <View
              style={{
                // opacity: isScrolling ? 1 : 0,
                position: 'absolute',
                height: '20%',
                width: '100%',
                top: '100%',
                left: '-0%',
                backgroundColor: 'black',
              }}
            />
          </View>
        }
      >
        <ScrollView
          style={{
            alignSelf: 'stretch',
            top: 4,
            marginBottom: 8,
            overflow: 'visible',
            backgroundColor: Colors.$backgroundElevated,
            borderRadius: BorderRadiuses.br70,
          }}
          contentContainerStyle={{
            paddingHorizontal: 4,
          }}
          // onScrollBeginDrag={() => setIsScrolling(true)}
          onMomentumScrollBegin={() => setIsScrolling(true)}
          onScrollEndDrag={() => {
            // might still be scrolling due to momentum
          }}
          onMomentumScrollEnd={() => setIsScrolling(false)}
          scrollEventThrottle={16}
          scrollIndicatorInsets={{
            bottom: -10,
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
