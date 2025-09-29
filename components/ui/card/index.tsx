import type { VariantProps } from '@gluestack-ui/nativewind-utils'
import { BlurView } from 'expo-blur'
import React, { ComponentProps } from 'react'
import { NativeMethods, View, ViewProps } from 'react-native'
import { cardStyle } from './styles'

type ICardProps = ComponentProps<typeof View> &
  ViewProps &
  NativeMethods &
  VariantProps<typeof cardStyle> & { className?: string }

const Card = React.forwardRef<React.ComponentRef<typeof View>, ICardProps>(function Card(
  { className, size = 'md', variant = 'ghost', ...props },
  ref
) {
  return <View className={cardStyle({ size, variant, class: className })} {...props} ref={ref} />
})

export const BlurCard = React.forwardRef<React.ComponentRef<typeof BlurView>, ICardProps>(
  function BlurCard({ className, size = 'md', variant = 'ghost', ...props }, ref) {
    return (
      <BlurView
        intensity={10}
        tint="light"
        className={cardStyle({ size, variant, class: className })}
        {...props}
        ref={ref}
      />
    )
  }
)

Card.displayName = 'Card'
BlurCard.displayName = 'BlurCard'

export { Card }
