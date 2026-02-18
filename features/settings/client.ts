import { invokeFx, useDebounced } from "@/client/helper";
import { getSupabase } from "@/lib/store/client";
import { Database, Json } from "@/lib/store/supabase";
import { QueryClient, queryOptions, useQuery } from "@tanstack/react-query";

export type UserProfile = Database["public"]["Tables"]["user_profile"]["Row"];

export const userPreferenceStorageKey = (userId: string) =>
    `remote-user-profile-preferences:${userId}`;

export const userProfileOptions = (
    userId?: string | null,
    queryClient?: QueryClient,
) => queryOptions({
    queryKey: ["user-profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Partial<UserProfile>> => {
        if (!userId) throw new Error("userId is required");
        // Refer to local storage first (for immediate/fallback preferences)

        const { data, error } = await getSupabase()
            .from("user_profile")
            .select("*")
            .eq("user_id", userId)
            .single();

        const profile = data as UserProfile;

        return {
            ...profile,
            preferences: profile.preferences ?? null,
        };
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
});

export function useUserProfile(
    userId?: string | null,
    queryClient?: QueryClient,
) {
    return useQuery(userProfileOptions(userId, queryClient));
}

export const mutation = async (
    opts: { userId?: string; patch: Record<string, unknown> },
) => {
    const { userId, patch } = opts;
    if (!userId) throw new Error("No user logged in");
    // write-through to local cache first for instant availability

    const { data, error } = await getSupabase()
        .from("user_profile")
        .upsert(
            {
                user_id: userId,
                preferences: patch as Json,
            },
            { onConflict: "user_id" },
        )
        .select("*")
        .single();

    if (error) throw error;
    return data;
};

type Location = {
    latitude: number;
    longitude: number;
};

export type CitySuggestion = {
    city: string | null;
    state: string | null;
    country: string | null;
    countryCode: string | null;
    viewport: {
        high: Location;
        low: Location;
    };
    placeId: string;
    slug: string;
} & Location;

export function newSessionToken() {
    // simple token (good enough); you can use uuid as well
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useCitySuggestions(query: string, sessionToken: string | null) {
    const debounced = useDebounced(query, 200);

    return useQuery<CitySuggestion[]>({
        queryKey: ["city-suggest", debounced, sessionToken],
        enabled: debounced.trim().length >= 2 && !!sessionToken,
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        placeholderData: (prev) => prev, // keep list stable while typing
        queryFn: async ({ signal }) => {
            const payload = { query: debounced, sessionToken };

            const res = await invokeFx<typeof payload, CitySuggestion[]>(
                "map-location",
                payload,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    useQueryParams: false,
                },
            );
            const { data, error } = res;
            if (error) throw error;
            return data;
        },
    });
}
