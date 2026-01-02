import React from "react";
import { ItemKinds } from "@/constants/types";
import { supabase } from "@/lib/store/client";
import { qk, requireUser, WishlistKey } from "@/lib/store/functions/helpers";
import { CollectionItemRow } from "@/lib/store/functions/types";
import { Database } from "@/lib/store/supabase";
import {
    InfiniteData,
    QueryClient,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import {
    DEFAULT_INF_Q_OPTIONS,
    useViewCollectionItems,
} from "../collections/query";
import { InfQueryOptions, InifiniteQueryParams } from "../collections/types";
import { ViewParams } from "./types";

const buildPrefixKey = (wishlistKey: WishlistKey, separator = "/") => {
    return [...wishlistKey.split(separator)];
};

let cachedWishlistCollectionId: string | null | undefined;
let loadingWishlistCollectionId: PromiseLike<string | null> | undefined;

export async function getWishlistCollectionId() {
    if (cachedWishlistCollectionId !== undefined) {
        return cachedWishlistCollectionId;
    }
    if (loadingWishlistCollectionId) return loadingWishlistCollectionId;

    loadingWishlistCollectionId = supabase
        .from("wishlist")
        .select("collection_id")
        .maybeSingle()
        .then(({ data, error }) => {
            loadingWishlistCollectionId = undefined;
            if (error) throw error;
            cachedWishlistCollectionId = data?.collection_id ?? null;
            return cachedWishlistCollectionId;
        });

    return loadingWishlistCollectionId;
}

class WishlistBatcher {
    private pending = new Map<ItemKinds, Set<string>>();
    private resolvers: ((s: Set<string>) => void)[] = [];
    private timer?: number;
    private wishlistCollectionId?: string;
    private loadingWishlistId?: PromiseLike<string | null>;

    request(kind: ItemKinds, ids: string[]) {
        const k = kind;
        const set = this.pending.get(k) ?? new Set<string>();
        ids.forEach((id) => set.add(id));
        this.pending.set(k, set);
        return new Promise<Set<string>>((resolve) => {
            this.resolvers.push(resolve);
            if (!this.timer) {
                this.timer = setTimeout(
                    () => this.flush(),
                    0,
                ) as unknown as number;
            }
        });
    }

    private async fetchWishlistCollectionId() {
        if (this.wishlistCollectionId) return this.wishlistCollectionId;
        if (this.loadingWishlistId) return this.loadingWishlistId;
        const user = await requireUser();
        this.loadingWishlistId = supabase
            .from("wishlist")
            .select("collection_id")
            .eq("user_id", user.id)
            .maybeSingle()
            .then(({ data, error }) => {
                this.loadingWishlistId = undefined;
                if (error) throw error;
                const id = data?.collection_id ?? null;
                this.wishlistCollectionId = id ?? undefined;
                return id;
            });

        return this.loadingWishlistId;
    }

    private async flush() {
        const batches = Array.from(this.pending.entries()); // [[kind, Set(ids)], ...]
        this.pending.clear();
        this.timer = undefined;
        if (!batches.length) {
            this.resolvers.splice(0).forEach((r) => r(new Set()));
            return;
        }

        const wishlistCollectionId = await this.fetchWishlistCollectionId();
        if (!wishlistCollectionId) {
            this.resolvers.splice(0).forEach((r) => r(new Set()));
            return;
        }

        const result = new Set<string>();

        for (const [kind, ids] of batches) {
            if (!ids.size) continue;
            const { data, error } = await supabase
                .from("collection_items")
                .select("ref_id")
                .eq("collection_id", wishlistCollectionId)
                .eq("item_kind", kind)
                .in("ref_id", [...ids]);

            if (error) throw error;
            data?.forEach((row) => result.add(`${row.ref_id}`));
        }

        this.resolvers.splice(0).forEach((r) => r(result));
    }
}

export const wishlistBatcher = new WishlistBatcher();

function toSet(value: unknown): Set<string> {
    if (value instanceof Set) return value;
    if (Array.isArray(value)) return new Set(value as string[]);
    return new Set();
}

function union(a: Set<string>, b: Set<string>) {
    const next = new Set(a);
    b.forEach((v) => next.add(v));
    return next;
}

function difference(a: Set<string>, b: Set<string>) {
    const next = new Set(a);
    b.forEach((v) => next.delete(v));
    return next;
}

function intersection(a: Set<string>, b: Set<string>) {
    const next = new Set<string>();
    b.forEach((v) => {
        if (a.has(v)) next.add(v);
    });
    return next;
}

export function useIsWishlisted(kind: ItemKinds, ids: string[]) {
    const idSet = new Set(ids);
    const qc = useQueryClient();
    const queryKey = qk.wishlist(kind);
    const negativeQueryKey = [...queryKey, "negative"];
    const unvisitedKey = [...idSet].sort().join(",");

    const cachedPos = toSet(qc.getQueryData(queryKey));
    const cachedNeg = toSet(qc.getQueryData(negativeQueryKey));

    const alreadyKnown = union(cachedPos, cachedNeg);
    const unvisited = difference(idSet, alreadyKnown);
    const visited = intersection(idSet, cachedPos);

    const query = useQuery({
        enabled: false, // manual refetch when unvisited changes
        initialData: visited,
        queryKey,
        queryFn: async () => {
            const result = await wishlistBatcher.request(kind, [
                ...unvisited.values(),
            ]);
            const newPos = union(cachedPos, result);
            // Negatives = requested ids that did not come back as wishlisted.
            const negatives = difference(unvisited, newPos);
            qc.setQueryData<Set<string>>(
                negativeQueryKey,
                (prev) => union(negatives, toSet(prev)),
            );
            return newPos;
        },
        staleTime: 60_000,
    });

    // Fire the batch request whenever we see new ids that aren't cached yet.
    React.useEffect(() => {
        if (unvisited.size === 0) return;
        query.refetch();
    }, [unvisitedKey]);

    return query;
}

type ToggleWishlistParams = {
    kind: ItemKinds;
    id: string;
    grade_condition_id?: string;
    viewParams?: ViewParams;
};

type ToggleWishlistContext = Partial<{
    prev: InfiniteData<WishlistRow[], unknown> | undefined;

    touched?: boolean;
}>;

function setWishlist(
    qc: QueryClient,
    kind: ItemKinds,
    fn: (s: Set<string>) => Set<string>,
) {
    qc.setQueryData<Set<string>>(
        qk.wishlist(kind),
        (prev) => fn(prev ? new Set(prev) : new Set()),
    );
}

export function useToggleWishlist(kind: ItemKinds) {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async (
            { kind, id, grade_condition_id }: ToggleWishlistParams,
        ) => {
            const { data, error } = await supabase.rpc("wishlist_toggle", {
                p_kind: kind,
                p_ref_id: id,
                p_grade_cond_id: grade_condition_id,
            });
            if (error) throw error;
            return { id, on: data[0].is_wishlisted };
        },

        onMutate: async ({ id }) => {
            await qc.cancelQueries({ queryKey: qk.wishlist(kind) });

            // Optimistically flip Set
            setWishlist(qc, kind, (s) => {
                const next = new Set(s);
                next.has(id) ? next.delete(id) : next.add(id);
                return next;
            });

            // Optionally patch entity map’s wishlisted flag for instant UI
            return {
                prev: qc.getQueryData<Set<string>>(qk.wishlist(kind)) ??
                    new Set(),
                id,
            };
        },

        onError: (_e, _vars, ctx) => {
            // rollback set & entity
            if (!ctx) return;
            qc.setQueryData(qk.wishlist(kind), ctx.prev);
        },

        onSuccess: ({ id, on }) => {
            // align with server (in case optimistic was wrong)
            setWishlist(qc, kind, (s) => {
                const next = new Set(s);
                on ? next.add(id) : next.delete(id);
                return next;
            });
            //   patchCard(qc, id, { wishlisted: on });
        },

        onSettled: () => {
            // If you have aggregates, invalidate them—NOT your card lists
            qc.invalidateQueries({ queryKey: ["wishlist", "totals"] });
            qc.invalidateQueries({ queryKey: ["wishlist", "view", kind] });
        },
    });
}

