import { ExpandableCard, ExpandedContent } from "@/components/content-card";
import { CollectionsListItem } from "@/features/collection/components/ListItem";
import { useMyCollections } from "@/lib/store/functions/hooks";


export function CollectionsPreview() {
  const { data: collections } = useMyCollections();
  return (
    <ExpandableCard
      variant="ghost"
      title="Collections"
      itemWidth={96}
      items={collections ?? []}
      renderItem={({ isOpen }) => (
        <CollectionsListItem isOpen={isOpen} cardWidth={96}>
          {isOpen && <ExpandedContent />}
        </CollectionsListItem>
      )}
    />
  )
}
