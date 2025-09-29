import { CollectionsPreview } from './cards/CollectionsPreview'
import { RecentlyViewed } from './cards/RecentlyViewed'

import { Separator } from '@/components/ui/separator'
import React from 'react'
import { ScrollView, View } from 'react-native'
import { AvailableNow } from './cards/AvailableNow'
import { SuggestedSellers } from './cards/SuggestedSellers'

export function FeedPage() {
  return (
      <ScrollView className="flex-grow" contentContainerStyle={{ flexGrow: 1 }}>
      <RecentlyViewed />
      <View className="flex flex-col justify-between items-center px-8 w-full">
        <Separator className="my-2 px-8" />
      </View>
      <SuggestedSellers />
      <View className="flex flex-col justify-between items-center px-8 w-full">
        <Separator className="my-2" />
      </View>

      <AvailableNow />
      <View className="px-8">
        <Separator className="my-2 px-8" />
      </View>
      <CollectionsPreview />
        </ScrollView>
  )
}
