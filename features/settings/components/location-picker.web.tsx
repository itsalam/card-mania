import { useToast } from '@/components/Toast'
import { Spinner } from '@/components/ui/spinner'
import { Text } from '@/components/ui/text/base-text'
import { AlertCircle, Check, ChevronRight, MapPin, MapPinned, Search, X } from 'lucide-react-native'
import React, { ReactNode, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { useSetting } from '..'
import { CitySuggestion, newSessionToken, useCitySuggestions } from '../client'

function useDarkClass() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const mo = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    )
    mo.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => mo.disconnect()
  }, [])
  return isDark
}

function MapEmbed({ selected }: { selected: CitySuggestion }) {
  const { latitude: lat, longitude: lon, viewport } = selected
  const west = viewport?.low?.longitude ?? lon - 0.08
  const south = viewport?.low?.latitude ?? lat - 0.08
  const east = viewport?.high?.longitude ?? lon + 0.08
  const north = viewport?.high?.latitude ?? lat + 0.08
  const isDark = useDarkClass()

  return React.createElement('iframe', {
    src: `https://www.openstreetmap.org/export/embed.html?bbox=${west},${south},${east},${north}&layer=hot&marker=${lat},${lon}`,
    style: {
      width: '100%',
      height: '100%',
      border: 'none',
      filter: isDark
        ? 'grayscale(0.45) invert(1) hue-rotate(180deg) brightness(0.82) saturate(0.5) contrast(1.05)'
        : 'grayscale(0.15) saturate(0.8) contrast(1.05)',
    },
    loading: 'lazy',
    title: `Map of ${selected.city}`,
  } as any)
}

