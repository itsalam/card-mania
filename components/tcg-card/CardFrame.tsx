import { useSetting } from '@/features/settings'
import { View, ViewProps } from 'react-native'
import { Colors } from 'react-native-ui-lib'

// Border-only shape (not ViewStyle) so it's assignable to View and expo-image styles alike.
type CardBorderStyle = { borderWidth: number; borderColor?: string }

/**
 * Subtle outline that separates collectible card art from the background. Behind the dev-only
 * "Card borders" setting while it's being evaluated — always off in production builds.
 * Returns undefined when disabled so callers can spread it into a style array unconditionally.
 */
export function useCardBorderStyle(): CardBorderStyle | undefined {
  const { value } = useSetting('cardBorders')
  if (process.env.NODE_ENV === 'production' || value !== 'on') return undefined
  return { borderWidth: 1, borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4) }
}

/**
 * Clipping container for card art. Callers set the size and borderRadius; the border (when
 * enabled) follows that radius and sits on top of the art since overflow is hidden.
 */
export function CardFrame({ style, ...props }: ViewProps) {
  const borderStyle = useCardBorderStyle()
  return <View style={[{ overflow: 'hidden' }, style, borderStyle]} {...props} />
}
