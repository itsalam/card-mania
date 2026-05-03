import { useToast } from '@/components/Toast'
import { Modal } from '@/components/ui/modal'
import { SearchBar } from '@/components/ui/search'
import { Spinner } from '@/components/ui/spinner'
import { Text } from '@/components/ui/text/base-text'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MapPinned,
  SearchX,
  Undo,
} from 'lucide-react-native'
import React, { ReactNode, useEffect, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import MapView, { Circle, Marker } from 'react-native-maps'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { BorderRadiuses, Colors } from 'react-native-ui-lib'
import { useSetting } from '..'
import { CitySuggestion, newSessionToken, useCitySuggestions } from '../client'

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000 // meters
  const toRad = (d: number) => (d * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  return 2 * R * Math.asin(Math.sqrt(a))
}

const LocationPicker = ({ children }: { children?: ReactNode }) => {
  const setting = useSetting('location')
  const mapRef = useRef<MapView>(null)
  const prevText = useRef('')
  const [showModal, setShowModal] = useState(false)
  const [writingConfirmed, setWritingConfirmed] = useState(false)
  const toast = useToast()

  const [text, setText] = useState('')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [selected, setSelected] = useState<CitySuggestion | null>(setting.value)
  const [previewCircleRadius, setCircleRadius] = useState<number | null>(null)
  const [confirmed, setConfirmed] = useState<CitySuggestion | null>(null)

  const {
    data: suggestions = [],
    isFetching,
    isEnabled: isTextEnabled,
  } = useCitySuggestions(text, sessionToken)

  const onFocus = () => {
    setSessionToken((t) => t ?? newSessionToken())
  }

  const onSelect = (item: CitySuggestion) => {
    setSelected(item)
    setSessionToken(null)
  }

  useEffect(() => {
    if (!selected) {
      setText(prevText.current)
      return
    }
    const { viewport } = selected

    mapRef.current?.fitToCoordinates([viewport.high, viewport.low], {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: true,
    })
    setCircleRadius(
      Math.min(
        haversineDistance(
          selected.latitude,
          selected.longitude,
          viewport.high.latitude,
          viewport.high.longitude
        ),
        haversineDistance(
          selected.latitude,
          selected.longitude,
          viewport.low.latitude,
          viewport.low.longitude
        )
      )
    )
    setText(selected?.city ?? text)
    prevText.current = text
  }, [selected])

  useEffect(() => {
    if (!confirmed) return
    setWritingConfirmed(true)
    setting.set(confirmed).then(({ prevVal, curr }) => {
      setWritingConfirmed(false)
      setShowModal(false)
      setConfirmed(null)
      toast.showToast({
        title: 'Location Updated',
        message: `Location updated ${prevVal?.city ? `from ${prevVal.city}` : ''} to ${curr?.city}`,
      })
    })
  }, [confirmed])

  const cityLabel = setting.value?.city
    ? `${setting.value.city[0].toUpperCase()}${setting.value.city.slice(1)}`
    : undefined

  return (
    <>
      {/* ── Trigger row ── */}
      <TouchableOpacity
        onPress={() => setShowModal(true)}
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
          {cityLabel && (
            <Text variant="large" style={{ color: Colors.$textDefault }}>
              {cityLabel}
            </Text>
          )}
          <ChevronRight size={18} color={Colors.$iconDefault} />
        </View>
      </TouchableOpacity>

      <Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        absoluteThumb
        style={{ paddingHorizontal: 0 }}
      >
        {/* ── Search header ── */}
        <View
          style={{
            position: 'absolute',
            paddingTop: 20,
            top: 0,
            flexDirection: 'row',
            width: '100%',
            paddingLeft: 12,
            paddingRight: 20,
            zIndex: 2,
            alignItems: 'center',
            gap: 8,
          }}
        >
          <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 4 }}>
            <ChevronLeft size={26} strokeWidth={2} color={Colors.$iconDefault} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <SearchBar
              onFocus={onFocus}
              onBlur={() => setSessionToken(null)}
              style={{ backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.66) }}
              value={text}
              onChangeText={(value) => {
                setText(value)
                setSessionToken((t) => t ?? newSessionToken())
              }}
              hideSideButton
              editable
            />
          </View>
        </View>

        {/* ── Map + suggestions overlay ── */}
        <View
          style={{
            zIndex: 0,
            width: '100%',
            aspectRatio: 1,
            position: 'relative',
            borderRadius: BorderRadiuses.br20,
            overflow: 'hidden',
          }}
        >
          <MapView style={{ width: '100%', aspectRatio: 1, zIndex: 0 }} ref={mapRef}>
            {selected && <Marker coordinate={selected} />}
            {selected && previewCircleRadius && (
              <Circle
                center={{ latitude: selected.latitude, longitude: selected.longitude }}
                radius={previewCircleRadius}
                strokeColor={Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.5)}
                fillColor={Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.15)}
              />
            )}
          </MapView>

          {sessionToken && (
            <Animated.View
              entering={FadeIn.duration(150)}
              exiting={FadeOut.duration(100)}
              style={{
                width: '100%',
                aspectRatio: 1,
                zIndex: 1,
                position: 'absolute',
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.92),
                top: 0,
                left: 0,
                paddingTop: 80,
              }}
            >
              <FlatList
                persistentScrollbar={false}
                style={{ padding: 12, height: '100%', flex: 1 }}
                contentContainerStyle={{ gap: 8, minHeight: '100%' }}
                data={suggestions}
                ListEmptyComponent={() => (
                  <View
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      alignSelf: 'stretch',
                      height: '100%',
                    }}
                  >
                    {isFetching ? (
                      <Spinner />
                    ) : isTextEnabled ? (
                      <>
                        <SearchX size={44} color={Colors.$iconDisabled} />
                        <Text variant="large" style={{ color: Colors.$textDisabled, marginTop: 8 }}>
                          No locations found.
                        </Text>
                      </>
                    ) : null}
                  </View>
                )}
                renderItem={({ item: suggestion }) => (
                  <Animated.View
                    key={suggestion.slug}
                    style={{ alignSelf: 'stretch', marginHorizontal: 4 }}
                    entering={FadeIn.duration(80)}
                    exiting={FadeOut.duration(50)}
                  >
                    <TouchableOpacity
                      onPress={() => onSelect(suggestion)}
                      style={{
                        alignItems: 'center',
                        flexDirection: 'row',
                        gap: 12,
                        backgroundColor: Colors.$backgroundElevated,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: Colors.$outlineDefault,
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 18,
                          backgroundColor: Colors.rgba(Colors.$backgroundPrimaryHeavy, 0.12),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MapPin size={18} color={Colors.$backgroundPrimaryHeavy} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text variant="h4">{suggestion.city}</Text>
                        <Text
                          variant="default"
                          style={{ fontSize: 14, color: Colors.$textNeutralLight }}
                        >
                          {`${suggestion.state ? `${suggestion.state}, ` : ''}${suggestion.country}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                )}
              />
            </Animated.View>
          )}
        </View>

        {/* ── Confirmation bar ── */}
        <View style={{ padding: 12, paddingTop: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: Colors.$outlineDefault,
              backgroundColor: Colors.$backgroundElevated,
            }}
          >
            <MapPinned
              size={28}
              color={selected ? Colors.$backgroundPrimaryHeavy : Colors.$iconDisabled}
            />
            <View style={{ flex: 1 }}>
              {selected ? (
                <>
                  <Text variant="h4" numberOfLines={1} ellipsizeMode="tail">
                    {selected.city}
                  </Text>
                  <Text
                    variant="default"
                    style={{ fontSize: 14, color: Colors.$textNeutralLight }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {`${selected.state ? `${selected.state}, ` : ''}${selected.country}`}
                  </Text>
                </>
              ) : (
                <Text variant="lead" style={{ color: Colors.$textNeutralLight }}>
                  No location selected.
                </Text>
              )}
            </View>

            {selected && (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setSelected(null)
                    setSessionToken(newSessionToken())
                  }}
                  style={{
                    padding: 10,
                    borderRadius: 20,
                    backgroundColor: Colors.$backgroundNeutralLight,
                  }}
                >
                  <Undo size={18} color={Colors.$iconNeutral} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setConfirmed(selected)}
                  style={{
                    padding: 10,
                    borderRadius: 20,
                    backgroundColor: Colors.$backgroundSuccessLight,
                  }}
                >
                  {writingConfirmed ? (
                    <Spinner />
                  ) : (
                    <Check size={18} color={Colors.$iconSuccessLight} />
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

export default LocationPicker
