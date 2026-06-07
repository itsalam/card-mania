import { Text } from '@/components/ui/text'
import { ChevronDown, ChevronRight, ChevronUp, Layers } from 'lucide-react-native'
import React, { ReactNode, useState } from 'react'
import { View } from 'react-native'
import { BorderRadiuses, Colors, TouchableOpacity } from 'react-native-ui-lib'

export const CollectionGroupContainer = ({
  name,
  onNavigate,
  children,
}: {
  name: string
  onNavigate?: () => void
  children?: ReactNode
}) => {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <View>
      <View
        style={{
          borderColor: Colors.$outlineNeutral,
          borderRadius: BorderRadiuses.br30,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 12,
            paddingTop: 8,
          }}
        >
          {/* Left zone: navigates to the collection */}
          <TouchableOpacity
            onPress={onNavigate}
            disabled={!onNavigate}
            style={{
              borderRadius: BorderRadiuses.br60,
              backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.4),
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              padding: 4,
              paddingHorizontal: 12,
            }}
          >
            <Layers size={16} color={Colors.$iconDefault} />
            <Text
              variant={'h4'}
              style={{
                color: Colors.$textDefault,
                fontSize: 16,
                fontWeight: '600',
                letterSpacing: 0,
              }}
            >
              {name}
            </Text>
            {onNavigate && <ChevronRight size={12} color={Colors.$iconNeutral} />}
          </TouchableOpacity>

          {/* Right zone: collapse / expand */}
          <TouchableOpacity
            onPress={() => setCollapsed((c) => !c)}
            style={{ paddingHorizontal: 14, paddingVertical: 12, flex: 1 }}
          >
            <View style={{ marginLeft: 'auto' }}>
              {collapsed ? (
                <ChevronDown size={22} color={Colors.$iconDefault} />
              ) : (
                <ChevronUp size={22} color={Colors.$iconDefault} />
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 18 }}>{!collapsed && children}</View>
      </View>
    </View>
  )
}
