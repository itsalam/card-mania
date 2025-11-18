import { TCard } from "@/constants/types";
import { supabase } from "@/lib/store/client";
import { qk, WishlistKey } from "@/lib/store/functions/helpers";
import { Database, Json } from "@/lib/store/supabase";
import {
    InfiniteData,
    QueryClient,
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { ViewParams } from "./types";

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
    const queryKey = qk.wishlist("card");

    let cached = (qc.getQueryCache().find<Set<string>>({
        queryKey,
    })?.state.data) as Set<string>;
    cached = !cached || Object.entries(cached).length === 0
        ? new Set<string>()
        : cached;

    const unvisited = sorted.filter((id) => !cached.has(id));
    const visited = new Set(sorted.filter((id) => cached.has(id)));

    return useQuery({
        enabled: cached.size === 0 && unvisited.length > 0,
        initialData: visited,
        queryKey,
        queryFn: async () => {
            const result = await wishlistBatcher.request(kind, unvisited);
            const newSet = new Set<string>([...cached, ...result]);
            return newSet;
        },
        staleTime: 60_000,
    });
}

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

function setWishlist(
    qc: QueryClient,
    kind: string,
    fn: (s: Set<string>) => Set<string>,
) {
    qc.setQueryData<Set<string>>(
        qk.wishlist(kind),
        (prev) => fn(prev ? new Set(prev) : new Set()),
    );
}

export function useToggleWishlist(kind: string) {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async ({ kind, id, p_metadata }: ToggleWishlistParams) => {
            const { data, error } = await supabase.rpc("wishlist_toggle", {
                p_kind: kind,
                p_ref_id: id,
                p_metadata: p_metadata,
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
            qc.invalidateQueries({ queryKey: ["wishlist", "totals", kind] });
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
//     { idKey, kind, qc, isOn }: {
//         idKey: string;
//         kind: string;
//         qc: QueryClient;
//         isOn?: boolean;
//     },
// ) => {
//     qc.getQueryCache().findAll({
//         queryKey: [...buildPrefixKey(WishlistKey.Set), kind],
//     })
//         .forEach((q) => {
//             const key = q.queryKey as [string, string, ...string[]];

//             const [, , ...ids] = key;
//             if (ids?.includes(idKey)) {
//                 qc.setQueryData<Set<string>>(key, (prev) => {
//                     const next = new Set(prev ?? []);
//                     if (typeof isOn === "boolean") {
//                         if (isOn) {
//                             next.add(idKey);
//                         } else {
//                             next.delete(idKey);
//                         }
//                     } else {
//                         next.has(idKey) ? next.delete(idKey) : next.add(idKey);
//                     }
//                     return next;
//                 });
//             }
//         });
// };
