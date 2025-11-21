import { Avatar, AvatarFallbackText, AvatarImage } from '@/components/ui/avatar'
import { Box } from '@/components/ui/box'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Heading } from '@/components/ui/heading'
import { Text } from '@/components/ui/text'
import React, { ComponentProps } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

const USERS = [
  { name: 'ToppsCollector', handle: '@topps.cards', avatar: 'https://via.placeholder.com/150' },
  { name: 'PSA Finder', handle: '@psa_grader', avatar: 'https://via.placeholder.com/150' },
  { name: 'RookieChaser', handle: '@rookiechaser', avatar: 'https://via.placeholder.com/150' },
  { name: 'WaxPackMike', handle: '@waxpackmike', avatar: 'https://via.placeholder.com/150' },
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
                  uri: `https://picsum.photos/seed/${Math.random()}/200/200`,
                }}
              />
              {/* <AvatarBadge /> */}
            </Avatar>
            <View className='flex-1'>
              <Text style={{ color: Colors.$textDefault }}>{user.name}</Text>
              <Text style={{ color: Colors.$textNeutral }}>{user.handle}</Text>
            </View>
            <Button className='rounded-full border' variant="outline"><Text>Follow</Text></Button>
          </View>
        ))}
      </View>
    </Card>
  )
}
