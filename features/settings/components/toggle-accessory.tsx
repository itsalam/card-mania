import { useToast } from '@/components/Toast'
import { Text } from '@/components/ui/text'
import { ToggleGroup, ToggleGroupIcon, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useSetting } from '@/features/settings'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { View } from 'react-native'
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated'
import { SettingKey } from '../registry'
import { SettingsDisplay } from '../types'

const AText = Animated.createAnimatedComponent(Text)

export function ToggleAccessory({
  settingKey,
  display,
  children,
}: {
  display: Extract<SettingsDisplay, { type: 'toggle' }>
  settingKey: SettingKey
  children?: ReactNode
}) {
  const setting = useSetting<SettingKey>(settingKey)
  type SettingType = typeof setting.value
  const toast = useToast()

  const safeValue = useRef<SettingType | undefined>(setting.value)
  const [immediateSetting, setImmediateSetting] = useState<SettingType | undefined>(setting.value)
  const prevValue = useRef(immediateSetting)

  useEffect(() => {
    setImmediateSetting(setting.value)
  }, [setting.value])

  useEffect(() => {
    prevValue.current = immediateSetting
  }, [immediateSetting])

  const onSelectChange = (v?: string) => {
    const settingVal = v as SettingType
    setImmediateSetting(settingVal)
    setting
      .set(settingVal)
      .then(() => {
        safeValue.current = settingVal
      })
      .catch((e) => {
        toast.showToast({ message: e })
        setImmediateSetting(safeValue.current)
      })
  }

  const { values } = display
  const valueStr = String(immediateSetting)
  const togglelabel = valueStr[0].toLocaleUpperCase() + valueStr.slice(1)
  const currIdx = values.findIndex((v) => v.value === valueStr)
  const prevIdx = values.findIndex((v) => v.value === prevValue.current)
  const hasPrev = prevIdx !== -1
  const direction =
    hasPrev && currIdx !== prevIdx ? (currIdx > prevIdx ? 'forward' : 'backward') : null
  const enteringAnim = useMemo(
    () =>
      direction === 'forward'
        ? FadeInRight.duration(200)
        : direction === 'backward'
          ? FadeInLeft.duration(200)
          : undefined,
    [direction]
  )
  return (
    <View
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
        paddingVertical: 10,
      }}
    >
      {children}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <AText variant={'large'} entering={enteringAnim} key={currIdx}>
          {togglelabel}
        </AText>
        <ToggleGroup
          value={String(immediateSetting)}
          onValueChange={onSelectChange}
          variant="outline"
          type="single"
        >
          {values.map(({ Icon, value }, i) => {
            return (
              <ToggleGroupItem
                value={value}
                aria-label="Toggle bold"
                variant="outline"
                group={i === 0 ? 'first' : i === values.length - 1 ? 'last' : undefined}
              >
                <ToggleGroupIcon icon={Icon} size={20} />
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </View>
    </View>
  )
}
