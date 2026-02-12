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
