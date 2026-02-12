import { TextClassContext } from '@/components/ui/text'
import { toggleTextVariants, toggleVariants } from '@/components/ui/toggle'
import { cn } from '@/lib/utils/index'
import { VariantProps } from '@gluestack-ui/nativewind-utils'
import { tva } from '@gluestack-ui/nativewind-utils/tva'
import * as ToggleGroupPrimitive from '@rn-primitives/toggle-group'
import type { LucideIcon } from 'lucide-react-native'
import * as React from 'react'

const ToggleGroupContext = React.createContext<VariantProps<typeof toggleVariants> | null>(null)

const toggleGroupVariants = tva({
  base: 'flex flex-row items-center justify-center gap-px rounded-xl p-[2px]',
  variants: {
    variant: {
      default: 'bg-accent-foreground/10',
      outline:
        'border border-input bg-transparent web:hover:bg-accent active:bg-accent active:bg-accent',
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
  return (
    <ToggleGroupContext.Provider value={{ variant, size }}>
      <ToggleGroupPrimitive.Root
        className={cn(toggleGroupVariants({ variant, size }), className)}
        {...props}
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

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  group,
  ...props
}: ToggleGroupPrimitive.ItemProps &
  VariantProps<typeof toggleVariants> & {
    ref?: React.RefObject<ToggleGroupPrimitive.ItemRef>
  }) {
  const context = useToggleGroupContext()
  const { value } = ToggleGroupPrimitive.useRootContext()
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        toggleTextVariants({ variant }),
        ToggleGroupPrimitive.utils.getIsSelected(value, props.value)
          ? 'text-accent-foreground'
          : 'web:group-hover:text-muted-foreground',
        toggleVariants({
          variant: variant || context.variant,
          size: size || context.size,
          group: group || context.group,
        }),
        props.disabled && 'web:pointer-events-none opacity-50',
        ToggleGroupPrimitive.utils.getIsSelected(value, props.value) && 'bg-accent',
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

function ToggleGroupIcon({
  className,
  icon: Icon,
  ...props
}: React.ComponentPropsWithoutRef<LucideIcon> & {
  icon: LucideIcon
}) {
  const textClass = React.useContext(TextClassContext)
  return <Icon className={cn(textClass, className)} {...props} />
}

export { ToggleGroup, ToggleGroupIcon, ToggleGroupItem }
