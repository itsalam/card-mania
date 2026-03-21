'use client'
import { cn } from '@/lib/utils/cn'
// Originally created by @dorian_baffier
// Modified by @vincentlam
/**
 * @author: @dorian_baffier
 * @description: Liquid Glass Card
 * @version: 1.0.0
 * @date: 2025-06-26
 * @license: MIT
 * @website: https://kokonutui.com
 * @github: https://github.com/kokonut-labs/kokonutui
 */

import { VariantProps } from '@gluestack-ui/nativewind-utils'
import { tva } from '@gluestack-ui/nativewind-utils/tva'
import * as React from 'react'
import { View } from 'react-native'
import Svg, { Defs, FeComposite, FeGaussianBlur, Filter } from 'react-native-svg'
import { Card } from 'react-native-ui-lib'

const cardVariants = tva({
  base: 'relative',
  variants: {
    variant: {
      default: 'hover:scale-[1.01] text-foreground',
      primary: 'text-foreground',
      destructive: 'text-foreground',
      secondary: 'text-foreground',
    },
    size: {
      default: 'p-6',
      sm: 'p-4',
      lg: 'p-8',
      xl: 'p-10',
    },
    hover: {
      default: 'hover:scale-[1.02]',
      none: '',
      glow: 'hover:shadow-lg hover:shadow-primary-100/20',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
    hover: 'default',
  },
})

export interface LiquidGlassCardProps
  extends React.ComponentPropsWithoutRef<typeof Card>, VariantProps<typeof cardVariants> {
  asChild?: boolean
  glassEffect?: boolean
}

function GlassFilter() {
  const filterId = React.useId()

  return (
    <Svg className="hidden">
      <Defs>
        <Filter
          id={filterId}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
          // colorInterpolationFilters="sRGB"
        >
          <FeGaussianBlur in="turbulence" stdDeviation="2" result="blurredNoise" />

          <FeGaussianBlur in="displaced" stdDeviation="4" result="finalBlur" />
          <FeComposite in="finalBlur" in2="finalBlur" operator="over" />
        </Filter>
      </Defs>
    </Svg>
  )
}

// Card Header Component
type CardHeaderProps = React.ComponentProps<typeof View> & {
  title: string
  subtitle?: string
  icon?: React.ReactNode
}

function CardHeader({ title, subtitle, icon, className, ...props }: CardHeaderProps) {
  return (
    <View className={cn('flex items-start justify-between gap-4', className)} {...props}>
      <View className="space-y-1.5">
        <h3 className="font-semibold leading-none tracking-tight text-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground/80">{subtitle}</p>}
      </View>
      {icon && <View className="text-muted-foreground/70">{icon}</View>}
    </View>
  )
}

// Card Content Component
function CardContent({ className, ...props }: React.ComponentProps<typeof View>) {
  return <View className={cn('pt-6 text-foreground', className)} {...props} />
}

type CardRef = React.ComponentRef<typeof Card>

const LiquidGlassCard = React.forwardRef<CardRef, LiquidGlassCardProps>(
  (
    { className, variant, size, hover, asChild = false, glassEffect = true, children, ...props },
    ref
  ) => {
    return (
      <Card
        className={cn(
          'relative overflow-hidden',
          cardVariants({ variant, size, hover, className }),
          className
        )}
        {...props}
        ref={ref}
      >
        {/* Glass effect overlay */}
        {/* <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 0,
            height: '100%',
            width: '100%',
            pointerEvents: 'none',
            // Example shadow for light mode
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            // You may need to use elevation for Android
            elevation: 2,
          }}
        /> */}

        {children}
        {/* <View className="absolute inset-0 z-20 rounded-lg bg-gradient-to-r from-transparent dark:via-white/5 via-black/5 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none" /> */}
        {/* {glassEffect && <GlassFilter />} */}
      </Card>
    )
  }
)

LiquidGlassCard.displayName = 'LiquidGlassCard'

export { CardContent, CardHeader, LiquidGlassCard }
