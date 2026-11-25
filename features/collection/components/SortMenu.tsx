// ITS-200: the collection list's sort control: a compact label above the list that opens a menu
// of sorts, with the current one checked.
//
// Design refs (Mobbin):
// - Alta "Closet": a small "Newest ▾" sort label sitting above the item list, with the count
//   beside it (https://mobbin.com/screens/4df70884-f9b9-40ba-9043-7afbcff778ca).
// - ASOS "Sort": a dropdown anchored to the label, the selected sort marked
//   (https://mobbin.com/screens/dad6f661-6dcc-4c19-82c7-afccf6b25883).
// - IKEA "Filter and sort": the same option set (price both ways, newest, most popular)
//   (https://mobbin.com/screens/e43fd66b-b580-428e-9444-6ec7dd8f4f47).

import { COLLECTION_SORTS, CollectionItemSort } from '@/client/collections/order'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Text } from '@/components/ui/text/base-text'
import { ArrowDownUp, Check, ChevronDown } from 'lucide-react-native'
import { ActivityIndicator, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'

export function CollectionSortMenu({
  value,
  onChange,
  options = COLLECTION_SORTS,
  isUpdating,
  hint,
}: {
  value: CollectionItemSort
  onChange: (sort: CollectionItemSort) => void
  options?: typeof COLLECTION_SORTS
  /** The list is refetching in the new sort. */
  isUpdating?: boolean
  /** Short note beside the label, e.g. that a viewer's sort isn't saved. */
  hint?: string
}) {
  const current = options.find((o) => o.value === value) ?? options[0]

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <DropdownMenu>
        <DropdownMenuTrigger accessibilityLabel={`Sort: ${current.label}`}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
              backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.92),
            }}
          >
            <ArrowDownUp size={14} color={Colors.$iconNeutral} />
            <Text style={{ fontSize: 13, fontWeight: '600' }}>{current.label}</Text>
            <ChevronDown size={14} color={Colors.$iconNeutral} />
          </View>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" style={{ minWidth: 200 }}>
          {options.map((opt) => {
            const selected = opt.value === current.value
            return (
              <DropdownMenuItem
                key={opt.value}
                onPress={() => {
                  if (!selected) onChange(opt.value)
                }}
                accessibilityState={{ selected }}
              >
                <View style={{ width: 16 }}>
                  {selected && <Check size={16} color={Colors.$iconPrimary} />}
                </View>
                <Text style={{ fontSize: 15, fontWeight: selected ? '600' : '400' }}>
                  {opt.label}
                </Text>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {isUpdating && <ActivityIndicator size="small" color={Colors.$textNeutral} />}
      {hint && !isUpdating && (
        <Text variant="small" style={{ color: Colors.$textNeutral, fontSize: 11 }}>
          {hint}
        </Text>
      )}
    </View>
  )
}
