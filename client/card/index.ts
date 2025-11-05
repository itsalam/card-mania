import { TCard } from "@/constants/types";
import { useCardStore } from "@/lib/store/provider"; // your useStores()
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { invokeFx } from "../helper";
import { CardRequest, CardResponse, TCardRes } from "./types";

// tune defaults here
const DEFAULT_TTL = 5 * 60_000; // 5 minutes

type UseCardQueryOpts = {
    ttl?: number; // staleness threshold for store entry
    enabled?: boolean; // allow disabling fetches
    queryOptions?: Parameters<
        typeof useQuery<
            TCardRes & { status?: number },
            Error,
            TCard | undefined
        >
    >[0]; // to pass extra RQ opts
};

export function useCardQuery(
    cardId?: string,
    cardHints: Partial<TCard> = {},
    opts: UseCardQueryOpts = {},
) {
    const ttl = opts.ttl ?? DEFAULT_TTL;
    const enabled = opts.enabled ?? true;

    const { entry, setCard } = useCardStore(
        (s) => ({
            entry: cardId ? s.cards[cardId] : undefined,
            setCard: (s as any).setCard, // if you added the action; else undefined
        }),
    );

    // compute staleness
    const isStale = useMemo(() => {
        const t = entry?.updatedAt;
        return t ? Date.now() - t > ttl : true; // missing data => stale
    }, [entry?.updatedAt, ttl]);

    // keep previous UI while fetching new (even when key changes)
    const query = useQuery<
        TCardRes & { status?: number },
        Error,
        TCard | undefined
    >({
        queryKey: ["card", cardId],
        enabled: Boolean(enabled && !!cardId && isStale), // only fetch when missing/stale
        queryFn: async () => {
            if (!cardId) throw new Error("cardId is required");
            const payload = CardRequest.parse({
                card_id: cardId,
                card_hints: { ...cardHints, ...entry?.prefetchData },
                populate: true,
            });
            const { data, response } = await invokeFx<typeof payload, TCardRes>(
                "fetch-card",
                payload,
                { parseOut: CardResponse, useQueryParams: true },
            );

            return { data: data?.data, status: response?.status ?? 200 };
        },
        select: (res) => (res.status === 206 ? undefined : res.data),
        // show prior data while refetching
        placeholderData: keepPreviousData,
        retry: (failureCount, err) => true,
        ...(opts.queryOptions ?? {}),
    });

    useEffect(() => {
        if (!query.isSuccess) return;
        if (!cardId) return;
        if (query.data) {
            setCard(cardId, query.data);
        }
    }, [query.dataUpdatedAt]); // ← updates only when cache data actually changes

    // Single source of truth for what to render:
    const data = useMemo(
        () =>
            query.data ?? entry?.data ??
                entry?.prefetchData as TCard | undefined,
        [query.data, entry?.data, entry?.prefetchData],
    );
    const loading = Boolean(query.isFetching || entry?.loading);
    const error = query.error
        ? String((query.error as any)?.message ?? query.error)
        : entry?.error;

    return {
        data,
        loading,
        error,
        isStale,
        refetch: query.refetch,
        query, // expose full react-query object if you need it
        entry, // expose raw store entry if you need it
    };
}
