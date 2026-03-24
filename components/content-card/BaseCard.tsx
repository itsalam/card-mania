import { View } from 'react-native'

export function BaseCard({ children, ...props }: React.ComponentProps<typeof View>) {
  return <View {...props}>{children}</View>
}
