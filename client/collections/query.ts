import { getSupabase } from "@/lib/store/client";
import {
    viewCollectionItemsForCard,
    viewCollectionItemsForUser,
    viewCollectionsForCard,
} from "@/lib/store/functions/collections";
import { qk, WishlistKey } from "@/lib/store/functions/helpers";
import { CollectionItemRow, CollectionRow } from "@/lib/store/functions/types";
import {
    DefaultError,
    keepPreviousData,
    useInfiniteQuery,
    useQuery,
} from "@tanstack/react-query";
import React from "react";
import { ViewParams } from "../card/types";
import { buildPrefixKey, useIsWishlisted } from "../card/wishlist";
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
export function useWishlistTotal() {
    return useQuery({
        queryKey: buildPrefixKey(WishlistKey.Totals),
        staleTime: 60000, // tweak to taste
        queryFn: async () => {
            // 1) Check existence with a cheap HEAD+COUNT (RLS: returns only your row if any)
            const { count, error: headErr } = await getSupabase()
                .from("wishlist_totals")
                .select("user_id", { count: "exact", head: true });

            if (headErr) throw headErr;

            // 2) If absent -> recompute (also upserts the row)
            if (!count || count === 0) {
                const { data, error } = await getSupabase().rpc(
                    "wishlist_recompute_total",
                );
                if (error) throw error;
                // data is the total in cents (int)
                return data ?? 0;
            }

            // 3) If present -> fast path
            const { data, error } = await getSupabase().rpc("wishlist_total");
            if (error) throw error;
            return data ?? 0;
        },
    });
}
