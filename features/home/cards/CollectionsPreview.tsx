import { ExpandableCard, ExpandedContent } from '@/components/content-card'
import { THUMBNAIL_WIDTH } from '@/components/tcg-card/consts'
import { CollectionsListItem } from '@/features/collection/components/ListItem'
import { useMyCollections } from '@/lib/store/functions/hooks'

export function CollectionsPreview() {
  const { data: collections } = useMyCollections()
  return (
    <ExpandableCard
      variant="ghost"
      title="Collections"
      itemWidth={THUMBNAIL_WIDTH}
      items={collections ?? []}
      renderItem={({ isOpen }) => (
        <CollectionsListItem isOpen={isOpen} cardWidth={THUMBNAIL_WIDTH}>
          {isOpen && <ExpandedContent />}
        </CollectionsListItem>
      )}
    />
  )
}
