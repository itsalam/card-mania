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
import { Card, Colors } from 'react-native-ui-lib'

/**
 * The "glass" surface: translucent elevated fill + hairline outline. A plain fill rather than a
 * BlurView so it stays cheap when repeated down a long list. Call at render time — Colors
 * tokens resolve against the active theme, so this must not be hoisted into a StyleSheet.
 * Reference: Klarna dark-mode product list, stacked rounded cards
 * (https://refero.design/screens/4023c1b3-a2ee-43ae-97f0-ddc61d8b526f).
 */
export function glassSurfaceStyle() {
  return {
    backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.45),
    borderWidth: 1,
    // Full-strength outline (as PortfolioSummary uses) — at 0.4 alpha it vanished in light mode.
    borderColor: Colors.$outlineNeutral,
  }
}

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
    {
      className,
      variant,
      size,
      hover,
      asChild = false,
      glassEffect = true,
      style,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Card
        className={cn(
          'relative overflow-hidden',
          cardVariants({ variant, size, hover, className }),
          className
        )}
        // ui-lib's default shadow shows through a translucent fill, so glass drops it; callers
        // that want depth (e.g. AvailableNow) still pass their own shadow* style.
        enableShadow={!glassEffect}
        {...props}
        style={[glassEffect && glassSurfaceStyle(), style]}
        ref={ref}
      >
        {children}
      </Card>
    )
  }
)

LiquidGlassCard.displayName = 'LiquidGlassCard'

export { CardContent, CardHeader, LiquidGlassCard }
