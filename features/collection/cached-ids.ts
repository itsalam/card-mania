import { supabase } from "@/lib/store/client";
import { requireUser } from "@/lib/store/functions/helpers";
import { DefaultPageTypes } from "./provider";

// Cache resolved IDs per default page and track in-flight fetches
const cachedDefaultCollectionIds: Partial<
    Record<DefaultPageTypes, string | null | undefined>
> = {};
const loadingCachedDefaultCollectionIds: Partial<
    Record<DefaultPageTypes, Promise<string | null> | undefined>
> = {};

export async function getDefaultPageCollectionId(pageType: DefaultPageTypes) {
    const flagColumn: Record<DefaultPageTypes, string | null> = {
        default: null,
        wishlist: "is_wishlist",
        selling: "is_selling",
        vault: "is_vault",
    };

    // no backing collection id for the "default" page
    if (!flagColumn[pageType]) {
        cachedDefaultCollectionIds[pageType] = null;
        return null;
    }

    const cached = cachedDefaultCollectionIds[pageType];
    if (cached !== undefined) return cached;

    const loading = loadingCachedDefaultCollectionIds[pageType];
    if (loading) return loading;

    const user = requireUser();
    const fetchPromise: Promise<string | null> = user.then((user) =>
        supabase
            .from("collections")
            .select("id")
            .eq("user_id", user.id)
            .eq(flagColumn[pageType]!, true)
            .maybeSingle()
    ).then(({ data, error }) => {
        loadingCachedDefaultCollectionIds[pageType] = undefined;
        if (error) throw error;
        const value = data?.id ?? null;
        cachedDefaultCollectionIds[pageType] = value;
        return value;
    });

    loadingCachedDefaultCollectionIds[pageType] = fetchPromise;
    return fetchPromise;
}
