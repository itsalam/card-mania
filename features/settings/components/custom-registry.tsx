import { lazy, LazyExoticComponent, Suspense } from 'react'
import { View } from 'react-native'
import { SettingKey } from '../registry'
import { AccessoryProps } from './types'

const CustomComponents: Partial<
  Record<SettingKey, LazyExoticComponent<(p: AccessoryProps) => React.JSX.Element>>
> = {
  location: lazy(() => import('./location-picker')),
}

export function CustomAccessory(props: AccessoryProps) {
  const Component = ({ settingKey, display, children }: AccessoryProps) => {
    const Registered = CustomComponents[settingKey]
    if (Registered) {
      return <Registered {...{ settingKey, display, children }} />
    }
    return null
  }
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Suspense>
        <Component {...props} />
      </Suspense>
    </View>
  )
}
