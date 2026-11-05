// Collection appearance (ITS-98): the curated icon set and accent palette a collection can pick
// from. The DB stores only keys (collections.icon_key / accent_color); unknown or missing keys
// fall back to the defaults here, so this set can grow without a migration.
import {
  Bookmark,
  Crown,
  Droplet,
  Flame,
  FolderHeart,
  Gamepad2,
  Gem,
  Ghost,
  Gift,
  Heart,
  Layers,
  Leaf,
  LucideIcon,
  Medal,
  Moon,
  Package,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Sun,
  Swords,
  Target,
  Trophy,
  Zap,
} from 'lucide-react-native'
import { Colors } from 'react-native-ui-lib'

export const DEFAULT_COLLECTION_ICON = FolderHeart

export const COLLECTION_ICONS: { key: string; icon: LucideIcon }[] = [
  { key: 'folder-heart', icon: FolderHeart },
  { key: 'star', icon: Star },
  { key: 'trophy', icon: Trophy },
  { key: 'crown', icon: Crown },
  { key: 'medal', icon: Medal },
  { key: 'gem', icon: Gem },
  { key: 'sparkles', icon: Sparkles },
  { key: 'flame', icon: Flame },
  { key: 'zap', icon: Zap },
  { key: 'heart', icon: Heart },
  { key: 'shield', icon: Shield },
  { key: 'swords', icon: Swords },
  { key: 'target', icon: Target },
  { key: 'rocket', icon: Rocket },
  { key: 'ghost', icon: Ghost },
  { key: 'droplet', icon: Droplet },
  { key: 'leaf', icon: Leaf },
  { key: 'sun', icon: Sun },
  { key: 'moon', icon: Moon },
  { key: 'gamepad', icon: Gamepad2 },
  { key: 'package', icon: Package },
  { key: 'layers', icon: Layers },
  { key: 'gift', icon: Gift },
  { key: 'bookmark', icon: Bookmark },
]

/** Keys must match the collections_accent_color_check constraint. */
export const COLLECTION_ACCENTS = [
  'violet',
  'purple',
  'blue',
  'cyan',
  'green',
  'yellow',
  'orange',
  'red',
  'grey',
] as const
export type CollectionAccent = (typeof COLLECTION_ACCENTS)[number]

export function collectionIcon(key?: string | null): LucideIcon | undefined {
  return key ? COLLECTION_ICONS.find((i) => i.key === key)?.icon : undefined
}

/**
 * A palette color for the accent key, read from Colors at call time (not module load) so it
 * follows the active theme. Undefined when no (or an unknown) accent is set.
 */
export function collectionAccentColor(key?: string | null): string | undefined {
  if (!key || !(COLLECTION_ACCENTS as readonly string[]).includes(key)) return undefined
  return (Colors as unknown as Record<string, string>)[`${key}30`]
}

export type CollectionAppearance = {
  icon_key?: string | null
  accent_color?: string | null
  background_image_id?: string | null
}