const LocationPicker = ({ children }: { children?: ReactNode }) => {
  const setting = useSetting('location')
  const toast = useToast()
  const inputRef = useRef<TextInput>(null)

  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [selected, setSelected] = useState<CitySuggestion | null>(null)
  const [saving, setSaving] = useState(false)

  const isTextEnabled = text.trim().length >= 2 && !!sessionToken

  const { data: suggestions = [], isFetching, isError } = useCitySuggestions(text, sessionToken)

  const cityLabel = setting.value?.city
    ? `${setting.value.city[0].toUpperCase()}${setting.value.city.slice(1)}`
    : undefined

  useEffect(() => {
    if (expanded) {
      const id = setTimeout(() => inputRef.current?.focus?.(), 60)
      return () => clearTimeout(id)
    }
  }, [expanded])

  const handleOpen = () => {
    setExpanded(true)
    setSelected(null)
    setText('')
    setSessionToken(newSessionToken())
  }

  const handleClose = () => {
    setExpanded(false)
    setText('')
    setSessionToken(null)
    setSelected(null)
  }

  const handleSelect = (item: CitySuggestion) => {
    setSelected(item)
    setText(item.city ?? '')
    setSessionToken(null)
  }

  const handleConfirm = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const { prevVal, curr } = await setting.set(selected)
      toast.showToast({
        title: 'Location Updated',
        message: `Location updated${prevVal?.city ? ` from ${prevVal.city}` : ''} to ${curr?.city}`,
      })
      handleClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <View>
      {/* ── Trigger row ─────────────────────────────────────────────────── */}
      <Pressable
        onPress={expanded ? handleClose : handleOpen}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          paddingHorizontal: 4,
        }}
      >
        {children}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {cityLabel && !expanded && (
            <Text style={{ fontSize: 15, color: Colors.$textNeutral }}>{cityLabel}</Text>
          )}
          <ChevronRight
            size={18}
            color={expanded ? Colors.$backgroundPrimaryHeavy : Colors.$iconDefault}
            style={
              {
                transform: [{ rotate: expanded ? '90deg' : '0deg' }],
                transition: 'transform 0.25s ease',
              } as any
            }
          />
        </View>
      </Pressable>

      {/* ── Accordion expansion panel ────────────────────────────────────── */}
      <View
        style={
          {
            overflow: 'hidden',
            maxHeight: expanded ? 640 : 0,
            opacity: expanded ? 1 : 0,
            transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease',
          } as any
        }
      >
        <View style={{ paddingBottom: 12, paddingHorizontal: 4, gap: 10, paddingTop: 2 }}>
          {/* Search input */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: Colors.$outlineDefault,
              backgroundColor: Colors.rgba(Colors.$backgroundDefault, 0.9),
              paddingHorizontal: 12,
              height: 38,
            }}
          >
            <Search size={14} color={Colors.$textNeutralLight} strokeWidth={2.5} />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={(v) => {
                setText(v)
                setSelected(null)
                if (!sessionToken && v.trim().length >= 2) setSessionToken(newSessionToken())
                else if (sessionToken && v.trim().length < 2) setSessionToken(null)
              }}
              placeholder="Search city..."
              placeholderTextColor={Colors.$textNeutralLight}
              style={
                {
                  flex: 1,
                  fontSize: 14,
                  color: Colors.$textDefault,
                  paddingVertical: 0,
                  outlineStyle: 'none',
                } as any
              }
            />
            {text.length > 0 && (
              <Pressable
                onPress={() => {
                  setText('')
                  setSelected(null)
                  setSessionToken(null)
                }}
                hitSlop={8}
              >
                <X size={13} color={Colors.$iconNeutral} />
              </Pressable>
            )}
          </View>

          {/* Results list */}
          {!selected && sessionToken && (
            <ScrollView
              style={{ maxHeight: 200 }}
              contentContainerStyle={{ gap: 6 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {isFetching ? (
                <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                  <Spinner />
                </View>
              ) : isError ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 10,
                  }}
                >
                  <AlertCircle size={15} color={Colors.$textDanger} />
                  <Text style={{ fontSize: 13, color: Colors.$textDanger }}>
                    Failed to search. Try again.
                  </Text>
                </View>
              ) : suggestions.length === 0 && isTextEnabled && !isFetching ? (
                <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                  <Text style={{ fontSize: 14, color: Colors.$textDisabled }}>
                    No locations found.
                  </Text>
                </View>
              ) : (
                suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.slug}
                    onPress={() => handleSelect(suggestion)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 8,
                      paddingVertical: 7,
                      borderRadius: 8,
                    }}
                  >
                    <MapPin size={13} color={Colors.$textNeutralLight} strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: Colors.$textDefault, fontWeight: '500' }}>
                        {suggestion.city}
                      </Text>
                      <Text style={{ fontSize: 12, color: Colors.$textNeutralLight }}>
                        {`${suggestion.state ? `${suggestion.state}, ` : ''}${suggestion.country}`}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          )}

          {/* Selected location — confirmation bar + map */}
          {selected && (
            <View style={{ gap: 8 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: Colors.$outlineDefault,
                  backgroundColor: Colors.$backgroundElevated,
                }}
              >
                <MapPinned size={15} color={Colors.$backgroundPrimaryHeavy} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ fontSize: 14, fontWeight: '500', color: Colors.$textDefault }}
                    numberOfLines={1}
                  >
                    {selected.city}
                  </Text>
                  <Text style={{ fontSize: 12, color: Colors.$textNeutralLight }} numberOfLines={1}>
                    {`${selected.state ? `${selected.state}, ` : ''}${selected.country}`}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setSelected(null)
                    setText('')
                    setSessionToken(newSessionToken())
                  }}
                  hitSlop={8}
                  style={{
                    padding: 5,
                    borderRadius: 20,
                    backgroundColor: Colors.$backgroundNeutralLight,
                  }}
                >
                  <X size={13} color={Colors.$iconNeutral} />
                </Pressable>
                <Pressable
                  onPress={handleConfirm}
                  hitSlop={8}
                  style={{
                    padding: 5,
                    borderRadius: 20,
                    backgroundColor: Colors.$backgroundSuccessLight,
                  }}
                >
                  {saving ? (
                    <Spinner style={{ width: 13, height: 13 }} />
                  ) : (
                    <Check size={13} color={Colors.$iconSuccessLight} />
                  )}
                </Pressable>
              </View>

              {/* Map preview */}
              <View
                style={{
                  height: 220,
                  borderRadius: 10,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: Colors.rgba(Colors.$outlineNeutral, 0.3),
                }}
              >
                <MapEmbed selected={selected} />
              </View>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

export default LocationPicker
