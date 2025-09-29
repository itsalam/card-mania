// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import { Database, TablesInsert } from "@schema";
import { SupabaseClient } from "@supabase/supabase-js";
import { CardImageFields } from "@types";
import {
  buildSerpQuery,
  createSupabaseClient,
  createSupabaseServiceClient,
  getImageCacheFromQueryHash,
  ImageCacheRow,
  normalize,
  sha256HexStr,
} from "@utils";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type Image = {
  query_hash: string;
  url: string | null;
  kind: "bound" | "candidate";
};

Deno.serve(async (req) => {
  // Step 1: Get the card ID from the request
  const { searchParams } = new URL(req.url);
  const populate = searchParams.get("populate") === "true";
  const card_id = searchParams.get("card_id");
  const card_hints = searchParams.get("card_hints");

  const supabase = createSupabaseServiceClient();
  const supabaseUser = createSupabaseClient(req);

  // Step 2: Get the card data from the database

  let fetchedCard;
  if (card_id) {
    EdgeRuntime.waitUntil(
      supabaseUser.auth.getUser().then(({ data }) => {
        const { user } = data;
        const userId = user?.id;
        if (!userId) {
          throw new Error("User not found");
        }
        return supabase.rpc("touch_recent_view", {
          p_user_id: userId,
          p_item_type: "card",
          p_item_id: card_id,
          p_meta: { source: "detail_api" },
        });
      }).then(() => {
        console.log("Recent view touched");
      }).catch((error) => {
        console.error("Error touching recent view", error);
      }),
    );

    const fetchCardReq = await supabase.from("cards").select("*").eq(
      "id",
      card_id,
    )
      .single();
    fetchedCard = fetchCardReq.data;
  }

  if (!fetchedCard) {
    if (populate) {
      console.debug("Populating card", { card_hints });

      EdgeRuntime.waitUntil(
        commitCard(
          JSON.parse(card_hints ?? "{}") as Card & { image: Image },
          supabase,
        ),
      );
      return new Response(
        JSON.stringify({
          message: "Card not found, populating for next fetch",
        }),
        { status: 206 },
      );
    }
    return new Response(JSON.stringify({ error: "Card not found" }), {
      status: 500,
    });
  }

  return new Response(
    JSON.stringify({ data: fetchedCard }),
    { headers: { "Content-Type": "application/json" } },
  );
});

async function commitCard(
  cardLike: Partial<Card> & { image: Image },
  supabase: SupabaseClient<Database>,
) {
  const { image, ...cardData } = cardLike;

  const cleanCardData = Object.fromEntries(
    Object.entries(cardData).filter(([_, value]) => value != null),
  ) as Partial<Card>;

  const cardInsertRecord = {
    id: cardLike.id,
    name: cleanCardData.name || "",
    genre: cleanCardData.genre || "",
    set_name: cleanCardData.set_name || "",
    latest_price: cleanCardData.latest_price || null,
    grades_prices: cleanCardData.grades_prices || {},
    last_updated: new Date().toISOString(),
    // do not set images here; handled below
  } satisfies TablesInsert<"cards">;

  const cardInsert = await supabase.from("cards").insert(cardInsertRecord)
    .select("*").single();
  if (cardInsert.error) {
    console.error("Error inserting card", cardInsert.error);
    return null;
  }

  let promises: Promise<unknown>[] = [];
  const cardRecord = cardInsert.data;
  const cardId = cardLike.id || cardRecord?.id;
  if (image && image.query_hash && cardId) {
    const frontCardImageWiring = getImageCacheFromQueryHash(
      image.query_hash,
      supabase,
    )
      .then(({ ic }) => {
        if (ic) {
          return insertCardImageFromCache(
            cardId,
            ic,
            { kind: "front" },
            supabase,
          ).select().maybeSingle().then(({ data, error }) => {
            if (error) {
              console.error("Error inserting card image", error);
            }
            return data;
          });
        }
        console.error("No image cache found for query hash", image.query_hash);
      }).then((value) => {
        if (value) {
          supabase.from("cards").update({
            front_image_id: value.id,
          }).eq("id", cardId);
        }
      });
    promises.push(frontCardImageWiring);
  } else {
    console.log(
      "No image query hash found, populating front image, for next fetch",
    );
    const populateFront = populateCardImages(cardRecord, supabase, ["front"]);
    promises.push(populateFront);
  }

  promises.push(populateCardImages(cardRecord, supabase, ["back"]));

  await Promise.all(promises);

  return cardInsert;
}

const insertCardImageFromCache = (
  cardId: string,
  ic: ImageCacheRow,
  ci: Partial<CardImageFields>,
  supabase: SupabaseClient<Database>,
) => {
  return supabase.from("card_images").insert({
    card_id: cardId,
    image_cache_id: ic.id,
    status: "READY",
    width: ic.width,
    height: ic.height,
    source_url: ic.source_url,
    url_hash: ic.url_hash,
    content_type: ic.content_type || ic.mime,
    storage_path: ic.storage_path,
    is_primary: true,
    ...ci,
  });
};

const populateCardImages = async (
  card: Card,
  supabase: SupabaseClient<Database>,
  context: string[],
) => {
  const backImage = buildSerpQuery({
    name: card.name,
    set: card.set_name,
    year: card.release_date ? parseInt(card.release_date) : undefined,
  }, { includeNegatives: true, extraContext: context });

  const qNorm = normalize(backImage);
  const qHash = await sha256HexStr(qNorm);

  const backImageCommit = await supabase.functions.invoke("image-commit", {
    method: "POST",
    body: { query_hash: qHash, card_fields: card },
  }).catch((e) => {
    console.error("Image commit failed:", e);
  }) as { data: { commits: ImageCacheRow[] } };
  console.debug("Back image commit", backImageCommit);
  const imageCommitUpdateResults = backImageCommit?.data?.commits?.map(
    (commit) => {
      try {
        if (commit.id) {
          insertCardImageFromCache(card.id, commit, { kind: "back" }, supabase);
          supabase.from("cards").update({
            back_image_id: commit.id,
          }).eq("id", card.id);
        }
      } catch (e) {
        console.error("Error inserting card image", e);
      }
    },
  );
  await Promise.all(imageCommitUpdateResults);
  return backImageCommit;
};
