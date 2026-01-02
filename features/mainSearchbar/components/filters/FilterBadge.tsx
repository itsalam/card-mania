import { ToggleBadge } from '@/components/ui/badge'
import { DollarSign } from 'lucide-react-native'
import { ComponentProps } from 'react'
import { Assets, Chip } from 'react-native-ui-lib'
import { DisplayFilterLabels, FiltersKeys } from './providers'
require('@/assets/rn-ui')

const LabelToBadgeIcon = {
  cards: {
    iconSource: Assets.icons.WebStore,
  },
  sets: {
    iconSource: Assets.icons.PlayingCards,
  },
  collections: {
    iconSource: Assets.icons.Folder,
  },
  priceRange: {
    leftElement: <DollarSign size={24} style={{ marginLeft: 10 }} />,
  },
  sealed: {
    iconSource: Assets.icons.Fluorescent,
  },
  owned: {
    iconSource: Assets.icons.Verified,
  },
  wishlisted: {
    iconSource: Assets.icons.BookmarkHeart,
  },
  unowned: {
    iconSource: Assets.icons.VerifiedOff,
  },
} as Record<FiltersKeys, Pick<ComponentProps<typeof Chip>, 'iconSource' | 'leftElement'>>

export function FilterBadge({
  filterKey,
  label,
  ...props
}: ComponentProps<typeof ToggleBadge> & { filterKey: FiltersKeys }) {
  const iconProps = LabelToBadgeIcon[filterKey as FiltersKeys]
  label = label || DisplayFilterLabels[filterKey as FiltersKeys]
  return (
    <ToggleBadge
      className="text-foreground"
      label={label}
      iconStyle={{
        width: 28,
        height: 28,
        marginLeft: 10,
      }}
      size={{ height: 36 }}
      {...props}
      {...iconProps}
    />
  )
}
