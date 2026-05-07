import { useCollapsibleSection } from '@/lib/hooks/useCollapsibleSection'
import { AlertTriangle, ChevronDown, ChevronUp, Info } from 'lucide-react-native'
import { ReactNode, createContext, useCallback, useContext, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Colors, TouchableOpacity } from 'react-native-ui-lib'
import { Text } from './text/base-text'

// ── Warning context ────────────────────────────────────────────────────────────

type SectionWarning = { type: 'info' | 'warning'; message?: string }

type SectionWarningCtx = {
  warning: SectionWarning | null
  setWarning: (w: SectionWarning | null) => void
}

const SectionWarningContext = createContext<SectionWarningCtx>({
  warning: null,
  setWarning: () => {},
})

export function useSectionWarning() {
  return useContext(SectionWarningContext)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CollapsibleSection({
  title,
  children,
  defaultCollapsed = false,
  rightElement,
}: {
  title: string
  children: ReactNode
  defaultCollapsed?: boolean
  rightElement?: ReactNode
}) {
  const { isCollapsed, toggle } = useCollapsibleSection(defaultCollapsed)
  const [warning, setWarning] = useState<SectionWarning | null>(null)

  const stableSetWarning = useCallback((w: SectionWarning | null) => setWarning(w), [])

  const warningColor =
    warning?.type === 'warning' ? Colors.$outlineWarning : Colors.$backgroundPrimaryHeavy

  return (
    <SectionWarningContext.Provider value={{ warning, setWarning: stableSetWarning }}>
      <View>
        <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.header}>
          <View style={styles.titleRow}>
            <Text variant="default" style={styles.title}>
              {title}
            </Text>
            {warning && (
              <View style={[styles.badge, { backgroundColor: Colors.rgba(warningColor, 0.12) }]}>
                {warning.type === 'warning' ? (
                  <AlertTriangle size={12} color={warningColor} />
                ) : (
                  <Info size={12} color={warningColor} />
                )}
                {warning.message ? (
                  <Text variant="small" style={[styles.badgeText, { color: warningColor }]}>
                    {warning.message}
                  </Text>
                ) : null}
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            {rightElement}
            {isCollapsed ? (
              <ChevronDown size={16} color={Colors.$iconNeutral} />
            ) : (
              <ChevronUp size={16} color={Colors.$iconNeutral} />
            )}
          </View>
        </TouchableOpacity>
        <View style={isCollapsed ? styles.hidden : undefined}>{children}</View>
      </View>
    </SectionWarningContext.Provider>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontWeight: '600',
    color: Colors.$textNeutral,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hidden: {
    display: 'none',
  },
})
