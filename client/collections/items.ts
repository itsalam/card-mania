import { supabase } from "@/lib/store/client";
import { Database } from "@/lib/store/supabase";
import {
    keepPreviousData,
    queryOptions,
    useQuery,
} from "@tanstack/react-query";

export type Variant = Database["public"]["Tables"]["card_variants"]["Row"];

export type SuggestedVariant = {
    total_quantity: number;
    usage_count: number;
    variant_id: string;
    variant_name: string;
};

export const suggestedVariantsOptions = (
    args: { maxResults?: number; search?: string; cardId: string },
) => queryOptions({
    queryKey: [
        "suggested-variants",
        args.maxResults ?? 8,
        (args.search ?? "").trim(),
    ],
    // TanStack v5 will pass { signal } here if the adapter supports it
    queryFn: async (): Promise<
        Partial<Variant> & Pick<Variant, "id" | "name">[]
    > => {
        const { data, error } = await supabase.rpc("most_used_variants", {
            p_limit: args.maxResults ?? 8,
            p_query: (args.search ?? "").trim(),
            p_card_id: args.cardId,
        }).order("usage_count", { ascending: false });
        if (error) throw error;
        return data.map((r) => ({
            id: r.variant_id,
            name: r.variant_name,
            card_id: args.cardId,
        }));
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
});

export function useSuggestedVariants(opts: {
    cardId: string;
    maxResults?: number;
    search?: string; // e.g. filter by card title (requires a title column in cards)
}) {
    const maxResults = opts?.maxResults ?? 8;
    const search = opts?.search?.trim() || "";
    const cardId = opts.cardId;

    return useQuery({
        ...suggestedVariantsOptions({ cardId, maxResults, search }),
        enabled: !!search, // keep hook idle when empty
    });
}
