import {
  DEBUG,
  logErr,
  logInfo,
  logWarn,
  maskPlaceId,
  msSince,
  rid,
  safeLen,
} from "@utils";

Deno.serve(async (req: Request) => {
  const _rid = rid();
  const start = Date.now();
  logInfo(_rid, "request:received", {
    method: req.method,
    contentType: req.headers.get("content-type"),
    contentLength: req.headers.get("content-length"),
  });
  // Basic request metadata
  logInfo(_rid, "request:start", {
    method: req.method,
    url: new URL(req.url).pathname,
    ua: req.headers.get("user-agent") ?? undefined,
    // do NOT log authorization header/body
  });

  // Method guard (optional but useful)
  if (req.method !== "POST") {
    logWarn(_rid, "request:bad_method", { method: req.method });
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Parse JSON body safely
    let body: any;
    let text: any;
    try {
      text = await req.text();
      body = JSON.parse(text);
    } catch (e) {
      logWarn(_rid, `request:invalid_json: ${e}`, {
        elapsedMs: msSince(start),
        text,
        body,
      });

      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        statusText: "Invalid JSON body",
        headers: { "Content-Type": "application/json" },
      });
    }

    const query = body?.query;
    const sessionToken = body?.sessionToken;

    if (DEBUG) {
      logInfo(_rid, "request:body_parsed", {
        queryLen: safeLen(query),
        hasSessionToken: typeof sessionToken === "string" &&
          sessionToken.length > 0,
      });
    }

    if (!query || typeof query !== "string" || query.length < 2) {
      logWarn(_rid, "validation:query_too_short", {
        queryLen: safeLen(query),
        elapsedMs: msSince(start),
      });
      return new Response(JSON.stringify({ error: "Query too short" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      logErr(_rid, "config:missing_google_places_api_key", {
        elapsedMs: msSince(start),
      });
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 1) Autocomplete (cities only)
    const autoUrl = `https://places.googleapis.com/v1/places:autocomplete?` +
      new URLSearchParams({
        key: apiKey, // never log this
      });

    const autoStart = Date.now();
    if (DEBUG) {
      logInfo(_rid, "google:autocomplete:fetch_start", {
        queryLen: query.length,
      });
    }

    const autoRes = await fetch(autoUrl, {
      method: "POST",
      body: JSON.stringify({
        input: query,
        includedPrimaryTypes: "(cities)",
        sessionToken,
      }),
    });
    const autoText = await autoRes.text(); // read as text so we can log snippets on errors
    const autoElapsed = Date.now() - autoStart;

    if (!autoRes.ok) {
      logErr(_rid, "google:autocomplete:bad_status", {
        status: autoRes.status,
        elapsedMs: autoElapsed,
        // log only a short snippet to avoid leaking anything unexpected
        bodySnippet: autoText.slice(0, 200),
      });
      return new Response(JSON.stringify({ error: "Autocomplete failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    let autoData: any;
    try {
      autoData = JSON.parse(autoText);
    } catch {
      logErr(_rid, "google:autocomplete:invalid_json", {
        elapsedMs: autoElapsed,
        bodySnippet: autoText.slice(0, 200),
      });
      return new Response(
        JSON.stringify({ error: "Autocomplete parse error" }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const predictions = autoData?.suggestions ?? [];
    if (DEBUG) {
      logInfo(_rid, "google:autocomplete:success", {
        status: autoData?.status,
        predictionCount: predictions.length,
        elapsedMs: autoElapsed,
      });
    }

    if (!predictions.length) {
      logInfo(_rid, "response:empty", { elapsedMs: msSince(start) });
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2) Details for first 5 predictions
    const top = predictions.slice(0, 5);
    if (DEBUG) {
      logInfo(_rid, "google:details:batch_start", {
        count: top.length,
        placeIds: top.map((p: any) => maskPlaceId(p?.place_id)),
      });
    }

    const resultsStart = Date.now();
    const results = await Promise.all(
      top.map(async (prediction: any, idx: number) => {
        const placeId = prediction?.placePrediction?.placeId as
          | string
          | undefined;

        if (!placeId) {
          logWarn(_rid, "google:details:missing_place_id", { idx, prediction });
          return null;
        }

        const detailsUrl =
          `https://places.googleapis.com/v1/places/${placeId}?` +
          new URLSearchParams({
            fields: "addressComponents,location,viewport",
            key: apiKey, // never log this
            sessionToken,
          });

        const dStart = Date.now();
        if (DEBUG) {
          logInfo(_rid, "google:details:fetch_start", {
            idx,
            placeId: maskPlaceId(placeId),
          });
        }

        const detailsRes = await fetch(detailsUrl);
        const detailsText = await detailsRes.text();
        const dElapsed = Date.now() - dStart;

        if (!detailsRes.ok) {
          logErr(_rid, "google:details:bad_status", {
            idx,
            status: detailsRes.status,
            elapsedMs: dElapsed,
            placeId: maskPlaceId(placeId),
            bodySnippet: detailsText.slice(0, 200),
          });
          return null;
        }

        let detailsData: any;
        try {
          detailsData = JSON.parse(detailsText);
        } catch {
          logErr(_rid, "google:details:invalid_json", {
            idx,
            elapsedMs: dElapsed,
            placeId: maskPlaceId(placeId),
            bodySnippet: detailsText.slice(0, 200),
          });
          return null;
        }

        const components = detailsData?.addressComponents ?? [];
        const geometry = detailsData?.location;
        const viewport = detailsData?.viewport;

        const get = (type: string) =>
          components.find((c: any) => c.types?.includes(type))?.longText;

        const getShort = (type: string) =>
          components.find((c: any) => c.types?.includes(type))?.shortText;

        const city = get("locality") ?? get("postal_town") ?? null;
        const state = get("administrative_area_level_1") ?? null;
        const country = get("country") ?? null;
        const countryCode = getShort("country") ?? null;

        if (
          !geometry || typeof geometry.latitude !== "number" ||
          typeof geometry.longitude !== "number"
        ) {
          logWarn(_rid, "google:details:missing_geometry", {
            idx,
            placeId: maskPlaceId(placeId),
            elapsedMs: dElapsed,
            geometry,
          });
          return null;
        }

        if (DEBUG) {
          logInfo(_rid, "google:details:success", {
            idx,
            placeId: maskPlaceId(placeId),
            elapsedMs: dElapsed,
            hasCity: !!city,
            hasCountry: !!country,
          });
        }

        return {
          city,
          state,
          country,
          countryCode,
          latitude: geometry.latitude,
          longitude: geometry.longitude,
          viewport,
          placeId,
          slug: `${city ?? "unknown"}-${countryCode ?? "xx"}`.toLowerCase(),
        };
      }),
    );

    const filtered = results.filter(Boolean);
    const totalElapsed = msSince(start);

    logInfo(_rid, "response:success", {
      resultCount: filtered.length,
      elapsedMs: totalElapsed,
      autocompleteMs: undefined, // kept separate above
      detailsBatchMs: Date.now() - resultsStart,
    });

    return new Response(JSON.stringify(filtered), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    logErr(_rid, "handler:exception", {
      elapsedMs: msSince(start),
      // Deno error objects can be weird; stringify defensively
      error: err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : String(err),
    });

    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (DEBUG) logInfo(_rid, "request:end", { elapsedMs: msSince(start) });
  }
});
