export type WishlistHit = {
  id: string
  title: string
  setName: string
  ownerHandle: string
  wishlistPrice: number
  currentPrice: number
}

// TODO(ITS-107 follow-up): no "wishlist matches a storefront listing" query exists yet — this
// is placeholder data purely so AvailableNow's visual design can be reviewed. Swap this file's
// export for a real hook once that query is built (matching how CollectionsPreview/
// SuggestedSellers already source their items), and delete this file.
export const MOCK_WISHLIST_HITS: WishlistHit[] = [
  {
    id: 'mock-1',
    title: 'Charizard',
    setName: 'Base Set',
    ownerHandle: '@pokecollector',
    wishlistPrice: 15.99,
    currentPrice: 12.5,
  },
  {
    id: 'mock-2',
    title: 'Blastoise',
    setName: 'Base Set',
    ownerHandle: '@vintagevault',
    wishlistPrice: 42.0,
    currentPrice: 38.75,
  },
  {
    id: 'mock-3',
    title: 'Pikachu',
    setName: 'Jungle',
    ownerHandle: '@cardshop_mia',
    wishlistPrice: 8.25,
    currentPrice: 6.99,
  },
]
