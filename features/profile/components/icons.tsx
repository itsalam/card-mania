import { Activity, Gauge, Library, LucideIcon, ShelvingUnit, Target } from 'lucide-react-native'
import { TabType } from '../providers'

export const TabIcons: Record<TabType, LucideIcon> = {
  collections: Library,

  timeline: Activity,
  stats: Gauge,
  storefront: ShelvingUnit,
  seeking: Target,
}
