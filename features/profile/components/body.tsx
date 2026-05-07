import { Tabs } from '@/components/ui/tabs'
import React, { ComponentProps, ReactNode } from 'react'
import { TabType, useUserProfilePage } from '../providers'

export function Body({
  children,
  style,
}: {
  children?: ReactNode
  style?: ComponentProps<typeof Tabs>['style']
}) {
  const currentTab = useUserProfilePage((s) => s.currentTab)
  const setCurrentTab = useUserProfilePage((s) => s.setCurrentTab)

  return (
    <Tabs
      style={style}
      value={currentTab}
      onValueChange={(value) => setCurrentTab(value as TabType)}
    >
      {children}
    </Tabs>
  )
}
