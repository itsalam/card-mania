// Bundle entry for the Card Mania design-system sync.
// Re-exports the storied UI components (and their compound parts, for
// composition) so the converter can expose them on window.CardMania.
// react-native is aliased to react-native-web in .design-sync/prebundle.mjs.
export { Button } from '@/components/ui/button'
export { Badge, Chip } from '@/components/ui/badge'
export { Text } from '@/components/ui/text/base-text'
// Avatar is intentionally excluded from the sync — its @rn-primitives + gluestack
// web rendering is broken (no circular container; crashed the design agent). See NOTES.md.
export { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
export { CollapsibleSection } from '@/components/ui/collapsible-section'
export { CardListView } from '@/features/tcg-card-views/ListCard'
export { Skeleton, SkeletonView } from '@/components/ui/skeleton'
export { SkeletonText } from '@/components/ui/text/skeleton-text'
export {
  Tabs,
  TabsContent,
  TabsLabel,
  TabsList,
  TabsScrollList,
  TabsTrigger,
} from '@/components/ui/tabs'
export { TabRow } from '@/components/tabs/TabRow'
