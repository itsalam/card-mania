import {
  Activity,
  Gauge,
  Library,
  LucideIcon,
  ScrollText,
  ShelvingUnit,
  Target,
} from 'lucide-react-native'
import { TabType } from '../providers'

export const TabIcons: Record<TabType, LucideIcon> = {
  collections: Library,
  posts: ScrollText,
  timeline: Activity,
  stats: Gauge,
  storefront: ShelvingUnit,
  seeking: Target,
}
