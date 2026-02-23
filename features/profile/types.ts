import { LucideIcon } from 'lucide-react-native'
import { ReactNode } from 'react'

export type ProfilePageStat = {
  label: string
  value?: string | number | boolean
  icon?: LucideIcon
  element?: ReactNode
}
