import { TextClassContext } from '@/components/ui/text'
import { ToggleStyleOptions, toggleTextVariants, toggleVariants } from '@/components/ui/toggle'
import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { cn } from '@/lib/utils/index'
import { VariantProps } from '@gluestack-ui/nativewind-utils'
import { tva } from '@gluestack-ui/nativewind-utils/tva'
import * as ToggleGroupPrimitive from '@rn-primitives/toggle-group'
import type { LucideIcon } from 'lucide-react-native'
import * as React from 'react'
import { StyleProp, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants> | null>(null)

const toggleGroupVariants = tva({
  base: 'flex flex-row items-center justify-center rounded-xl p-[2px]',
  variants: {
    variant: {
      default: '',
      outline: '',
    },
    size: {
      default: 'h-10 native:min-h-12 ',
      sm: 'native:min-h-[40px] ',
      lg: 'h-11 native:min-h-14 ',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
})

const getToggleGroupStyles = ({ variant = 'default' }: { variant?: 'outline' | 'default' }) => {
  const containerStyle: StyleProp<ViewStyle> = {}
  if (variant === 'outline') {
    // containerStyle.borderWidth = 1
    // containerStyle.borderColor = Colors.$iconNeutral
  }
  return { containerStyle }
}

const getToggleGroupItemStyles = ({
  variant = 'default',
  pressed = false,
  active = false,
  group,
}: ToggleStyleOptions & { group?: 'first' | 'last' }) => {
  const containerStyle: StyleProp<ViewStyle> = {}
  if (variant === 'outline') {
    containerStyle.borderWidth = 1
    containerStyle.borderColor = Colors.$outlineNeutral
  }

  if (active) {
    containerStyle.backgroundColor =
      variant === 'outline' ? Colors.$backgroundNeutral : Colors.$backgroundNeutralHeavy
  }

  if (pressed) {
    containerStyle.backgroundColor =
      variant === 'outline' ? Colors.$backgroundDefault : Colors.$backgroundNeutralHeavy
  }

  if (group !== 'first') {
    containerStyle.borderTopLeftRadius = 0
    containerStyle.borderBottomLeftRadius = 0
  } else {
    containerStyle.borderRightWidth = 0
  }

  if (group !== 'last') {
    containerStyle.borderTopRightRadius = 1
    containerStyle.borderBottomRightRadius = 1
  } else {
    containerStyle.borderLeftWidth = 0
  }
  return { containerStyle }
}

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: ToggleGroupPrimitive.RootProps &
  VariantProps<typeof toggleVariants> & {
    ref?: React.RefObject<ToggleGroupPrimitive.RootRef>
  }) {
  const scheme = useEffectiveColorScheme() // 'light' | 'dark' | null
  const { style, ...rootProps } = props
  return (
    <ToggleGroupContext.Provider key={scheme} value={{ variant, size }}>
      <ToggleGroupPrimitive.Root
        style={[getToggleGroupStyles({ variant }).containerStyle, style]}
        className={cn(toggleGroupVariants({ variant, size }), className)}
        {...rootProps}
      >
        {children}
      </ToggleGroupPrimitive.Root>
    </ToggleGroupContext.Provider>
  )
}

function useToggleGroupContext() {
  const context = React.useContext(ToggleGroupContext)
  if (context === null) {
    throw new Error(
      'ToggleGroup compound components cannot be rendered outside the ToggleGroup component'
    )
  }
  return context
}

const ToggleGroupItemContext = React.createContext<{
  value: ToggleGroupPrimitive.ItemProps['value']
  active: boolean
} | null>(null)

function useToggleGroupItemContext() {
  const context = React.useContext(ToggleGroupItemContext)
  if (context === null) {
    throw new Error(
      'ToggleGroup compound components cannot be rendered outside the ToggleGroup component'
    )
  }
  return context
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  group,
  style,
  ...props
}: ToggleGroupPrimitive.ItemProps &
  VariantProps<typeof toggleVariants> & {
    ref?: React.RefObject<ToggleGroupPrimitive.ItemRef>
  }) {
  const context = useToggleGroupContext()
  const { value } = ToggleGroupPrimitive.useRootContext()
  const active = ToggleGroupPrimitive.utils.getIsSelected(value, props.value)

  return (
    <ToggleGroupItemContext.Provider value={{ value: props.value, active }}>
      <ToggleGroupPrimitive.Item
        style={[getToggleGroupItemStyles({ variant, active, group }).containerStyle, style]}
        className={cn(
          toggleTextVariants({ variant }),

          toggleVariants({
            variant: variant || context.variant,
            size: size || context.size,
            group: group || context.group,
          }),
          props.disabled && 'web:pointer-events-none opacity-50',

          className
        )}
        {...props}
      >
        {children}
      </ToggleGroupPrimitive.Item>
    </ToggleGroupItemContext.Provider>
  )
}

function ToggleGroupIcon({
  className,
  icon: Icon,
  ...props
}: React.ComponentPropsWithoutRef<LucideIcon> & {
  icon: LucideIcon
  value?: string
}) {
  const textClass = React.useContext(TextClassContext)
  const { value } = ToggleGroupPrimitive.useRootContext()

  return (
    <Icon
      // style={[
      //   ToggleGroupPrimitive.utils.getIsSelected(value, props.value)
      //     ? { backgroundColor: Colors.$backgroundNeutral, color: Colors.$iconDefault }
      //     : { color: Colors.$iconDisabled },
      //   {},
      // ]}
      color={Colors.$iconDefault}
      className={cn(textClass, className)}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupIcon, ToggleGroupItem }
