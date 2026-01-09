import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Text } from '@/components/ui/text'
import { ArrowRight } from 'lucide-react-native'
import { View } from 'react-native'
import { LiquidGlassCard } from '../../components/tcg-card/GlassCard'

const USERS = [
  { name: 'John Doe', handle: '@johndoe', avatar: 'https://via.placeholder.com/150' },
  { name: 'Jane Smith', handle: '@janesmith', avatar: 'https://via.placeholder.com/150' },
  { name: 'Alice Johnson', handle: '@alicejohnson', avatar: 'https://via.placeholder.com/150' },
  { name: 'Bob Brown', handle: '@bobbrown', avatar: 'https://via.placeholder.com/150' },
]

const ICON_SIZE = 20

const DummyAvatar = ({ user }: { user: (typeof USERS)[number] }) => {
  return (
    <Avatar size="xs">
      <AvatarFallbackText>{user.name[0]}</AvatarFallbackText>
      <AvatarImage
        source={{
          uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80',
        }}
      />
      {/* <AvatarBadge /> */}
    </Avatar>
  )
}

export function GridCard() {
  return (
    <View className="flex flex-col items-center justify-center">
      <LiquidGlassCard
        variant="primary"
        className="p-4 justify-center flex items-center"
        style={{
          height: 120,
          aspectRatio: 5 / 7,
          borderRadius: 12,
        }}
      />
      <View className="flex flex-row items-center">
        <Text className="text-center mt-2 text-sm">$15.99</Text>
        <ArrowRight size={12} className="pt-4" />
        <Text className="text-center mt-2 text-sm">$15.99</Text>
      </View>
    </View>
  )
}
