import { Text, TextClassContext } from '@/components/ui/text/base-text'
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
        'flex flex-row items-center justify-center rounded-lg',
        Platform.select({ web: 'inline-flex w-fit', native: 'mr-auto' }),
        className
      )}
      style={[
        {
          backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
          borderRadius: 999,
          paddingVertical: 0,
          // paddingHorizontal: 6,
          gap: 4,
        },
        style,
      ]}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  style,
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
          'flex flex-row items-center justify-center rounded-full border border-transparent',
          Platform.select({
            web: 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex cursor-default whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
          }),
          props.disabled && 'opacity-50',
          props.value === value && 'dark:border-foreground/10 dark:bg-input/30',
          className
        )}
        style={[
          {
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 6,
            alignSelf: 'stretch',
          },
          style,
          props.value === value && {
            backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.35),
          },
        ]}
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
  const TAB_ICON_HEIGHT = 13
  const { value: currentValue } = TabsPrimitive.useRootContext()
  const isCurrent = currentValue === value
  return (
    <View
      className="flex flex-row items-center justify-center"
      style={[{ gap: 5 }, containerStyle]}
    >
      {IconLeft ? (
        <IconLeft
          size={TAB_ICON_HEIGHT}
          color={isCurrent ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral}
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
              fontSize: 15,
              lineHeight: 18,
              color: Colors.$textNeutral,
            },
            style,
            // isCurrent ? { color: Colors.$backgroundPrimaryHeavy } : { color: Colors.$textNeutral },
          ]}
          {...props}
        >
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </Text>
      )}
      {IconRight ? (
        <IconRight
          size={TAB_ICON_HEIGHT}
          color={isCurrent ? Colors.$backgroundPrimaryHeavy : Colors.$textNeutral}
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
