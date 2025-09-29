import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Box } from '@/components/ui/box'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import React, { ComponentProps } from 'react'
import { View } from 'react-native'

const USERS = [
  { name: 'John Doe', handle: '@johndoe', avatar: 'https://via.placeholder.com/150' },
  { name: 'Jane Smith', handle: '@janesmith', avatar: 'https://via.placeholder.com/150' },
  { name: 'Alice Johnson', handle: '@alicejohnson', avatar: 'https://via.placeholder.com/150' },
  { name: 'Bob Brown', handle: '@bobbrown', avatar: 'https://via.placeholder.com/150' },
]

type ExpandableCardProps = {} & ComponentProps<typeof Card>

export function SuggestedSellers(props: ExpandableCardProps) {
  return (
    <Card className="w-full px-8" {...props}>

      <Box className="h-auto w-full z-1 items-center justify-between flex flex-row">
        <Heading size="2xl">{'Suggested Sellers'}</Heading>
      </Box>
              <View className="w-full flex flex-col pt-4">
        {USERS.map((user) => (
          <View key={user.handle} className="flex flex-row items-center gap-4 p-4 py-2">
            <Avatar size="md">
              <AvatarFallbackText>{user.name[0]}</AvatarFallbackText>
              <AvatarImage
                source={{
                  uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=687&q=80',
                }}
              />
              {/* <AvatarBadge /> */}
            </Avatar>
            <View className='flex-1'>
              <Text className='text-sm text-muted-foreground'>{user.name}</Text>
              <Text className='text-primary-100'>{user.handle}</Text>
            </View>
            <Button className='rounded-full border' variant="outline"><Text>Follow</Text></Button>
          </View>
        ))}
      </View>
    </Card>
  )
}
