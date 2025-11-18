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
import React from "react";
import { useIsWishlisted } from "../card/wishlist";
import { CollectionItem, CollectionLike, CollectionView } from "./types";

export function useViewCollectionsForCard(cardId = "", query?: string) {
    const { data: isWishlisted } = useIsWishlisted("card", [cardId]);

    const base = useQuery<CollectionLike[], DefaultError>({
        queryKey: [
            ...qk.collectionForCard(cardId),
            ...(query ? ["query", query] : []),
        ],
        queryFn: () => viewCollectionsForCard(cardId, query),
        placeholderData: keepPreviousData,
        enabled: !!cardId && !!cardId.length,
        // keep: no select here
    });

    const data = React.useMemo<CollectionView>(() => {
        const collections = base.data ?? [];

        const wishListCollection: CollectionLike = {
            id: "wishlist",
            name: "Wishlist",
            description: "Cards you have wishlisted",
            visibility: "private",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            has_item: true,
        } as any;

        const included = collections.filter((c) => c.has_item);
        const excluded = collections.filter((c) => !c.has_item);

        if (isWishlisted?.has(cardId)) included.unshift(wishListCollection);
        else excluded.unshift(wishListCollection);

        return { included, excluded };
    }, [base.data, isWishlisted, cardId]);

    return { ...base, data };
}

export function useViewCollectionItemsForCard(
    collectionId: string,
    cardId: string,
    enabled: boolean,
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
        enabled: enabled && !!cardId.length && !!collectionId.length,
        initialData: [],
    });
}
