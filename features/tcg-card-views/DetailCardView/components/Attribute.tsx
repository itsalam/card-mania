import { Text } from '@/components/ui/text/base-text'
import React from 'react'
import { View } from 'react-native'

export const Attribute = ({ label, value }: { label: string; value: string }) => {
  return (
    <View className="flex flex-col items-start justify-start">
      <Text className="text-muted-foreground text-left font-spaceMono text-sm">{label}</Text>
      <Text className="text-lg font-bold text-nowrap text-right">{value}</Text>
    </View>
  )
}
