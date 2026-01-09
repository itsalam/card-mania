import { Text } from '@/components/ui/text'
import { CircleQuestionMark, LucideIcon } from 'lucide-react-native'
import { ReactNode, useState } from 'react'
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native'
import { Button, Colors, Hint, HintProps } from 'react-native-ui-lib'
import { HintPositions } from 'react-native-ui-lib/src/components/hint/types'

export const OptionLabel = ({
  icon: Icon,
  label,
  hintProps,
  description,
  style,
}: {
  icon: LucideIcon
  description?: string
  label: ReactNode
  hintProps?: HintProps
  style?: StyleProp<ViewStyle>
}) => {
  const [toggleHint, setToggleHint] = useState(false)
  const { onBackgroundPress, ...rest } = hintProps ?? {}

  return (
    <View
      style={[
        {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        style,
      ]}
    >
      <TouchableOpacity
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
        {...(hintProps
          ? {
              onPress: () => {
                setToggleHint(!toggleHint)
              },
            }
          : {
              disabled: true,
              activeOpacity: 1,
            })}
      >
        <Icon color={Colors.$textNeutralLight} size={30} />
        <View>
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text
              style={[
                {
                  color: Colors.$textNeutralLight,
                  fontSize: 20,
                  lineHeight: 24,
                  fontWeight: '500',
                },
              ]}
            >
              {label}
            </Text>
            {hintProps && (
              <Hint
                visible={toggleHint}
                useModal
                position={HintPositions.TOP}
                onBackgroundPress={(e) => {
                  onBackgroundPress?.(e)
                  setToggleHint(false)
                }}
                {...rest}
              >
                <Button
                  onPress={() => {
                    setToggleHint(!toggleHint)
                  }}
                  size="large"
                  iconSource={(style) => (
                    <CircleQuestionMark style={style} color={Colors.$iconDefaultLight} />
                  )}
                />
              </Hint>
            )}
          </View>
          {description && (
            <Text
              numberOfLines={2}
              style={[
                {
                  color: Colors.$textNeutralLight,
                  fontSize: 10,
                  lineHeight: 12,
                  fontWeight: '500',
                  flexShrink: 1,
                },
              ]}
            >
              {description}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  )
}
