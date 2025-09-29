import { Portal, PortalHost } from '@rn-primitives/portal'
import { BlurView } from 'expo-blur'
import { motify } from 'moti'
import React from 'react'
import { OverlayScreen } from './OverlayScreen'
import { useOverlayStore } from './provider'

const AnimatedBlur = motify(BlurView)()

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const { isOverlayOpen, setIsOverlayOpen, onOverlayClose, holes } = useOverlayStore()
  if (!isOverlayOpen && Object.keys(holes).length === 0) return children

  return (
    <>
      {children}

        <PortalHost name="overlay" />

      {isOverlayOpen && (
        <Portal name="overlay" >
          {/* <AnimatePresence>
            <AnimatedBlur
              from={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 1 }}
              style={{
                ...StyleSheet.absoluteFillObject,
                zIndex: -1,
              }}
              tint={Platform.OS === 'ios' ? 'dark' : 'regular'}
              intensity={12} // bump this up if you want a stronger blur
              experimentalBlurMethod="dimezisBlurView" // better Android quality when available
            >
              <Pressable
                onPress={() => {
                  setIsOverlayOpen(false)
                  onOverlayClose()
                }}
                className="w-full h-full z-overlay absolute top-0 left-0 right-0 bottom-0 "
              />
            </AnimatedBlur>
              </AnimatePresence> */}
              
          <OverlayScreen
            holes={holes}
            onDismiss={() => {
              setIsOverlayOpen(false)
              onOverlayClose()
            }}
          />
        </Portal>
      )}
    </>
  )
}
