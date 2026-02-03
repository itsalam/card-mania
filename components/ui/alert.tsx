import { Icon } from '@/components/ui/icon'
import { Text, TextClassContext } from '@/components/ui/text'
import { cn } from '@/lib/utils/index'
import type { LucideIcon } from 'lucide-react-native'
import * as React from 'react'
import { View, type ViewProps } from 'react-native'

function Alert({
  className,
  variant,
  children,
  icon,
  iconClassName,
  ...props
}: ViewProps &
  React.RefAttributes<View> & {
    icon?: LucideIcon
    variant?: 'default' | 'destructive'
    iconClassName?: string
  }) {
  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm text-foreground',
        variant === 'destructive' && 'text-destructive',
        className
      )}
    >
      <View
        role="alert"
        className={cn(
          'bg-card border-border relative w-full rounded-lg border px-6 pb-2 pt-5',
          className
        )}
        {...props}
      >
        {icon && (
          <View className="absolute left-3.5 top-3">
            <Icon
              as={icon}
              style={{
                width: 24,
                height: 24,
              }}
              className={cn(variant === 'destructive' && 'text-destructive', iconClassName)}
            />
          </View>
        )}
        {children}
      </View>
    </TextClassContext.Provider>
  )
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      variant={'large'}
      className={cn('mb-1 ml-0.5 min-h-4 pl-6 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  const textClass = React.useContext(TextClassContext)
  return (
    <Text
      className={cn(
        'text-muted-foreground ml-0.5 pb-1.5 pl-6 text-sm leading-relaxed',
        textClass?.includes('text-destructive') && 'text-destructive/90',
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertDescription, AlertTitle }
