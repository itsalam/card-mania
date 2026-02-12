import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { cn } from '@/lib/utils/cn'
import * as TabsPrimitive from '@rn-primitives/tabs'
import { Pressable, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { TabsList, TabsTrigger } from '../ui/tabs'

export function FolderTabList({ className, ...props }: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        `flex-row px-8 items-end justify-between h-16 gap-2 z-activeTab relative translate-y-px`,
        className
      )}
      style={{ transform: [{ translateY: 2 }] }}
      {...props}
    />
  )
}

export function FolderTabTrigger({
  value,
  children,
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  const scheme = useEffectiveColorScheme()
  const { value: currentValue } = TabsPrimitive.useRootContext()
  return (
    <TabsTrigger
      value={value}
      {...props}
      className={cn(
        `flex flex-row gap-2 px-4 py-2 rounded-t-md border border-b-0 shadow-none`,
        value === currentValue ? 'border-b-0' : 'border-b ',
        className
      )}
      key={scheme}
      style={
        value === currentValue
          ? {
              backgroundColor: Colors.$backgroundElevatedLight,
              borderColor: Colors.$outlineNeutral,
            }
          : {
              backgroundColor: Colors.$backgroundNeutral,
              borderColor: Colors.$outlineNeutral,
              transform: [{ translateY: -1 }],
            }
      }
    >
      {children}
    </TabsTrigger>
  )
}

export function FolderTabComponent({
  className,
  style,
  ...props
}: React.ComponentProps<typeof Pressable>) {
  return (
    <Pressable
      className={cn(
        `flex flex-row gap-2 px-4 py-2 rounded-t-md border border-b-0  shadow-none`,
        className
      )}
      style={[{ borderColor: Colors.$outlineNeutral }, style]}
      {...props}
    />
  )
}

export function FolderTabsContainer({
  className,
  style,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <View
      className={cn('border-t z-tab', className)}
      style={[
        {
          borderColor: Colors.$outlineNeutral,
          backgroundColor: Colors.$backgroundElevatedLight,
          height: '100%',
        },
        style,
      ]}
      {...props}
    />
  )
}
