// components/AppHeader.tsx
import { Text } from '@/components/ui/text'
import { BottomTabHeaderProps } from '@react-navigation/bottom-tabs'
import { Header, HeaderBackButton } from '@react-navigation/elements'
import { ChevronLeft } from 'lucide-react-native'
import React from 'react'
import { Pressable, StyleProp, View, ViewStyle } from 'react-native'

/** Use this for screens that live inside a React Navigation Stack */
export function AppNavHeader(props: BottomTabHeaderProps) {
  return (
    <Header
      title={props.options.title ?? ''}
      {...props}
      // unify styles here
      headerStyle={{ backgroundColor: '#0B0B0B' }}
      headerTitleAlign="center"
      headerTitleStyle={{ color: 'white', fontWeight: '600' }}
      headerLeft={(p) =>
        props.navigation.canGoBack() ? (
          <HeaderBackButton {...p} tintColor="white" onPress={props.navigation.goBack} />
        ) : null
      }
      headerRight={() => (
        <View style={{ paddingRight: 12 }}>
          {/* put a shared action button here if you want */}
        </View>
      )}
    />
  )
}

/** Use this *inside* a plain RN Modal (no navigator available) */
export function AppStandaloneHeader({
  title,
  onBack,
  right,
  background,
  style,
}: {
  title: React.ReactNode
  onBack?: () => void
  right?: React.ReactNode
  background?: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[{ paddingTop: 10, paddingBottom: 6 }, style]}>
      <View
        style={{
          height: 48,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
        }}
      >
        <View style={{ width: 64, alignItems: 'flex-start' }}>
          {onBack && (
            <Pressable onPress={onBack} hitSlop={12}>
              <ChevronLeft size={24} />
            </Pressable>
          )}
        </View>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text variant={'h2'}>{title}</Text>
        </View>
        <View style={{ width: 64, alignItems: 'flex-end' }}>{right}</View>
      </View>
      {background}
    </View>
  )
}
