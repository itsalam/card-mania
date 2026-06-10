import { Modal as BottomSheet } from '@/components/ui/modal'
import { Text } from '@/components/ui/text/base-text'
import MaskedView from '@react-native-masked-view/masked-view'
import { LinearGradient } from 'expo-linear-gradient'
import { ChevronDown, Search } from 'lucide-react-native'
import { useMemo, useState } from 'react'
import { FlatList, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { COUNTRIES, Country } from './phoneUtils'

export function CountryPicker({
  selected,
  onSelect,
}: {
  selected: Country
  onSelect: (c: Country) => void
}) {
  const { height: screenHeight } = useWindowDimensions()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    )
  }, [query])

  const handleDismiss = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        accessibilityLabel={`Country dial code: ${selected.name} ${selected.dial}`}
      >
        <Text style={{ fontSize: 20 }}>{selected.flag}</Text>
        <Text style={{ color: 'white', fontSize: 15 }}>{selected.dial}</Text>
        <ChevronDown size={14} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>

      <BottomSheet
        visible={open}
        onDismiss={handleDismiss}
        // absoluteThumb
        style={{ maxHeight: '60%' }}
      >
        {/* Search bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginHorizontal: 16,
            // marginBottom: 8,
            marginTop: 4,
            backgroundColor: 'rgba(255,255,255,0.08)',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Search size={15} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={{ flex: 1, color: 'white', fontSize: 15, padding: 0 }}
            placeholder="Search country or code"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        <MaskedView
          style={{ height: screenHeight * 0.42 }}
          maskElement={
            <LinearGradient
              colors={['transparent', 'black', 'black', 'transparent']}
              locations={[0, 0.06, 0.94, 1]}
              style={{ flex: 1 }}
            />
          }
        >
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            ListEmptyComponent={
              <Text
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  textAlign: 'center',
                  paddingVertical: 24,
                  fontSize: 14,
                }}
              >
                No results
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item)
                  handleDismiss()
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  backgroundColor:
                    item.code === selected.code ? 'rgba(255,255,255,0.08)' : 'transparent',
                }}
                accessibilityLabel={`${item.name} ${item.dial}`}
              >
                <Text style={{ fontSize: 22 }}>{item.flag}</Text>
                <Text style={{ color: 'white', fontSize: 16, flex: 1 }}>{item.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>{item.dial}</Text>
              </TouchableOpacity>
            )}
          />
        </MaskedView>
      </BottomSheet>
    </>
  )
}
