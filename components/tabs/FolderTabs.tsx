import { cn } from '@/lib/utils/cn'
import { Pressable, View } from 'react-native'
import { TabsList, TabsTrigger } from '../ui/tabs/tabs'

export function FolderTabList({ className, ...props }: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        `flex-row px-8 items-end justify-between h-16 gap-2 z-activeTab relative translate-y-px`,
        className
      )}
      {...props}
    ></TabsList>
  )
}

export function FolderTabTrigger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      {...props}
      className={cn(
        `flex flex-row gap-2 px-4 py-2 rounded-t-md border border-b-0 border-neutral-300 shadow-none`,
        className
      )}
    >
      {children}
    </TabsTrigger>
  )
}

export function FolderTabComponent({
  className,
  ...props
}: React.ComponentProps<typeof Pressable>) {
  return (
    <Pressable
      className={cn(
        `flex flex-row gap-2 px-4 py-2 rounded-t-md border border-b-0 border-neutral-300 shadow-none`,
        className
      )}
      {...props}
    />
  )
}

export function FolderTabsContainer({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <View
      className={cn('flex-1 pt-2 border-t border-neutral-300 z-tab bg-background-0/60 ', className)}
      {...props}
    />
  )
}
