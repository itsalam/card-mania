import { ReactNode } from 'react'
import { SettingKey } from '../keys'
import { SettingsDisplay } from '../types'

export type AccessoryProps = {
  display: Extract<SettingsDisplay, { type: 'toggle' }>
  settingKey: SettingKey
  children?: ReactNode
}
