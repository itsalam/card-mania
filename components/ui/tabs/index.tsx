import { Text, TextClassContext } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import * as TabsPrimitive from '@rn-primitives/tabs'
import { LucideIcon } from 'lucide-react-native'
import { ReactNode } from 'react'
import { Platform, StyleProp, TextProps, View, ViewStyle } from 'react-native'
import { Colors } from 'react-native-ui-lib'

function Tabs({
  className,
  ...props
}: TabsPrimitive.RootProps & React.RefAttributes<TabsPrimitive.RootRef>) {
  return <TabsPrimitive.Root className={cn('flex flex-col', className)} {...props} />
}

function TabsList({
  className,
  style,
  ...props
}: TabsPrimitive.ListProps & React.RefAttributes<TabsPrimitive.ListRef>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex flex-row items-center justify-center rounded-lg p-2',
        Platform.select({ web: 'inline-flex w-fit', native: 'mr-auto' }),
        className
      )}
      style={[
        {
          backgroundColor: Colors.$backgroundElevated,
        },
        style,
      ]}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: TabsPrimitive.TriggerProps & React.RefAttributes<TabsPrimitive.TriggerRef>) {
  const { value } = TabsPrimitive.useRootContext()

  return (
    <TextClassContext.Provider
      value={cn(
        'text-foreground dark:text-muted-foreground font-medium',
        value === props.value && 'dark:text-foreground'
      )}
    >
      <TabsPrimitive.Trigger
        className={cn(
          'flex flex-row items-center justify-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 shadow-none shadow-black/5',
          Platform.select({
            web: 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex cursor-default whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
          }),
          props.disabled && 'opacity-50',
          props.value === value && 'bg-background dark:border-foreground/10 dark:bg-input/30',
          className
        )}
        style={
          props.value === value
            ? {
                backgroundColor: Colors.$backgroundElevatedLight,
              }
            : {
                backgroundColor: Colors.$backgroundElevated,
              }
        }
        {...props}
      />
    </TextClassContext.Provider>
  )
}

function TabsContent({
  className,
  ...props
}: TabsPrimitive.ContentProps & React.RefAttributes<TabsPrimitive.ContentRef>) {
  return (
    <TabsPrimitive.Content
      className={cn(Platform.select({ web: 'flex-1' }), className)}
      {...props}
    />
  )
}

function TabsLabel({
  className,
  label,
  value,
  style,
  iconRight: IconRight,
  iconLeft: IconLeft,
  leftElement,
  rightElement,
  containerStyle,
  ...props
}: TextProps & {
  leftElement?: (current: boolean) => ReactNode | ReactNode
  rightElement?: (current: boolean) => ReactNode | ReactNode
  label?: string
  value: string
  iconRight?: LucideIcon
  iconLeft?: LucideIcon
  containerStyle?: StyleProp<ViewStyle>
}) {
  const TAB_ICON_HEIGHT = 20
  const { value: currentValue } = TabsPrimitive.useRootContext()
  const isCurrent = currentValue === value
  return (
    <View className="flex flex-row items-center justify-center gap-2" style={containerStyle}>
      {IconLeft ? (
        <IconLeft
          size={TAB_ICON_HEIGHT}
          color={Colors.$textDefault}
          strokeWidth={2.5}
          style={{ marginLeft: 4 }}
        />
      ) : leftElement instanceof Function ? (
        leftElement(isCurrent)
      ) : (
        leftElement
      )}
      {label?.length && (
        <Text
          variant={'h4'}
          style={[
            {
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            },
            style,
            isCurrent ? { color: Colors.$textPrimary } : { color: Colors.$textDefault },
          ]}
          {...props}
        >
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </Text>
      )}
      {IconRight ? (
        <IconRight
          size={TAB_ICON_HEIGHT}
          color={Colors.$textDefault}
          strokeWidth={2.5}
          style={{ marginLeft: 4 }}
        />
      ) : rightElement instanceof Function ? (
        rightElement(isCurrent)
      ) : (
        rightElement
      )}
    </View>
  )
}

export { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger }
