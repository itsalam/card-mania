import { useCallback, useState } from 'react'
import { LayoutAnimation, Platform, UIManager } from 'react-native'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const COLLAPSE_ANIMATION = {
  duration: 200,
  create: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: {
    type: LayoutAnimation.Types.easeInEaseOut,
    property: LayoutAnimation.Properties.opacity,
  },
}

export function useCollapsibleSection(defaultCollapsed = false) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(COLLAPSE_ANIMATION)
    setIsCollapsed((prev) => !prev)
  }, [])

  return { isCollapsed, toggle }
}
