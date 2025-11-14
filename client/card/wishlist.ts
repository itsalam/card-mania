import { TCard } from "@/constants/types";
import { supabase } from "@/lib/store/client";
import { Database, Json } from "@/lib/store/supabase";
import {
    InfiniteData,
    QueryClient,
    QueryKey,
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

enum WishlistKey {
    Single = "wishlist/one",
    Set = "wishlist/set",
    View = "wishlist/view",
    Totals = "wishlist/totals",
}

const buildPrefixKey = (wishlistKey: WishlistKey, separator = "/") => {
    return [...wishlistKey.split(separator)];
};

class WishlistBatcher {
    private pending = new Map<string, Set<string>>();
    private resolvers: ((s: Set<string>) => void)[] = [];
    private timer?: number;

    request(kind: string, ids: string[]) {
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

    private async flush() {
        const batches = Array.from(this.pending.entries()); // [[kind, Set(ids)], ...]
        this.pending.clear();
        this.timer = undefined;

        // Build a single mixed-kind query
        const ors = batches
            .filter(([_, ids]) => ids.size)
            .map(([kind, ids]) =>
                `and(kind.eq.${kind},ref_id.in.(${[...ids].join(",")}))`
            );

        const { data } = await supabase
            .from("wishlist").select("kind, ref_id")
            .or(ors.join(","));

        const result = new Set(data?.map((r) => `${r.ref_id}`) ?? []);
        this.resolvers.splice(0).forEach((r) => r(result));
    }
}

export const wishlistBatcher = new WishlistBatcher();

export function useIsWishlisted(kind: string, ids: string[]) {
    const sorted = [...new Set(ids)].sort(); // stable key
    const qc = useQueryClient();
    const isSingle = sorted.length === 1;

    const cachedFromSingle = isSingle
        ? qc.getQueryCache().findAll({
            queryKey: [...buildPrefixKey(WishlistKey.Single), kind, ...sorted],
        }).map((q) => q.state.data as Set<string> | undefined)[0]
        : undefined;

    const cachedFromSet = isSingle && !Boolean(cachedFromSingle)
        ? qc.getQueryCache().findAll({
            queryKey: [...buildPrefixKey(WishlistKey.Set), kind],
        })
            .map((q) => q.state.data as Set<string> | undefined)
            .find((set) => set?.has(ids[0]))
        : undefined;

    const cached = cachedFromSingle ?? cachedFromSet;

    const queryKey = [
        ...(isSingle ? WishlistKey.Single : WishlistKey.Set).split("/"),
        kind,
        ...sorted,
    ];
    return useQuery({
        enabled: !Boolean(cached) && ids.length > 0,
        initialData: cached ?? undefined,
        queryKey,
        queryFn: async () => {
            return await wishlistBatcher.request(kind, sorted);
        },
        staleTime: 60_000,
    });
}

export type ViewParams = {
    key: QueryKey;
    pageSize?: number;
};

type ToggleWishlistParams = {
    kind: string;
    id: string;
    p_metadata?: Json;
    viewParams?: ViewParams;
};

type ToggleWishlistContext = Partial<{
    prev: InfiniteData<Row[], unknown> | undefined;

    touched?: boolean;
}>;

export function useToggleWishlist() {
    const qc = useQueryClient();
    return useMutation<
        boolean,
        Error,
        ToggleWishlistParams,
        ToggleWishlistContext
    >({
        mutationFn: async (
            { kind, id, p_metadata }: ToggleWishlistParams,
        ) => {
            const { data, error } = await supabase.rpc("wishlist_toggle", {
                p_kind: kind,
                p_ref_id: id,
                p_metadata: p_metadata,
            });
            if (error) throw error;
            return data[0].is_wishlisted;
        },
        onMutate: async ({ kind, id, viewParams }) => {
            const idKey = `${id}`;
            setSingleQueryData({ idKey, kind, qc });
            setMultipleQueryData({ idKey, kind, qc });

            const ctx: ToggleWishlistContext = {};
            if (viewParams) {
                await qc.cancelQueries({ queryKey: viewParams.key });
                const prev = qc.getQueryData<InfiniteData<Row[]>>(
                    viewParams.key,
                );
                if (prev) {
                    ctx.prev = prev;
                    const pages = prev.pages.map((p) =>
                        p.filter((r) => r.id !== id)
                    );
                    qc.setQueryData<InfiniteData<Row[]>>(viewParams.key, {
                        pageParams: prev.pageParams,
                        pages,
                    });
                    ctx.touched = true;
                }
            }
            return ctx;
        },
        onError: (_e, { kind, id, viewParams }, ctx) => {
            const idKey = `${id}`;
            setSingleQueryData({ idKey, kind, qc });
            setMultipleQueryData({ idKey, kind, qc });

            if (ctx?.prev && ctx.touched && viewParams) {
                qc.setQueryData<InfiniteData<Row[]>>(viewParams.key, ctx.prev);
            }
        },
        onSuccess: async (isOn, { id, kind, viewParams }) => {
            setSingleQueryData({ idKey: id, kind, qc, isOn });
            setMultipleQueryData({ idKey: id, kind, qc, isOn });
            if (isOn && viewParams) {
                const { data: row } = await supabase
                    .from("wishlist_cards_enriched")
                    .select("*")
                    .eq("id", id)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (row) {
                    const prev = qc.getQueryData<InfiniteData<Row[]>>(
                        viewParams.key,
                    );
                    if (prev) {
                        const pages = [...prev.pages];
                        pages[0] = [row as Row, ...pages[0]];
                        if (
                            viewParams.pageSize &&
                            pages[0].length > viewParams.pageSize
                        ) pages[0].pop();
                        qc.setQueryData<InfiniteData<Row[]>>(viewParams.key, {
                            pageParams: prev.pageParams,
                            pages,
                        });
                    }
                } else {
                    // If we can't fetch the single row (filter mismatch), just invalidate
                    qc.invalidateQueries({ queryKey: viewParams.key });
                }
            } else {
                qc.invalidateQueries({
                    queryKey: buildPrefixKey(WishlistKey.View),
                });
            }

            qc.invalidateQueries({
                queryKey: buildPrefixKey(WishlistKey.Totals),
            });
        },
        onSettled: (_d, _e, { viewParams }) => {
            if (viewParams) qc.invalidateQueries({ queryKey: viewParams.key });
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

type Row =
    & Database["public"]["Views"]["wishlist_cards_enriched"]["Row"]
    & TCard;
// Otherwise, a quick fallback:
// type Row = { user_id: string; created_at: string; id: string; title: string; /* ...other card columns... */ };

export function useWishlistCardsEnriched(opts?: {
    pageSize?: number;
    search?: string; // e.g. filter by card title (requires a title column in cards)
    kind?: string;
}) {
    const pageSize = opts?.pageSize ?? 50;
    const search = opts?.search?.trim() || "";
    const kind = opts?.kind ?? "card";

    const queryKey = [...buildPrefixKey(WishlistKey.View), kind, "enriched", {
        search,
        pageSize,
    }];

    const query = useInfiniteQuery({
        queryKey,
        initialPageParam: null as string | null, // cursor = created_at (ISO string)
        queryFn: async ({ pageParam }) => {
            let qb = supabase
                .from("wishlist_cards_enriched")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(pageSize);

            if (pageParam) qb = qb.lt("created_at", pageParam);
            if (search) qb = qb.ilike("title", `%${search}%`); // adjust column name(s) to your schema

            const { data, error } = await qb;
            if (error) throw error;
            return data as Row[];
        },
        getNextPageParam: (lastPage) =>
            lastPage?.length ? lastPage[lastPage.length - 1].created_at : null,
        staleTime: 60_000,
        gcTime: 5 * 60_000,
    });

    return { query, viewParams: { key: queryKey, pageSize } as ViewParams };
}

// Helpers

const setSingleQueryData = (
    { idKey, kind, qc, isOn }: {
        idKey: string;
        kind: string;
        qc: QueryClient;
        isOn?: boolean;
    },
) => {
    qc.setQueryData<Set<string>>(
        [...buildPrefixKey(WishlistKey.Single), kind, idKey],
        (prev) => {
            const next = new Set(prev ?? []);
            if (typeof isOn === "boolean") {
                if (isOn) {
                    next.add(idKey);
                } else {
                    next.delete(idKey);
                }
            } else {
                next.has(idKey) ? next.delete(idKey) : next.add(idKey);
            }
            return next;
        },
    );
};

const setMultipleQueryData = (
    { idKey, kind, qc, isOn }: {
        idKey: string;
        kind: string;
        qc: QueryClient;
        isOn?: boolean;
    },
) => {
    qc.getQueryCache().findAll({
        queryKey: [...buildPrefixKey(WishlistKey.Set), kind],
    })
        .forEach((q) => {
            const key = q.queryKey as [string, string, ...string[]];

            const [, , ...ids] = key;
            if (ids?.includes(idKey)) {
                qc.setQueryData<Set<string>>(key, (prev) => {
                    const next = new Set(prev ?? []);
                    if (typeof isOn === "boolean") {
                        if (isOn) {
                            next.add(idKey);
                        } else {
                            next.delete(idKey);
                        }
                    } else {
                        next.has(idKey) ? next.delete(idKey) : next.add(idKey);
                    }
                    return next;
                });
            }
        });
};
