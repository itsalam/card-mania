import { ModifyCollectionView } from '@/features/collection/pages/modify-collection'
import { qk } from '@/lib/store/functions/helpers'
import { useRequiredUserId } from '@/lib/store/useUserStore'
import { useQueryClient } from '@tanstack/react-query'
import { useCardDetails } from '@/features/tcg-card-views/DetailCardView/provider'

// Reuses ModifyCollectionView wholesale — the same component the pinned collections tab bar's
// own "New Collection" screen renders — rather than a hand-styled copy, so the two stay
// identical by construction. Its own internal header (circular back-chevron + title) replaces
// what used to be a separate header row here plus a bottom "Back" button; footer.tsx no longer
// renders its own shared header for this page (see that file's own comment) to avoid showing two.
export const CreateCollectionView = () => {
  const { setPage, card } = useCardDetails()
  const username = useRequiredUserId()
  const qc = useQueryClient()

  return (
    <ModifyCollectionView
      onBack={() => setPage(0)}
      onSubmit={() => {
        card &&
          username &&
          qc.invalidateQueries({
            queryKey: qk.collectionForCard(card?.id, username),
          })

        setPage(0)
      }}
    />
  )
}
