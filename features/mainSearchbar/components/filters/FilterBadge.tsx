import { ToggleBadge } from '@/components/ui/badge'
import { Cards, WishlistCard } from '@/components/ui/icon'
import {
  Boxes,
  DollarSign,
  Folder,
  Library,
  Package,
  PackageOpen,
  ShoppingBag,
  Sparkle,
  Sparkles,
} from 'lucide-react-native'
import { ComponentProps } from 'react'
import { Chip } from 'react-native-ui-lib'
import { DisplayFilterLabels, FiltersKeys } from './providers'

require('@/assets/rn-ui')

const LabelToBadgeIcon = {
  marketplace: {
    leftElement: <ShoppingBag size={20} />,
  },
  catalog: {
    leftElement: <Library size={20} />,
  },
  cards: {
    leftElement: <Cards size={20} strokeWidth={0.25} />,
  },
  sets: {
    leftElement: <Boxes size={20} />,
  },
  collections: {
    leftElement: <Folder size={20} />,
  },
  priceRange: {
    leftElement: <DollarSign size={20} style={{ marginLeft: 10 }} />,
  },
  sealed: {
    leftElement: <Sparkles size={20} />,
  },
  owned: {
    leftElement: <PackageOpen size={20} />,
  },
  wishlisted: {
    leftElement: <WishlistCard size={20} strokeWidth={0.25} />,
  },
  unowned: {
    leftElement: (
      <Package size={20}>
        <Sparkle
          size={20}
          transform={[{ translateX: 12 }, { translateY: -0 }, { scale: 0.6 }]}
          strokeWidth={4}
        />
      </Package>
    ),
  },
} as Record<FiltersKeys, Pick<ComponentProps<typeof Chip>, 'iconSource' | 'leftElement'>>

export function FilterBadge({
  filterKey,
  label,
  ...props
}: ComponentProps<typeof ToggleBadge> & { filterKey: FiltersKeys }) {
  const iconProps = LabelToBadgeIcon[filterKey as FiltersKeys]
  label =
    label ||
    DisplayFilterLabels[filterKey as FiltersKeys] ||
    [filterKey.toString()[0].toLocaleUpperCase(), ...filterKey.slice(1)].join('')
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
