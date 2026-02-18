import { TextClassContext } from '@/components/ui/text'
import { cn } from '@/lib/utils/index'
import { VariantProps } from '@gluestack-ui/nativewind-utils'
import { tva } from '@gluestack-ui/nativewind-utils/tva'
import * as TogglePrimitive from '@rn-primitives/toggle'
import type { LucideIcon } from 'lucide-react-native'
import * as React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'

const toggleVariants = tva({
  base: 'web:group web:inline-flex items-center justify-center rounded-md web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
  variants: {
    variant: {
      default: '',
      outline: '',
    },
    size: {
      default: 'h-10 px-3 native:h-12 native:px-[12]',
      sm: 'h-9 px-2.5 native:h-10 native:px-[9]',
      lg: 'h-11 px-5 native:h-14 native:px-6',
    },
    group: {
      first: 'rounded-l-xl',
      last: 'rounded-r-xl',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

const toggleTextVariants = tva({
  base: 'text-sm native:text-base font-medium',
  variants: {
    variant: {
      default: '',
      outline: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

export type ToggleStyleOptions = {
  variant?: VariantProps<typeof toggleVariants>['variant']
  pressed?: boolean
  disabled?: boolean
  active?: boolean
}

const getToggleStyles = ({
  variant = 'default',
  pressed = false,
  active = false,
}: ToggleStyleOptions) => {
  const containerStyle: StyleProp<ViewStyle> = {}
  if (variant === 'outline') {
    containerStyle.borderWidth = 1
    containerStyle.borderColor = Colors.$iconNeutral
  }

  if (active) {
    containerStyle.backgroundColor =
      variant === 'outline' ? Colors.$backgroundNeutral : Colors.$backgroundNeutralHeavy
  }

  if (pressed) {
    containerStyle.backgroundColor =
      variant === 'outline' ? Colors.$backgroundDefault : Colors.$backgroundNeutralHeavy
  }
  return { containerStyle }
}

function Toggle({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.RootProps &
  VariantProps<typeof toggleVariants> &
  VariantProps<typeof toggleVariants> & {
    ref?: React.RefObject<TogglePrimitive.RootRef>
  }) {
  const { style, pressed, disabled, ...rootProps } = props
  const { containerStyle } = getToggleStyles({ variant, pressed })

  return (
    <TextClassContext.Provider value={cn(toggleTextVariants({ variant }), className)}>
      <TogglePrimitive.Root
        className={cn(
          toggleVariants({ variant, size }),
          disabled && 'web:pointer-events-none opacity-50',
          className
        )}
        style={[containerStyle, style]}
        {...rootProps}
      />
    </TextClassContext.Provider>
  )
}

function ToggleIcon({
  className,
  icon: Icon,
  ...props
}: React.ComponentPropsWithoutRef<LucideIcon> & {
  icon: LucideIcon
}) {
  const textClass = React.useContext(TextClassContext)
  return <Icon className={cn(textClass, className)} color={Colors.$iconDefault} {...props} />
}

export { getToggleStyles, Toggle, ToggleIcon, toggleTextVariants, toggleVariants }
