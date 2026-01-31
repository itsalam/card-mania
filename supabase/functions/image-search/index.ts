import { ImageItem, SerpImageResults } from "@types";
import {
  buildSerpQuery,
  CardKeyFields,
  cors,
  createSupabaseClient,
  createSupabaseServiceClient,
  json,
  ok,
} from "@utils";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const DEFAULT_LIMIT = 12;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!; // set via `supabase secrets set`
const supabase = createSupabaseServiceClient();

export function decodeCardKey(key: string): CardKeyFields & { v: number } {
  const raw = key.startsWith("ck:") ? key.slice(3) : key;
  const decoded = decodeURIComponent(raw);
  const trimmed = decoded.trim();
  const trimmedNoQuotes = trimmed.replace(/^['"`]|['"`]$/g, "");
  const obj = JSON.parse(trimmedNoQuotes);
  if (
    typeof obj?.set !== "string" ||
    typeof obj?.name !== "string" ||
    typeof obj?.year !== "number"
  ) {
    throw new Error("Invalid card key");
  }
  return obj;
}

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

async function sha256HexStr(s: string) {
  const enc = new TextEncoder().encode(s);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

type AuthCtx =
  | { kind: "service" }
  | { kind: "user"; user: import("@supabase/supabase-js").User }
  | { kind: "none" };

async function getAuthContext(req: Request): Promise<AuthCtx> {
  const bearer = req.headers.get("authorization") ?? "";
  const token = bearer.includes("Bearer ") ? bearer.slice(7) : "";

  if (!token) return { kind: "none" };
  if (token === SERVICE_ROLE) return { kind: "service" }; // server→server

  const sb = createSupabaseClient(req);

  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return { kind: "none" };
  return { kind: "user", user: data.user };
}

Deno.serve(async (req) => {
  const auth = await getAuthContext(req);

  // allow internal service calls
  if (auth.kind !== "service") {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": cors.origin,
        "Access-Control-Allow-Methods": cors.methods,
        "Access-Control-Allow-Headers": cors.headers,
      },
    });
  }
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const key = searchParams.get("key");
    const limit = Number(searchParams.get("limit") ?? `${DEFAULT_LIMIT}`);

    const serpBase = Deno.env.get("SERP_API_BASE")!;
    const serpKey = Deno.env.get("SERP_API_KEY")!;

    if (!serpKey) {
      console.error("Server misconfigured", { serpKey });
      return json({ error: "Server misconfigured" }, { status: 500 });
    }

    if (!q && !key) {
      console.error("Missing q or key");
      return json({ error: "Missing q or key" }, { status: 400 });
    }
    if (q && key) {
      console.error("Must use q or key");
      return json({ error: "Must use q or key" }, { status: 400 });
    }
    let query = q;
    if (key) {
      const cardKey = decodeCardKey(key);
      query = buildSerpQuery(cardKey);
    }

    const qNorm = normalize(query!);
    const qHash = await sha256HexStr(qNorm);
    const { data: cached } = await supabase
      .from("image_search_cache")
      .select("candidates, ttl_seconds, updated_at")
      .eq("query_hash", qHash)
      .maybeSingle();
    if (cached) {
      const fresh = Date.now() - new Date(cached.updated_at).getTime() <
        cached.ttl_seconds * 1000;
      if (fresh) {
        return ok(
          json({
            query: qNorm,
            candidates: String(cached.candidates).slice(0, limit),
          }),
        );
      }
    }

    const vendorUrl = `${serpBase}/search.json?engine=google_images&q=${
      encodeURIComponent(query!)
    }&api_key=${serpKey}`;
    const result = await fetch(vendorUrl, {
      headers: { accept: "application/json" },
    });
    if (!result.ok) {
      return Response.json({ error: `Vendor ${result.status}` }, {
        status: 502,
      });
    }

    const raw = await result.json();

    const baseItems =
      (raw.images_results ?? raw.results ?? []) as SerpImageResults[];
    // Normalize
    const items: ImageItem[] = baseItems.map((r) => ({
      id: crypto.randomUUID(),
      sourceUrl: r.original ?? r.thumbnail ?? r.link ??
        r.serpapi_related_content_link,
      width: r.original_width,
      height: r.original_height,
    }));

    const candidates = await filterViable(items, {
      max: limit,
      maxBytes: 512 * 1024,
    });

    // write-through query cache
    await supabase.from("image_search_cache").upsert({
      query_hash: qHash,
      query_norm: qNorm,
      candidates,
      top_url: candidates[0]?.sourceUrl ?? null,
      ttl_seconds: 7 * 24 * 3600,
      updated_at: new Date().toISOString(),
    });

    return ok(json({ query: qNorm, candidates }));
  } catch (e) {
    console.error("Image search error", e);
    return json({ error: String((e as Error).message || e) }, { status: 500 });
  }
});

async function filterViable(
  items: ImageItem[],
  opts: { max: number; maxBytes: number },
) {
  const out: Array<ImageItem & { contentType?: string; bytes?: number }> = [];
  for (const item of items) {
    if (!item.sourceUrl) continue;
    try {
      const res = await fetch(item.sourceUrl, {
        method: "GET",
        headers: { accept: "image/*" },
      });
      if (!res.ok) continue;
      const ct = res.headers.get("content-type") ?? undefined;
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.byteLength > opts.maxBytes) continue;
      out.push({ ...item, contentType: ct, bytes: buf.byteLength });
      if (out.length >= opts.max) break;
    } catch {
      continue;
    }
  }
  if (out.length === 0) throw new Error("No viable image found");
  return out;
}
