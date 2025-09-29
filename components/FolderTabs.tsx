import { cn } from '@/lib/utils/cn'
import { View } from 'react-native'
import { TabsList, TabsTrigger } from './ui/tabs'

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

export function FolderTabTrigger({ className, ...props }: React.ComponentProps<typeof TabsTrigger>) {
  return (
    <TabsTrigger
      className={cn(
        `flex flex-row gap-2 px-4 py-2 rounded-t-md border border-b-0 border-neutral-300 shadow-none`,
        className
      )}
      {...props}
    ></TabsTrigger>
  )
}

export function FolderTabsContainer({
  className,
  ...props
}: React.ComponentProps<typeof TabsList>) {
  return (
    <View
      className={cn(
        'flex flex-col flex-1 pt-2 border-t border-neutral-300 z-tab mb-12 bg-background-0/60 ',
        className
      )}
      {...props}
    />
  )
}
