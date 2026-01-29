// =========================
// PROFILES
// =========================

import { requireUser, unwrap } from "./helpers";
import { ProfileRow, ProfileUpdate } from "./types";

/** Get the current user's profile row */
export async function getMyProfile() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

/** Upsert the current user's profile (owner-only via RLS) */
export async function upsertMyProfile(update: ProfileUpdate) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, ...update }, { onConflict: "user_id" })
    .select()
    .single();
  return unwrap(data as ProfileRow, error);
}
