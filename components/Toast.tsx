import { useEffectiveColorScheme } from '@/features/settings/hooks/effective-color-scheme'
import { X } from 'lucide-react-native'
import React, { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FullWindowOverlay } from 'react-native-screens'
import { Colors, ToastProps } from 'react-native-ui-lib'
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
}

type ToastContextValue = {
  showToast: (args: ShowToastArgs) => void
  hideToast: () => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

type ToastOverlayProps = {
  visible: boolean
  toastProps: Partial<ShowToastArgs>
  hideToast: () => void
}

function ToastOverlayContent({ visible, toastProps, hideToast }: ToastOverlayProps) {
  const theme = useEffectiveColorScheme()
  const insets = useSafeAreaInsets()
  const { title, message, backgroundColor, textColor, ...alertProps } = toastProps

  if (!visible) return null

  return (
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
            <AlertTitle style={textColor ? { color: textColor } : undefined}>{title}</AlertTitle>
          )}
          {message && (
            <AlertDescription style={textColor ? { color: textColor } : undefined}>
              {message}
            </AlertDescription>
          )}
        </Alert>
      </Animated.View>
    </View>
  )
}

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [visible, setVisible] = useState(false)
  const [toastProps, setToastProps] = useState<Partial<ShowToastArgs>>({
    autoDismiss: 2000,
    position: 'top',
  })

  const hideToast = useCallback(() => setVisible(false), [])
  const showToast = useCallback((args: ShowToastArgs) => {
    setToastProps((prev: Partial<ShowToastArgs>) => ({
      ...args,
      preset: args.preset ?? prev.preset ?? 'general',
      autoDismiss: args.autoDismiss ?? prev.autoDismiss ?? 2000,
      position: args.position ?? prev.position ?? 'top',
    }))
    setVisible(true)
  }, [])

  const ctx = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast])

  React.useEffect(() => {
    if (!visible) return
    const duration =
      typeof toastProps.autoDismiss === 'number' && toastProps.autoDismiss > 0
        ? toastProps.autoDismiss
        : undefined
    if (!duration) return
    const timer = setTimeout(hideToast, duration)
    return () => clearTimeout(timer)
  }, [hideToast, toastProps.autoDismiss, visible])

  const overlay = (
    <ToastOverlayContent visible={visible} toastProps={toastProps} hideToast={hideToast} />
  )

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {Platform.OS === 'ios' ? (
        <FullWindowOverlay>{overlay}</FullWindowOverlay>
      ) : (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
          {overlay}
        </Modal>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
