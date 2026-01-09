import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Text } from '@/components/ui/text'
import {
  ArrowRight,
  Ellipsis,
  Heart,
  MessageCircle,
  ShoppingCart,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react-native'
import { View } from 'react-native'
import { LiquidGlassCard } from '../../components/tcg-card/GlassCard'

const USERS = [
  { name: 'John Doe', handle: '@johndoe', avatar: 'https://via.placeholder.com/150' },
  { name: 'Jane Smith', handle: '@janesmith', avatar: 'https://via.placeholder.com/150' },
  { name: 'Alice Johnson', handle: '@alicejohnson', avatar: 'https://via.placeholder.com/150' },
  { name: 'Bob Brown', handle: '@bobbrown', avatar: 'https://via.placeholder.com/150' },
]

const DummyAvatar = ({ user }: { user: (typeof USERS)[number] }) => {
  return (
    <Avatar size="md">
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

export function GalleryCard() {
  return (
    <View className="py-2">
      <View className="flex flex-row justify-between px-8 items-center">
        <View className="flex flex-row items-center gap-2">
          <DummyAvatar user={USERS[0]} />
          <View>
            <View className="flex-1">
              <View className="flex flex-col items-start justify-center">
                <Text variant="h4">Gallery Card</Text>
                <Text variant="h4">Shohei Ohtani</Text>
              </View>
              <Text className="text-xs text-muted-foreground">
                {USERS[0].name}-<Text className="text-xs text-primary-100">{USERS[0].handle}</Text>
              </Text>
            </View>
          </View>
        </View>
        <Ellipsis size={16} />
      </View>

      <View className="flex flex-col items-center justify-center my-4">
        <LiquidGlassCard
          variant="primary"
          className="p-4 items-center justify-center"
          style={{
            width: '80%',
            aspectRatio: 5 / 7,
            borderRadius: 12,
          }}
        />
        <View className="flex flex-row items-center">
          <Text className="text-center mt-2 text-lg">$15.99</Text>
          <ArrowRight size={12} className="pt-4" />
          <Text className="text-center mt-2 text-lg">$15.99</Text>
        </View>
      </View>

      <View>
        <View className="flex flex-row justify-between px-12">
          <View className="flex flex-row gap-4">
            <Heart size={28} />
            <MessageCircle size={28} />
            <ShoppingCart size={28} />
          </View>
          <View className="flex flex-row gap-4">
            <ThumbsUp size={28} />
            <ThumbsDown size={28} />
          </View>
        </View>
      </View>
    </View>
  )
}
