import { Clock, Heart, Layers, LucideIcon, Sparkles, TrendingUp, Users } from 'lucide-react-native'

/** Maps home_feed_section_meta.icon (a plain string column) to its lucide component. The admin
 *  console only accepts these names: keep admin._home_section_icons() (ITS-110) in step. */
export const HOME_FEED_SECTION_ICONS: Record<string, LucideIcon> = {
  heart: Heart,
  layers: Layers,
  users: Users,
  sparkles: Sparkles,
  trending_up: TrendingUp,
  clock: Clock,
}
