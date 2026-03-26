import { cn } from '@/lib/utils/index'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

function Skeleton({
  className,
  style,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return (
    <View
      style={[{ backgroundColor: Colors.$backgroundDisabled }, style]}
      className={cn(' animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

function SkeletonView({
  className,
  children,
  loading = true,
  style,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View> & { loading?: boolean }) {
  return loading ? (
    <View
      style={[{ backgroundColor: Colors.$backgroundDisabled }, style]}
      className={cn('animate-pulse rounded-md', className)}
      {...props}
    />
  ) : (
    children
  )
}

export { Skeleton, SkeletonView }
