// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { Database } from "@schema";
import { createClient } from "@supabase/supabase-js";
import {
  commitCacheFromQueryHash,
  commitCardImageFromCacheUpsert,
} from "@utils";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// --- config
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const HOT_THRESHOLD = Number(Deno.env.get("IMAGE_HOT_THRESHOLD") ?? "20");
const COOLOFF_HOURS = Number(
  Deno.env.get("IMAGE_COMMIT_COOLOFF_HOURS") ?? "24",
);
const MAX_BATCH = Number(Deno.env.get("IMAGE_COMMIT_MAX_BATCH") ?? "50");
const DEFAULT_SAMPLE = Number(Deno.env.get("IMAGE_COMMIT_SAMPLE") ?? "1");

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE);

function logAuthInfo(req: Request) {
  const authHeader = req.headers.get("authorization");
  console.log("Auth header present:", !!authHeader);
  if (authHeader) {
    console.log(
      "Auth header starts with:",
      authHeader.substring(0, 15) + "...",
    );
  }
}

async function readJson<T extends Record<string, unknown>>(
  req: Request,
): Promise<T> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    // try best-effort parse, but don't crash
    const txt = await req.text();
    try {
      return txt ? JSON.parse(txt) : {};
    } catch {
      return {} as T;
    }
  }
  try {
    return await req.json();
  } catch {
    return {} as T;
  }
}

Deno.serve(async (req) => {
  try {
    logAuthInfo(req);
    const body = await readJson<
      {
        query_hash: string;
        sample: number;
        card_id: string;
        type: string;
        hashes: string[];
      }
    >(req);
    const { card_id, kind } = { kind: "front", ...body };
    const query_hash = body?.query_hash?.trim();
    const sample = Math.max(1, Number(body?.sample ?? DEFAULT_SAMPLE));
    if (
      typeof query_hash === "string" && query_hash
    ) {
      const cacheCommits = await commitCacheFromQueryHash(
        query_hash,
        sample,
      );
      console.log("Committed images", cacheCommits);
      const cardImagePromise = await commitCardImageFromCacheUpsert(
        { card_id, kind },
        cacheCommits,
        supabase,
      );

      const commitUpdatedPromise = getSupabase().from("search_queries")
        .update({ committed_at: new Date().toISOString() })
        .eq("query_hash", query_hash).select().maybeSingle();

      const promises = await Promise.all([
        cardImagePromise,
        commitUpdatedPromise,
      ]);

      promises.forEach((p) => {
        if (p.error) {
          console.error("Error committing images", p.error);
        }
      });

      return new Response(JSON.stringify({ ok: true, mode: "one", count: 1 }), {
        status: 202,
        headers: { "content-type": "application/json" },
      });
    }

    if (Array.isArray(body?.hashes) && body.hashes.length) {
      const hashes = [...new Set(body.hashes)].slice(0, MAX_BATCH);

      const hashPromises = hashes.map(async (h) => {
        const cacheCommits = await commitCacheFromQueryHash(String(h), sample);
        return commitCardImageFromCacheUpsert(
          { card_id, kind },
          cacheCommits,
          supabase,
        );
      });
      await Promise.all(hashPromises);
      return new Response(
        JSON.stringify({ ok: true, mode: "batch", count: hashes.length }),
        {
          status: 202,
          headers: { "content-type": "application/json" },
        },
      );
    }

    const { data: hotRows, error: hotErr } = await supabase
      .from("search_queries")
      .select("query_hash, hits, committed_at, last_seen")
      .gte("hits", HOT_THRESHOLD)
      .or(
        `committed_at.is.null,committed_at.lt.${
          new Date(Date.now() - COOLOFF_HOURS * 3600 * 1000).toISOString()
        }`,
      )
      .order("last_seen", { ascending: false })
      .limit(MAX_BATCH);

    if (hotErr) throw hotErr;

    const targets = (hotRows ?? []).map((r) => r.query_hash);
    for (const h of targets) await commitCacheFromQueryHash(h, sample);

    return new Response(
      JSON.stringify({ ok: true, mode: "pull", count: targets.length }),
      {
        status: 202,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    console.error("image-commit-from-query error:", error?.message || error);
    return new Response(
      JSON.stringify({
        error: "Internal",
        message: String(error?.message ?? error),
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
});
