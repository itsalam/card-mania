import { ItemKinds, TCard } from "@/constants/types";
import { supabase } from "@/lib/store/client";
import { qk, WishlistKey } from "@/lib/store/functions/helpers";
import { Database, Json } from "@/lib/store/supabase";
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

class WishlistBatcher {
    private pending = new Map<string, Set<string>>();
    private resolvers: ((s: Set<string>) => void)[] = [];
    private timer?: number;

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
    kind: ItemKinds;
    id: string;
    p_metadata?: Json;
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

type WishlistRow =
    & Database["public"]["Views"]["wishlist_cards_enriched"]["Row"]
    & TCard;
// Otherwise, a quick fallback:
// type Row = { user_id: string; created_at: string; id: string; title: string; /* ...other card columns... */ };

export function getWishlistQueryArgs(opts?: InfQueryOptions) {
    let { pageSize, search, kind } = { ...DEFAULT_INF_Q_OPTIONS, ...opts };
    const queryKey = [...buildPrefixKey(WishlistKey.View), kind, "enriched", {
        search,
        pageSize,
    }];

    const args = {
        queryKey,
        getNextPageParam: (lastPage) =>
            lastPage?.length ? lastPage[lastPage.length - 1].created_at : null,
        queryFn: async ({ pageParam }) => {
            let qb = supabase
                .from("wishlist_cards_enriched")
                .select("*")
                .order("created_at", { ascending: false })
                .limit(pageSize!);

            if (pageParam) qb = qb.lt("created_at", pageParam);
            if (search) qb = qb.ilike("title", `%${search}%`); // adjust column name(s) to your schema

            const { data, error } = await qb;
            if (error) throw error;
            return data as WishlistRow[];
        },
        initialPageParam: null as string | null,
    } as InifiniteQueryParams<WishlistRow>;

    return args as any as InifiniteQueryParams;
}

export function useWishlistCardsEnriched(
    opts: InfQueryOptions,
) {
    let { pageSize = 50, search = "", kind = "card", ...queryOpts } = opts;
    const wishlistArgs = {
        ...queryOpts,
        ...getWishlistQueryArgs(opts),
    } as InifiniteQueryParams<WishlistRow>;

    return useViewCollectionItems<WishlistRow>(wishlistArgs);
}