export function useWishlistTotal() {
    return useQuery({
        queryKey: buildPrefixKey(WishlistKey.Totals),
        staleTime: 60_000, // tweak to taste
        queryFn: async () => {
            // 1) Check existence with a cheap HEAD+COUNT (RLS: returns only your row if any)
            const { count, error: headErr } = await supabase
                .from("wishlist_totals")
                .select("user_id", { count: "exact", head: true });

            if (headErr) throw headErr;

            // 2) If absent -> recompute (also upserts the row)
            if (!count || count === 0) {
                const { data, error } = await supabase.rpc(
                    "wishlist_recompute_total",
                );
                if (error) throw error;
                // data is the total in cents (int)
                return data ?? 0;
            }

            // 3) If present -> fast path
            const { data, error } = await supabase.rpc("wishlist_total");
            if (error) throw error;
            return data ?? 0;
        },
    });
}

type WishlistRow =
    Database["public"]["Functions"]["collection_item_query"]["Returns"][number];
// Otherwise, a quick fallback:
// type Row = { user_id: string; created_at: string; id: string; title: string; /* ...other card columns... */ };

export function getWishlistQueryArgs<T extends CollectionItemRow>(
    opts?: InfQueryOptions<T>,
) {
    let { pageSize, search, kind } = { ...DEFAULT_INF_Q_OPTIONS, ...opts };
    const queryKey = [
        ...buildPrefixKey(WishlistKey.View),
        kind,
        "collection-backed",
        {
            search,
            pageSize,
        },
    ];

    const args = {
        queryKey,
        getNextPageParam: (lastPage) =>
            lastPage?.length ? lastPage[lastPage.length - 1].created_at : null,
        queryFn: async ({ pageParam }) => {
            const wishlistCollectionId = await getWishlistCollectionId();
            if (!wishlistCollectionId) return [];

            const { data, error } = await supabase.rpc(
                "collection_item_query",
                {
                    p_collection_id: wishlistCollectionId,
                    p_page_param: pageParam as string,
                    p_search: search,
                    p_page_size: pageSize,
                },
            );

            if (error) throw error;
            return (data ?? []) as CollectionItemRow[];
        },
        initialPageParam: null as string | null,
    } as InifiniteQueryParams<CollectionItemRow>;

    return args as any as InifiniteQueryParams;
}

export function useWishlistCardsEnriched(
    opts: InfQueryOptions<CollectionItemRow>,
) {
    let { pageSize = 50, search = "", kind = "card", ...queryOpts } = opts;
    const wishlistArgs = {
        ...queryOpts,
        ...getWishlistQueryArgs(opts),
    } as InifiniteQueryParams;

    return useViewCollectionItems(wishlistArgs);
}
