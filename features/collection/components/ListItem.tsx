import React, { ComponentProps } from 'react'
import { View } from 'react-native'
import { Colors } from 'react-native-ui-lib'
import { CollectionsPreviewIcon } from './PreviewIcon'

export { CollectionsPreviewIcon as Icon } from './PreviewIcon'

// Expanded-row icon basis, independent of the collapsed rail's cardWidth. Previously 1.35x —
// reduced so the icon doesn't compete with the (now higher-hierarchy) title/description text
// for attention in the list row. Exported so CollectionsPreview's expanded-height calculation
// stays in sync with the icon size actually rendered here.
export const EXPANDED_ICON_SCALE = 1.1

export function CollectionsListItem({
  children,
  isOpen,
  cardWidth = 72,
  collapsedIconWidth,
  ...props
}: ComponentProps<typeof View> & {
  isOpen?: boolean
  cardWidth?: number
  /** Collapsed-state icon width, independent of `cardWidth` (the expanded-state basis, used as
   *  `cardWidth * EXPANDED_ICON_SCALE`) — lets the collapsed rail item be sized wide enough to
   *  fit a title without also blowing up the expanded row's icon. Defaults to `cardWidth` if
   *  omitted. */
  collapsedIconWidth?: number
}) {
  return (
    <View
      style={{
        display: 'flex',
        // Collapsed rail item: vertical, image on top / title below (matches the other home-feed
        // rails), wrapped in a rounded card. Expanded: a horizontal list row. Both states get a
        // divider between the icon and its text (vertical when row, horizontal when column) —
        // see ITS-107 follow-up.
        flexDirection: isOpen ? 'row' : 'column',
        // Expanded row uses the default 'stretch' cross-alignment so the divider (no explicit
        // height of its own) fills the row's height instead of collapsing to zero.
        alignItems: isOpen ? 'stretch' : 'center',
        ...(!isOpen && {
          backgroundColor: Colors.$backgroundNeutralLight,
          borderRadius: 16,
          padding: 12,
          borderWidth: 1,
          borderColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
        }),
      }}
      className="gap-2"
      {...props}
    >
      <CollectionsPreviewIcon
        width={isOpen ? cardWidth * EXPANDED_ICON_SCALE : (collapsedIconWidth ?? cardWidth)}
      />
      <View
        style={
          isOpen
            ? {
                width: 1,
                alignSelf: 'stretch',
                backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
              }
            : {
                height: 1,
                width: '100%',
                backgroundColor: Colors.rgba(Colors.$outlineNeutral, 0.4),
              }
        }
      />
      {children}
    </View>
  )
}
