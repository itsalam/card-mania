// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { createSupabaseClient } from "@utils";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const json = (v: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(v), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });

Deno.serve(async (req) => {
  const { mock_data, grade, card_id } = await req.json();
  const supabase = createSupabaseClient(req);

  if (mock_data) {
    const { end_cost } = mock_data; // make sure grade is available
    if (!end_cost) {
      json({ priceData: null });
    }
    const days = 90;

    const MS_DAY = 86_400_000;
    const startOfUTCDay = (ts: number) => {
      const d = new Date(ts);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); // ms
    };

    // last point is "today" at UTC midnight
    const endMs = startOfUTCDay(Date.now());
    const startMs = endMs - (days - 1) * MS_DAY;

    // trend toward end_cost with some noise
    const startCost = end_cost * 0.8 + Math.random() * end_cost * 0.4;
    const priceData = Array.from({ length: days }, (_, i) => {
      const t = startMs + i * MS_DAY; // epoch ms at UTC midnight
      const progress = i / (days - 1);
      const trend = startCost + (end_cost - startCost) * progress;
      const variation = trend * 0.1;
      const price = i === days - 1
        ? end_cost
        : trend + (Math.random() * 2 - 1) * variation;

      return {
        date: t, // <-- epoch ms (UTC midnight)
        [grade]: Math.max(0, Math.round(price)),
      };
    });

    return json(priceData);
  }

  return new Response(
    null,
    { headers: { "Content-Type": "application/json" } },
  );
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/price-fetch' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
