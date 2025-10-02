// =========================
// RECENT VIEWS (uses RPC: touch_recent_view)
// =========================

import { supabase } from "../client";
import { Database } from "../supabase";
import { requireUser, unwrap } from "./helpers";
import { ViewTarget } from "./types";

/** Touch/update a recent view for the current user */
export async function touchRecentView(params: {
  targetType: ViewTarget;
  targetId: string;
  source?: string | null;
  ctx?: Record<string, unknown>;
}) {
  const user = await requireUser(); // ensures auth; RPC uses auth.uid()
  const { error } = await supabase.rpc("touch_recent_view", {
    p_user_id: user.id,
    p_item_type: params.targetType,
    p_item_id: params.targetId,
  });
  if (error) throw error;
  return true;
}

/** Fetch the latest N recent views for the current user */
export async function listMyRecentViews(limit = 25) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("recent_views")
    .select("*")
    .eq("user_id", user.id)
    .order("viewed_at", { ascending: false })
    .limit(limit);
  return unwrap<Database["public"]["Tables"]["recent_views"]["Row"][]>(
    data,
    error,
  );
}
