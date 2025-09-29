import { fetchImageStrict } from "@image-fetch";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Candidate, CardImageFields } from "@types";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { Database } from "./supabase.d.ts";

export const fetchGlobalVars = () => {
  const ttlSec = Number(Deno.env.get("CACHE_TTL_SECONDS") ?? "21600"); // 6h
  const supa = Deno.env.get("SUPABASE_URL")!;
  const srole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return { ttlSec, supa, srole };
};

export const createSupabaseClient = (req: Request) => {
  const supa = Deno.env.get("SUPABASE_URL")!;
  const srole = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient<Database>(supa, srole, {
    global: {
      headers: {
        Authorization: req.headers.get("Authorization")!,
      },
    },
  });
};

export const createSupabaseServiceClient = () => {
  const supa = Deno.env.get("SUPABASE_URL")!;
  const srole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient<Database>(supa, srole);
};

export const fetchFromCache = async (
  { srole, url }: { srole: string; url: string },
) => {
  const check = await fetch(url, {
    headers: { apikey: srole, authorization: `Bearer ${srole}` },
  });
  if (check.ok) {
    const rows = (await check.json()) as any[];
    const hit = rows[0];
    if (hit && new Date(hit.expires_at).getTime() > Date.now()) {
      return ok(
        json(
          { cacheHit: true, ...hit.payload },
          {
            headers: {
              "Access-Control-Allow-Origin": cors.origin,
              "cache-control": "public, max-age=300",
            },
          },
        ),
      );
    }
  }
};

export const upsertCache = async ({
  cacheKey,
  url,
  body,
}: {
  cacheKey: string;
  body: Object;
  url: string;
}) => {
  const { ttlSec, srole } = fetchGlobalVars();
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: srole,
      authorization: `Bearer ${srole}`,
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ key: cacheKey, data: body, expires_at: expiresAt }),
  });
};

export const json = (v: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(v), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });

export const cors = {
  origin: "*",
  headers: "authorization,content-type",
  methods: "GET,OPTIONS",
};

export function ok(res: Response, cacheSeconds = 600) {
  const h = new Headers(res.headers);
  h.set("Access-Control-Allow-Origin", cors.origin);
  h.set("Cache-Control", `public, max-age=${cacheSeconds}`);
  return new Response(res.body, { status: res.status, headers: h });
}

export async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function extFromContentType(ct: string | null): string | null {
  if (!ct) return null;
  if (ct.includes("jpeg")) return "jpg";
  if (ct.includes("png")) return "png";
  if (ct.includes("webp")) return "webp";
  if (ct.includes("gif")) return "gif";
  if (ct.includes("svg")) return "svg";
  if (ct.includes("avif")) return "avif";
  if (ct.includes("tiff")) return "tiff";
  if (ct.includes("bmp")) return "bmp";
  if (ct.includes("ico")) return "ico";
  if (ct.includes("heic")) return "heic";
  return null;
}

export async function keyFor(src: string) {
  // normalize URL (strip utm, sort params, etc.) before hashing in your impl
  const u = new URL(src);
  u.searchParams.sort();
  const enc = new TextEncoder().encode(u.toString());
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc))]
    .map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalize(q: string) {
  return q.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function sha256HexStr(s: string) {
  const enc = new TextEncoder().encode(s);
  const dig = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(dig)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export type CardKeyFields = { set: string; name: string; year: number };

type BuildSerpQueryOptions = {
  includeNegatives: boolean;
  extraContext: string[];
};

export function buildSerpQuery(
  f: Partial<CardKeyFields>,
  options: BuildSerpQueryOptions = { includeNegatives: true, extraContext: [] },
): string {
  const parts: string[] = [];
  const qstr = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim();

  if (f.year) parts.push(String(f.year));
  if (f.set) parts.push(`"${qstr(f.set)}"`);
  if (f.name) parts.push(`"${qstr(f.name)}"`);

  // context tokens that help Google lock onto actual cards
  parts.push('"trading card"');

  // light negatives to reduce non-card assets
  if (options?.includeNegatives) {
    const negatives = [
      "-poster",
      "-tshirt",
      "-lego",
      "-funko",
      "-custom",
      "-fanart",
      "-logo",
      "-vector",
      "-mockup",
      "-site:pinterest.com",
      "-site:alamy.com",
      "-site:redbubble.com",
      "-site:facebook.com",
    ];
    parts.push(...negatives);
  }

  if (options?.extraContext) {
    parts.push(...options.extraContext);
  }

  return parts.join(" ");
}

// RFC 4122 UUIDv5 (SHA-1) using Web Crypto – no deps
export function hex(b: ArrayBuffer) {
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function bytesFromHex(h: string) {
  return new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)));
}

