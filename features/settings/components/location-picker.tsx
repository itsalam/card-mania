import { useToast } from '@/components/Toast'
import { Modal } from '@/components/ui/modal'
import { SearchBar } from '@/components/ui/search'
import { Spinner } from '@/components/ui/spinner'
import { Text } from '@/components/ui/text'
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
import { SettingKey } from '../registry'
import { SettingsDisplay } from '../types'

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

const LocationPicker = ({
  children,
}: {
  display: Extract<SettingsDisplay, { type: 'toggle' }>
  settingKey: SettingKey
  children?: ReactNode
}) => {
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
    setSessionToken(null) // end session
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

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 10,
        }}
      >
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          style={{
            flex: 1,
            alignItems: 'center',
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          {children}
          <View
            style={{
              marginLeft: 'auto',
              marginRight: 12,
              alignSelf: 'flex-end',
              flexDirection: 'row',
              gap: 12,
            }}
          >
            <Text variant={'large'}>
              {`${setting.value?.city?.toLocaleUpperCase()[0]}${setting.value?.city?.slice(1)}`}
            </Text>
            <ChevronRight
              color={Colors.$iconDefault}
              style={{
                marginLeft: 'auto',
                marginRight: 12,
                alignSelf: 'flex-end',
              }}
            />
          </View>
        </TouchableOpacity>
      </View>
      <Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        absoluteThumb
        style={{ paddingHorizontal: 0 }}
      >
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
          <TouchableOpacity onPress={() => setShowModal(false)}>
            <ChevronLeft size={30} strokeWidth={3} color={Colors.$iconDefault} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <SearchBar
              onFocus={onFocus}
              onBlur={() => setSessionToken(null)}
              style={{ backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.66) }}
              value={text}
              onChangeText={(value) => {
                setText(value)
                setSessionToken((text) => text ?? newSessionToken())
              }}
              editable
            />
          </View>
        </View>
        <View
          style={{
            opacity: 1,
            zIndex: 0,
            width: '100%',
            aspectRatio: 1,
            position: 'relative',
            borderRadius: BorderRadiuses.br20,
          }}
        >
          <MapView
            style={{
              width: '100%',
              aspectRatio: 1,
              zIndex: 0,
            }}
            ref={mapRef}
          >
            {selected && <Marker coordinate={selected} />}
            {selected && previewCircleRadius && (
              <Circle
                center={{ latitude: selected.latitude, longitude: selected.longitude }}
                radius={previewCircleRadius}
                strokeColor="rgba(0,0,255,0.5)"
                fillColor="rgba(0,0,255,0.2)"
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
                backgroundColor: Colors.rgba(Colors.$backgroundElevated, 0.8),
                top: 0,
                left: 0,
                paddingTop: 80,
              }}
            >
              <FlatList
                persistentScrollbar={true}
                style={{
                  padding: 12,
                  height: '100%',
                  flex: 1,
                }}
                contentContainerStyle={{
                  gap: 12,
                  minHeight: '100%',
                }}
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
                        <SearchX size={52} color={Colors.$iconDisabled} />
                        <Text variant={'large'} style={{ color: Colors.$textDisabled }}>
                          No locations found.
                        </Text>
                      </>
                    ) : null}
                  </View>
                )}
                renderItem={({ item: suggestion, ...rest }) => (
                  <Animated.View
                    key={suggestion.slug}
                    style={{
                      alignSelf: 'stretch',
                      marginHorizontal: 8,
                    }}
                    entering={FadeIn.duration(25)}
                    exiting={FadeOut.duration(25)}
                  >
                    <TouchableOpacity
                      onPress={() => onSelect(suggestion)}
                      style={{
                        alignItems: 'center',
                        flexDirection: 'row',
                        backgroundColor: Colors.$backgroundElevated,
                        borderRadius: BorderRadiuses.br50,
                        borderWidth: 3,
                        borderColor: Colors.$outlineDefault,
                      }}
                    >
                      <View
                        style={{
                          alignSelf: 'stretch',
                          aspectRatio: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRightWidth: 3,
                          borderColor: Colors.$outlineDefault,
                        }}
                      >
                        <MapPin size={36} color={Colors.$iconDefault} />
                      </View>
                      <View
                        style={{
                          padding: 8,
                          paddingVertical: 12,
                          flex: 1,
                          gap: 2,
                        }}
                      >
                        <Text variant={'h4'}>{suggestion.city}</Text>
                        <Text
                          variant={'default'}
                          style={{ fontSize: 16 }}
                        >{`${suggestion.state ? `${suggestion.state}, ` : ''}${suggestion.country}`}</Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                )}
              />
            </Animated.View>
          )}
        </View>
        <View style={{ flexDirection: 'row', padding: 12, paddingTop: 20 }}>
          <View style={{ flexDirection: 'row', flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                padding: 12,
                borderTopLeftRadius: BorderRadiuses.br50,
                borderBottomLeftRadius: BorderRadiuses.br50,
                borderWidth: 3,
                borderColor: Colors.$outlineDefault,
              }}
            >
              <View>
                <MapPinned
                  size={44}
                  color={selected ? Colors.$iconDefault : Colors.$outlineDefault}
                />
              </View>
            </View>
            <View
              style={{
                padding: 12,
                borderTopRightRadius: BorderRadiuses.br50,
                borderBottomRightRadius: BorderRadiuses.br50,
                borderLeftWidth: 0,
                borderWidth: 3,
                borderColor: Colors.$outlineDefault,
                flex: 1,
                alignSelf: 'stretch',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              <View style={{ flex: 1 }}>
                {selected ? (
                  <View
                    style={{
                      flex: 1,
                      gap: 2,
                    }}
                  >
                    <Text ellipsizeMode="tail" numberOfLines={1} variant={'h4'}>
                      {selected.city}
                    </Text>
                    <Text
                      variant={'default'}
                      style={{ fontSize: 16, textOverflow: '' }}
                      ellipsizeMode="tail"
                      numberOfLines={1}
                    >{`${selected.state ? `${selected.state}, ` : ''}${selected.country}`}</Text>
                  </View>
                ) : (
                  <>
                    <Text
                      variant={'lead'}
                      style={{
                        color: Colors.$iconDisabled,
                        fontWeight: 700,
                      }}
                    >
                      No location selected.
                    </Text>
                  </>
                )}
              </View>
              {selected ? (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setSelected(null)
                      setSessionToken(newSessionToken())
                    }}
                    style={{
                      alignSelf: 'stretch',
                      aspectRatio: 1,
                      padding: 12,
                      borderRadius: BorderRadiuses.br50,
                      borderWidth: 2,
                      borderColor: Colors.$outlineNeutral,
                      backgroundColor: Colors.$backgroundNeutralLight,
                    }}
                  >
                    <Undo color={Colors.$outlineNeutral} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setConfirmed(selected)}
                    style={{
                      alignSelf: 'stretch',
                      aspectRatio: 1,
                      padding: 12,
                      borderRadius: BorderRadiuses.br50,
                      borderWidth: 2,
                      borderColor: Colors.$iconSuccessLight,
                      backgroundColor: Colors.$backgroundSuccessLight,
                    }}
                  >
                    {writingConfirmed ? <Spinner /> : <Check color={Colors.$iconSuccessLight} />}
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        </View>

        {/* </KeyboardAvoidingView> */}
      </Modal>
    </>
  )
}

export default LocationPicker
