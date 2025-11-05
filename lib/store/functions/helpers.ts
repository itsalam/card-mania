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

export const qk = {
  me: ["me"] as const,
  profile: ["profile"] as const,
  collections: ["collections", "me"] as const,
  collectionForCard: (cardId: string) =>
    ["collections", "card", cardId] as const,
  collectionItems: (id: string) => ["collections", id, "items"] as const,
  recent: ["recent", "me"] as const,
};
