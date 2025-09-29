import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { cssInterop } from 'nativewind'
import { ComponentProps, useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { ColorValueArray, hexToRgba, OptionalColorValueArray, useBackgroundColors } from './utils'

cssInterop(BlurView, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      intensity: true,
    },
  },
})

cssInterop(LinearGradient, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      colors: true,
    },
  },
})

export function Background({
  style,
  colors,
  opacity = 1,
  ...props
}: Omit<ComponentProps<typeof LinearGradient>, 'colors'> & {
  colors?: OptionalColorValueArray
  opacity?: number | number[]
}) {
  const defaultColors: ColorValueArray = useBackgroundColors()

  const getOpacity = (index: number) => {
    if (Array.isArray(opacity)) {
      return opacity[index]
    }
    return opacity
  }

  const finalColors = useMemo(
    () =>
      (colors ?? defaultColors)
        .map((color, index) => color || defaultColors[Math.min(defaultColors.length - 1, index)])
        .map((color, index) => hexToRgba(color.toString(), getOpacity(index))) as ColorValueArray,

    [colors, opacity]
  )

  return (
    <LinearGradient
      colors={finalColors}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        ...StyleSheet.flatten(style),
      }}
      {...props}
    />
  )
}

export function BlurBackground({ children, ...props }: ComponentProps<typeof Background>) {
  return (
    <Background {...props}>
      <BlurView
        intensity={10}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {children}
    </Background>
  )
}
