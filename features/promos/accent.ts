import type { PromoAccent } from '@/client/promos'
import { Colors } from 'react-native-ui-lib'

/** admin.promos.accent → its theme token (components/ui/theme `$accent<Hue>`). Read at render
 *  time, so it follows light/dark mode. Unknown or missing values fall back to the primary. */
export function accentColor(accent: PromoAccent | null | undefined): string {
  switch (accent) {
    case 'violet':
      return Colors.$accentViolet
    case 'purple':
      return Colors.$accentPurple
    case 'blue':
      return Colors.$accentBlue
    case 'cyan':
      return Colors.$accentCyan
    case 'green':
      return Colors.$accentGreen
    case 'yellow':
      return Colors.$accentYellow
    case 'orange':
      return Colors.$accentOrange
    case 'red':
      return Colors.$accentRed
    case 'grey':
      return Colors.$accentGrey
    default:
      return Colors.$backgroundPrimaryHeavy
  }
}
