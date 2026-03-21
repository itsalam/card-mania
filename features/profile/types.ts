import { LucideIcon } from 'lucide-react-native'
import { ComponentProps, ReactNode } from 'react'
import { AnimatedScrollRef } from '../collection/ui'

export type ProfilePageStat = {
  label: string
  value?: string | number | boolean
  icon?: LucideIcon
  element?: ReactNode
}

export type TabContentProps = {
  scrollViewProps: ComponentProps<AnimatedScrollRef>
}
