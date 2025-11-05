// collection-items/index.ts
import { createSupabaseClient, json, requireUser } from "@utils";

type UpsertPayload = {
  collection_id: string;
  items: Array<{
    ref_id: string;
    grade?: string;
    condition?: string;
    quantity_delta: number;
  }>;
};

Deno.serve(async (req) => {
  const userClient = createSupabaseClient(req);
  const user = await requireUser(userClient);

  if (req.method !== "POST") return json({ error: "method" }, { status: 405 });

  const body = await req.json().catch(() => ({})) as UpsertPayload;
  if (!body.collection_id || !Array.isArray(body.items)) {
    return json({ error: "collection_id and items required" }, { status: 400 });
  }

  // Hit SECURITY DEFINER for atomic bulk upsert
  const { error } = await userClient.rpc("upsert_collection_items", {
    p_owner: user.id,
    p_collection_id: body.collection_id,
    p_items: body.items,
  });

  if (error) return json({ error: error.message }, { status: 400 });
  return json({ ok: true });
});
