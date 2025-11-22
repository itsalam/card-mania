import { Text, TextClassContext } from '@/components/ui/text'
import { cn } from '@/lib/utils'
import * as TabsPrimitive from '@rn-primitives/tabs'
import { Platform, TextProps, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

function Tabs({
  className,
  ...props
}: TabsPrimitive.RootProps & React.RefAttributes<TabsPrimitive.RootRef>) {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-2', className)} {...props} />
}

function TabsList({
  className,
  ...props
}: TabsPrimitive.ListProps & React.RefAttributes<TabsPrimitive.ListRef>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'flex h-11 flex-row items-center justify-center rounded-lg p-[3px]',
        Platform.select({ web: 'inline-flex w-fit', native: 'mr-auto' }),
        className
      )}
      style={{
        backgroundColor: Colors.$backgroundElevated,
      }}
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
        'text-foreground dark:text-muted-foreground text-sm font-medium',
        value === props.value && 'dark:text-foreground'
      )}
    >
      <TabsPrimitive.Trigger
        className={cn(
          'flex h-[calc(100%-1px)] flex-row items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 shadow-none shadow-black/5',
          Platform.select({
            web: 'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring inline-flex cursor-default whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0',
          }),
          props.disabled && 'opacity-50',
          props.value === value && 'bg-background dark:border-foreground/10 dark:bg-input/30',
          className
        )}

        style={props.value === value ?{
          backgroundColor: Colors.$backgroundElevatedLight,
        } : {
          backgroundColor: Colors.$backgroundElevated,
        }}
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
      className={cn(Platform.select({ web: 'flex-1 outline-none' }), className)}
      {...props}
    />
  )
}

function TabsLabel({
  className,
  label,
  value,
  style,
  children,
  ...props
}: TextProps & { label: string; value: string }) {
  const { value: currentValue } = TabsPrimitive.useRootContext()
  return (
    <View className="flex flex-row items-center justify-center gap-2">
      {children}
      <Text
        className="text-md"
        style={[
          style,
          currentValue === value ? { color: Colors.$textDefault } : { color: Colors.$textDefault },
          { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
        ]}
        {...props}
      >
        {label.charAt(0).toUpperCase() + label.slice(1)}
      </Text>
    </View>
  )
}

export { Tabs, TabsContent, TabsLabel, TabsList, TabsTrigger }

