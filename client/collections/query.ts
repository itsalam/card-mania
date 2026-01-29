import {
    viewCollectionItemsForCard,
    viewCollectionItemsForUser,
    viewCollectionsForCard,
} from "@/lib/store/functions/collections";
import { qk } from "@/lib/store/functions/helpers";
import { CollectionItemRow, CollectionRow } from "@/lib/store/functions/types";
import {
    DefaultError,
    keepPreviousData,
    useInfiniteQuery,
    useQuery,
} from "@tanstack/react-query";
import React from "react";
import { ViewParams } from "../card/types";
import { useIsWishlisted } from "../card/wishlist";
import {
    CollectionItem,
    CollectionLike,
    CollectionView,
    InfQueryOptions,
    InifiniteQueryParams,
} from "./types";

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
    collectionId?: string,
    cardId?: string,
    enabled?: boolean,
) {
    return useQuery<
        CollectionItem[],
        DefaultError,
        CollectionItem[]
    >({
        queryKey: [
            //@ts-ignore
            ...qk.collectionItems(collectionId),
            ...(cardId ? ["cardId", cardId] : []),
        ],
        //@ts-ignore
        queryFn: () => viewCollectionItemsForCard(collectionId, cardId),
        placeholderData: keepPreviousData,
        enabled: enabled && !!cardId && !!collectionId,
        initialData: [],
    });
}

export const DEFAULT_INF_Q_OPTIONS: InfQueryOptions<CollectionItemRow> = {
    pageSize: 50,
    kind: "card",
};

export function useViewCollectionForUser(hideDefaults = false) {
    return useQuery<
        {},
        DefaultError,
        CollectionRow[]
    >({
        queryKey: [
            ...qk.userCollections,
            hideDefaults ? "hide-defaults" : "all",
        ],
        queryFn: viewCollectionItemsForUser(hideDefaults),
        placeholderData: keepPreviousData,
        initialData: [],
    });
}

export function useViewCollectionItems<T extends CollectionItemRow>(
    opts: InifiniteQueryParams<T>,
) {
    let {
        queryKey,
        getNextPageParam,
        ...infiniteQueryOpts
    } = opts;

    const query = useInfiniteQuery({
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        queryKey,
        getNextPageParam,
        ...infiniteQueryOpts,
    });

    return { query, viewParams: { key: queryKey } as ViewParams };
}