// Keep a per-vendor namespace UUID constant (generate once and hardcode)

export async function uuidv5(namespace: string, name: string) {
  const ns = bytesFromHex(namespace.replace(/-/g, ""));
  const enc = new TextEncoder().encode(name);
  const data = new Uint8Array(ns.length + enc.length);
  data.set(ns, 0);
  data.set(enc, ns.length);

  const sha1 = await crypto.subtle.digest("SHA-1", data);
  const a = new Uint8Array(sha1);

  // Set version and variant bits
  a[6] = (a[6] & 0x0f) | 0x50; // version 5
  a[8] = (a[8] & 0x3f) | 0x80; // RFC 4122 variant

  const h = hex(a.buffer);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${
    h.slice(16, 20)
  }-${h.slice(20, 32)}`;
}

export function vendorUUID(
  provider: string,
  externalId: string | number,
  seed = Deno.env.get("UUID_SEED")!,
) {
  const prov = provider.toLowerCase().trim();
  const id = String(externalId).trim();
  return uuidv5(seed, `${prov}:${id}`);
}

export async function commitCacheFromUrl(
  url: string,
  supabase: SupabaseClient<Database>,
  imageCacheFields?: Partial<
    Database["public"]["Tables"]["image_cache"]["Update"]
  >,
) {
  // 1) fetch via imageproxy (recommended) to get normalized bytes + final mime
  const { ttlSec } = fetchGlobalVars();
  const res = await fetchImageStrict(url);
  if (!res.ok) {
    console.debug(res);
    throw new Error(`Fetch failed ${res.statusText} ${res.status}`);
  }

  const { error: checkBucketError } = await supabase
    .storage
    .getBucket("images");
  if (checkBucketError) {
    await supabase
      .storage
      .createBucket("images", {
        public: true,
        allowedMimeTypes: ["image/*"],
        fileSizeLimit: 1024 * 1024 * 10, // 10MB
      });
  }

  const ct = res.headers.get("content-type") ?? "application/octet-stream";
  const buf = new Uint8Array(await res.arrayBuffer());
  const urlHash = await sha256HexStr(url);
  // If your imageproxy can return a canonical content hash header, use that instead:
  const contentSha = hex(await crypto.subtle.digest("SHA-256", buf.buffer));

  const ext = ct.includes("png")
    ? "png"
    : ct.includes("webp")
    ? "webp"
    : (ct.includes("jpeg") || ct.includes("jpg"))
    ? "jpg"
    : "bin";
  const storagePath = `original/${contentSha.slice(0, 2)}/${contentSha}.${ext}`;

  // Upload (idempotent)
  const up = await supabase.storage.from("images")
    .upload(storagePath, buf, { upsert: true, contentType: ct });
  if (up.error) {
    console.error("Error uploading image to storage", url);
    throw up.error;
  }

  // 2) upsert into image_cache idempotently
  const { data: existingByContent } = await supabase
    .from("image_cache").select("id").eq("content_sha256", contentSha)
    .maybeSingle();

  const imageId: string | undefined = existingByContent?.id;

  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
  const { data: imageCacheRecord, error: imageCacheError } = await supabase
    .from("image_cache")
    .upsert({
      ...imageCacheFields,
      id: imageId,
      source_url: url,
      url_hash: urlHash,
      content_sha256: contentSha,
      expires_at: expiresAt,
      storage_path: storagePath,
      status: "READY",
      mime: ct,
    }, {
      onConflict: "id",
    })
    .select().single();
  if (imageCacheError) {
    throw `Error upserting image cache ${imageCacheError}`;
  }

  return imageCacheRecord;
}

export const commitCacheFromQueryHash = async (
  query_hash: string,
  sample: number,
  supabase: SupabaseClient<Database> = createSupabaseServiceClient(),
) => {
  const { data: row, error } = await supabase
    .from("image_search_cache")
    .select("candidates, top_url")
    .eq("query_hash", query_hash)
    .maybeSingle();

  if (error) {
    console.error("Error fetching row", error);
    throw error;
  }

  const candidates = (row?.candidates ?? []) as Candidate[];
  const urls = (candidates?.map((c: Candidate) => c.sourceUrl) ?? [])
    .filter(Boolean) as string[];
  if (row?.top_url) urls.unshift(row.top_url);

  let hasCommitted = false;
  const commits = await Promise.allSettled(
    [...new Set(urls)].map(async (url, i) => {
      try {
        if (hasCommitted || i >= sample) return;
        const imageCacheRecord = await commitCacheFromUrl(url, supabase, {
          query_hash,
          is_top_for_query: i === 0,
        });
        hasCommitted = true;
        return imageCacheRecord;
      } catch (e) {
        console.error("Error committing url", url, e);
      }
    }),
  );
  return commits;
};

export type ImageCacheRow = Database["public"]["Tables"]["image_cache"]["Row"];

export const commitCardImageFromCacheUpsert = (
  cardFields: Partial<CardImageFields> & { card_id: string; kind: string },
  cacheCommits: PromiseSettledResult<ImageCacheRow | undefined>[],
  supabase: SupabaseClient<Database>,
) => {
  const successfulCommit = cacheCommits.find((c) =>
    c.status === "fulfilled"
  ) as PromiseFulfilledResult<
    ImageCacheRow
  >;

  if (successfulCommit?.value) {
    const imageCacheRecord = successfulCommit.value;
    console.log(
      "Upserting card image",
      cardFields.card_id,
      imageCacheRecord.id,
    );
    return supabase.from("card_images").upsert({
      ...cardFields,
      image_cache_id: imageCacheRecord.id,
      source_url: imageCacheRecord.source_url,
      storage_path: imageCacheRecord.storage_path,
      status: "READY",
      content_type: imageCacheRecord.content_type,
    }, { onConflict: "card_id, image_cache_id" });
  } else {
    console.log("No successful commit found", cacheCommits);
    return { error: new Error("No successful commit found") };
  }
};

export const getImageCacheFromQueryHash = async (
  queryHash: string,
  supabase: SupabaseClient<Database>,
) => {
  console.debug("Serving by query hash:", queryHash);
  let ic: ImageCacheRow | null = null;
  const icPreFetchRes = await supabase
    .from("image_cache")
    .select("*")
    .eq("query_hash", queryHash)
    .order("is_top_for_query", { ascending: false })
    .order("created_at", { ascending: false })
    .maybeSingle().then(({ data, error }) => {
      if (error) {
        console.debug("Prefetched image cache not found", error);
      }
      return data;
    });
  const iscRes = await supabase
    .from("image_search_cache")
    .select("top_url, candidates")
    .eq("query_hash", queryHash)
    .maybeSingle().then(({ data, error }) => {
      if (error) {
        console.debug("Image search cache not found", error);
        throw error;
      }
      return data;
    });
  const [icPreFetch, isc] = await Promise.all([icPreFetchRes, iscRes]);
  ic = icPreFetch;
  const candidates = isc?.candidates as Candidate[];
  const topUrl = isc?.top_url ??
    (Array.isArray(candidates) ? candidates[0]?.sourceUrl : null);
  if (!ic && topUrl) {
    const urlHash = await sha256HexStr(topUrl);
    console.debug("Found top URL:", topUrl, "Using url hash:", urlHash);
    const { data } = await supabase
      .from("image_cache")
      .select("*")
      .eq("url_hash", urlHash)
      .maybeSingle();
    console.log("Found image cache:", { urlHash, data });
    ic = data;
  }
  return { ic, isc };
};
