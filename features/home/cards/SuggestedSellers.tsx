import { Box } from '@/components/ui/box'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { UserContact } from '@/features/users/components/UserAvatars'
import { DUMMY_USERS } from '@/features/users/helpers'
import React, { ComponentProps } from 'react'
import { View } from 'react-native'

type ExpandableCardProps = {} & ComponentProps<typeof Card>

export function SuggestedSellers(props: ExpandableCardProps) {
  return (
    <Card className="w-full px-8" {...props}>
      <Box className="h-auto w-full z-1 items-center justify-between flex flex-row">
        <Text className="font-bold">{'Suggested Sellers'}</Text>
      </Box>
      <View className="w-full flex flex-col pt-4">
        {DUMMY_USERS.map((user) => (
          <View
            key={user.handle}
            className="flex flex-row items-center justify-between gap-4 p-4 py-2"
          >
            <UserContact user={user} />
            <Button className="rounded-full border" variant="outline">
              <Text>Follow</Text>
            </Button>
          </View>
        ))}
      </View>
    </Card>
  )
}
