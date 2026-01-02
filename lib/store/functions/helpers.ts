import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../client";

// Small helper to ensure the user is logged in
export async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("Not authenticated");
  return user;
}

export function unwrap<T>(data: T | null, error: PostgrestError | null): T {
  if (error) throw error;
  if (data == null) throw new Error("Not found");
  return data;
}

export enum WishlistKey {
  Default = "wishlist",
  View = "wishlist/view",
  Totals = "wishlist/totals",
}

export const qk = {
  me: ["me"] as const,
  card: (cardId: string) => ["card", cardId] as const,
  profile: ["profile"] as const,
  collections: ["collections"] as const,
  userCollections: ["collections", "me"] as const,
  collectionForCard: (cardId: string, userId?: string) =>
    ["collections", "card", userId ?? "me", cardId] as const,
  collectionItems: (id: string) => ["collections", id, "items"] as const,
  recent: ["recent", "me"] as const,
  wishlist: (kind: string) => [
    WishlistKey.Default,
    kind,
  ],
  userCards: (userId?: string) => ["user", userId ?? "me", "cards"] as const,
};
