import React, { ReactNode } from 'react'
import { ScrollView } from 'react-native'

import { Tabs } from '@/components/ui/tabs'
import Animated from 'react-native-reanimated'
import { TabType, useUserProfilePage } from '../providers'

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView)

export function Body({ children }: { children?: ReactNode }) {
  const currentTab = useUserProfilePage((s) => s.currentTab)

  const setCurrentTab = useUserProfilePage((s) => s.setCurrentTab)

  return (
    <Tabs value={currentTab} onValueChange={(value) => setCurrentTab(value as TabType)}>
      {children}
    </Tabs>
  )
}
