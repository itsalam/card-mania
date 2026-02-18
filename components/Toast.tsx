import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { X } from 'lucide-react-native'
import React, {
  ComponentProps,
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, Toast, ToastProps } from 'react-native-ui-lib'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Icon } from './ui/icon'

export type ShowToastArgs = {
  title?: string
  message: string
  preset?: ToastProps['preset']
  autoDismiss?: ToastProps['autoDismiss']
  position?: ToastProps['position']
  /**
   * Optional override for the toast container background color.
   */
  backgroundColor?: string
  /**
   * Optional override for title/description/icon color.
   */
  textColor?: string
} & ComponentProps<typeof Toast>

type ToastContextValue = {
  showToast: (args: ShowToastArgs) => void
  hideToast: () => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const theme = useEffectiveColorScheme()
  const [visible, setVisible] = useState(true)
  const [toastProps, setToastProps] = useState<Partial<ShowToastArgs>>({
    title: 'nah',
    message: 'ye',
    autoDismiss: 2000,
    position: 'top',
  })

  const hideToast = useCallback(() => setVisible(false), [])
  const showToast = useCallback((args: ShowToastArgs) => {
    setToastProps((prev: Partial<ShowToastArgs>) => ({
      ...args,
      message: args.message,
      preset: args.preset ?? prev.preset ?? 'general',
      autoDismiss: args.autoDismiss ?? prev.autoDismiss ?? 2000,
      position: args.position ?? prev.position ?? 'top',
    }))
    setVisible(true)
  }, [])

  const insets = useSafeAreaInsets()
  const ctx = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast])

  const { title, message, backgroundColor, textColor, ...alertProps } = toastProps

  React.useEffect(() => {
    if (!visible) return

    const duration =
      typeof toastProps.autoDismiss === 'number' && toastProps.autoDismiss > 0
        ? toastProps.autoDismiss
        : undefined

    if (!duration) return

    const timer = setTimeout(() => {
      hideToast()
    }, duration)

    return () => clearTimeout(timer)
  }, [hideToast, toastProps.autoDismiss, visible])

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {visible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            pointerEvents="box-only"
            accessibilityRole="button"
            accessibilityLabel="Dismiss toast"
            onPress={hideToast}
          />

          <Animated.View
            entering={FadeInDown.duration(150)}
            exiting={FadeOutDown.duration(150)}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingBottom: 60 + insets.bottom,
            }}
            pointerEvents="box-none"
          >
            <Alert
              {...alertProps}
              key={theme}
              style={{
                backgroundColor: backgroundColor ?? Colors.$backgroundElevated,
              }}
            >
              <Pressable
                onPress={hideToast}
                hitSlop={8}
                className="absolute right-2 top-2"
                accessibilityRole="button"
                accessibilityLabel="Close toast"
              >
                <Icon as={X} size={22} className="text-muted-foreground" color={textColor} />
              </Pressable>

              {title && (
                <AlertTitle style={textColor ? { color: textColor } : undefined}>
                  {title}
                </AlertTitle>
              )}
              {message && (
                <AlertDescription style={textColor ? { color: textColor } : undefined}>
                  {message}
                </AlertDescription>
              )}
            </Alert>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
