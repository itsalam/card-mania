import {
    viewCollectionItemsForCard,
    viewCollectionsForCard,
} from "@/lib/store/functions/collections";
import { qk } from "@/lib/store/functions/helpers";
import {
    DefaultError,
    keepPreviousData,
    useQuery,
} from "@tanstack/react-query";
import { useIsWishlisted } from "../card/wishlist";
import { CollectionItem, CollectionLike, CollectionView } from "./types";

export function useViewCollectionsForCard(cardId = "", query?: string) {
    const { data: isWishListed } = useIsWishlisted("card", [cardId]);

    return useQuery<CollectionLike[], DefaultError, CollectionView>({
        queryKey: [
            ...qk.collectionForCard(cardId),
            ...(query ? ["query", query] : []),
        ],
        queryFn: () => viewCollectionsForCard(cardId, query),
        select: (collections = []) => {
            const wishListCollection = {
                id: "wishlist",
                name: "Wishlist",
                description: "Cards you have wishlisted",
                visibility: "private",
                created_at: new Date().toISOString(),
                has_item: true,
                updated_at: new Date().toISOString(),
            } as Partial<
                Awaited<ReturnType<typeof viewCollectionsForCard>>[number]
            >;
            const included: CollectionLike[] = collections.filter((c) =>
                c.has_item
            );
            const excluded: CollectionLike[] = collections.filter((c) =>
                !c.has_item
            );
            if (isWishListed?.has(cardId)) {
                included.unshift(wishListCollection);
            } else {
                excluded.unshift(wishListCollection);
            }
            return { included, excluded };
        },
        placeholderData: keepPreviousData,
        enabled: !!cardId && !!cardId.length,
    });
}

export function useViewCollectionItemsForCard(
    collectionId: string,
    cardId: string,
) {
    return useQuery<
        CollectionItem[],
        DefaultError,
        CollectionItem[]
    >({
        queryKey: [
            ...qk.collectionItems(collectionId),
            ...(cardId ? ["cardId", cardId] : []),
        ],
        queryFn: () => viewCollectionItemsForCard(collectionId, cardId),
        placeholderData: keepPreviousData,
        enabled: !!cardId.length && !!collectionId.length,
    });
}
