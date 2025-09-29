import { GalleryCard } from '@/components/tcg-card/views/GalleryCard'
import { GridCard } from '@/components/tcg-card/views/GridCard'
import { ListCard } from '@/components/tcg-card/views/ListCard'

import { DropdownMenuLabel } from '@/components/ui/dropdown-menu'
import { ToggleGroup, ToggleGroupIcon, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils/cn'
import { LayoutGrid, LayoutList, RectangleVertical } from 'lucide-react-native'
import React from 'react'
import { ScrollView, View } from 'react-native'
import { useHomePageStore } from './provider'

export function ViewToggle({
  value,
  setValue,
}: {
  value?: string
  setValue: (value?: string) => void
}) {
  return (
    <View className="justify-center items-center">
      <ToggleGroup
        className="bg-background-0"
        variant="outline"
        size="sm"
        value={value}
        onValueChange={setValue}
        type="single"
      >
        <ToggleGroupItem variant="default" value="grid" group="first" aria-label="Toggle Grid">
          <ToggleGroupIcon icon={LayoutGrid} size={16} />
        </ToggleGroupItem>
        <ToggleGroupItem value="list" variant="default" aria-label="Toggle Detail List">
          <ToggleGroupIcon icon={LayoutList} size={16} />
        </ToggleGroupItem>
        <ToggleGroupItem value="gallery" variant="default" group="last" aria-label="Toggle Gallery">
          <ToggleGroupIcon icon={RectangleVertical} size={16} />
        </ToggleGroupItem>
      </ToggleGroup>
    </View>
  )
}

export function ExplorePage() {
  const { exploreLayout } = useHomePageStore()
  const ViewComp = React.useMemo(() => {
    switch (exploreLayout) {
      case 'grid':
        return GridCard
      case 'list':
        return ListCard
      case 'gallery':
        return GalleryCard
      default:
        return GalleryCard
    }
  }, [exploreLayout])

  return (
    <>
      <View className="relative">
        <ScrollView
          className="flex-grow"
          contentContainerStyle={{ flexGrow: 1, paddingVertical: 12 }}
        >
          <View
            className={cn(
              'pb-12 flex',
              exploreLayout === 'grid' ? 'flex-row flex-wrap gap-3' : 'flex-col',
              exploreLayout === 'list' ? 'px-4' : 'px-6',
              exploreLayout === 'gallery' ? 'gap-8' : ''
            )}
          >
            {Array(10)
              .fill(null)
              .map((_, index) => (
                <ViewComp key={index} />
              ))}
          </View>
        </ScrollView>
      </View>
    </>
  )
}

export function ExplorePageMenu() {
  const { exploreLayout, setExploreLayout } = useHomePageStore()
  return (
    <>
      <View className='w-full flex flex-row justify-between items-end'>
       <View className='flex flex-row items-center gap-2'>
        <DropdownMenuLabel>Layout</DropdownMenuLabel>
               <ViewToggle value={exploreLayout} setValue={setExploreLayout} />
       </View>

      </View>
    </>
  )
}
