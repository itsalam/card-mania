import { cn } from '@/lib/utils/index'
import * as AvatarPrimitive from '@rn-primitives/avatar'
import { cva, VariantProps } from 'class-variance-authority'
import { ComponentProps, createContext, useContext } from 'react'
import { Colors } from 'react-native-ui-lib'
import { Text } from './text'

const avatarStyle = cva(
  'rounded-full justify-center items-center relative bg-primary-600 group-[.avatar-group]/avatar-group:-ml-2.5',
  {
    variants: {
      size: {
        xs: 'w-6 h-6',
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16',
        xl: 'w-24 h-24',
        '2xl': 'w-32 h-32',
      },
    },
  }
)

const avatarFallbackTextStyle = cva(
  'text-typography-0 font-semibold overflow-hidden text-transform:uppercase web:cursor-default',
  {
    variants: {
      size: {
        xs: 'text-2xs',
        sm: 'text-xs',
        md: 'text-base',
        lg: 'text-xl',
        xl: 'text-3xl',
        '2xl': 'text-5xl',
      },
    },
  }
)

const VariantContext = createContext<Parameters<typeof avatarStyle>[0] | null>(null)

function Avatar({
  className,
  size,
  ...props
}: AvatarPrimitive.RootProps &
  React.RefAttributes<AvatarPrimitive.RootRef> &
  VariantProps<typeof avatarStyle>) {
  return (
    <VariantContext value={{ size }}>
      <AvatarPrimitive.Root
        style={{
          backgroundColor: 'red',
        }}
        className={cn(
          'relative flex size-8 shrink-0 overflow-hidden rounded-full',
          avatarStyle({ size }),
          className
        )}
        {...props}
      />
    </VariantContext>
  )
}

function AvatarImage({
  className,
  ...props
}: AvatarPrimitive.ImageProps & React.RefAttributes<AvatarPrimitive.ImageRef>) {
  return <AvatarPrimitive.Image className={cn('aspect-square size-full', className)} {...props} />
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.FallbackProps & React.RefAttributes<AvatarPrimitive.FallbackRef>) {
  return (
    <AvatarPrimitive.Fallback
      style={{
        backgroundColor: Colors.$backgroundPrimaryMedium,
      }}
      className={cn('flex size-full flex-row items-center justify-center rounded-full', className)}
      {...props}
    />
  )
}

function AvatarFallbackText({ className, ...props }: ComponentProps<typeof Text>) {
  const variant = useContext(VariantContext)
  return (
    <Text {...props} className={cn([className, avatarFallbackTextStyle(variant ?? undefined)])} />
  )
}

export { Avatar, AvatarFallback, AvatarFallbackText, AvatarImage }
