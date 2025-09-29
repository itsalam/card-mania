create extension if not exists "uuid-ossp";
create extension if not exists citext;
create extension if not exists pgcrypto;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."view_target" AS ENUM (
    'card',
    'listing'
);


ALTER TYPE "public"."view_target" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_to_collection"("p_collection_id" "uuid", "p_target_type" "public"."view_target", "p_target_id" "uuid", "p_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with maxpos as (
    select coalesce(max(position), -1) + 1 as next_pos
    from public.collection_items where collection_id = p_collection_id
  )
  insert into public.collection_items(collection_id, target_type, target_id, position, note)
  select p_collection_id, p_target_type, p_target_id, next_pos, p_note from maxpos
  on conflict (collection_id, target_type, target_id) do nothing;
$$;


ALTER FUNCTION "public"."add_to_collection"("p_collection_id" "uuid", "p_target_type" "public"."view_target", "p_target_id" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_collection"("p_name" "text", "p_desc" "text" DEFAULT NULL::"text", "p_is_public" boolean DEFAULT false) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.collections(id, owner_id, name, description, is_public)
  values (v_id, auth.uid(), p_name, p_desc, coalesce(p_is_public,false));
  return v_id;
end $$;


ALTER FUNCTION "public"."create_collection"("p_name" "text", "p_desc" "text", "p_is_public" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."effective_user_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(
    (select base_user_id from public.demo_user_map where demo_user_id = auth.uid()),
    auth.uid()
  )
$$;


ALTER FUNCTION "public"."effective_user_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_demo_mapping"("p_base_user_id" "uuid") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into public.demo_user_map(demo_user_id, base_user_id)
  values (auth.uid(), p_base_user_id)
  on conflict (demo_user_id) do nothing;
$$;


ALTER FUNCTION "public"."ensure_demo_mapping"("p_base_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_demo_user"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (select 1 from public.demo_user_map where demo_user_id = auth.uid())
$$;


ALTER FUNCTION "public"."is_demo_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_cards_last_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.last_updated := now();
  return new;
end $$;


ALTER FUNCTION "public"."set_cards_last_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_recent_view"("p_target_type" "public"."view_target", "p_target_id" "uuid", "p_source" "text" DEFAULT NULL::"text", "p_ctx" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into public.recent_views (user_id, target_type, target_id, source, ctx)
  values (auth.uid(), p_target_type, p_target_id, p_source, coalesce(p_ctx, '{}'::jsonb))
  on conflict (user_id, target_type, target_id)
  do update set
    last_viewed_at = now(),
    view_count = public.recent_views.view_count + 1,
    source = excluded.source,
    ctx = excluded.ctx;
$$;


ALTER FUNCTION "public"."touch_recent_view"("p_target_type" "public"."view_target", "p_target_id" "uuid", "p_source" "text", "p_ctx" "jsonb") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."cards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "set_name" "text" NOT NULL,
    "latest_price" numeric,
    "grades_prices" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "genre" "text" NOT NULL,
    "last_updated" timestamp with time zone DEFAULT "now"() NOT NULL,
    "front_id" "text",
    "back_id" "text",
    "extras" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."cards" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."collection_items" (
    "id" bigint NOT NULL,
    "collection_id" "uuid" NOT NULL,
    "target_type" "public"."view_target" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "note" "text",
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collection_items" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."collection_items_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."collection_items_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."collection_items_id_seq" OWNED BY "public"."collection_items"."id";



CREATE TABLE IF NOT EXISTS "public"."collections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_public" boolean DEFAULT false NOT NULL,
    "cover_image_url" "text",
    "slug" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."collections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."demo_user_map" (
    "demo_user_id" "uuid" NOT NULL,
    "base_user_id" "uuid" NOT NULL
);


ALTER TABLE "public"."demo_user_map" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."image_cache" (
    "key" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "source_url" "text" NOT NULL,
    "storage_path" "text",
    "status" "text",
    "content_type" "text",
    "width" integer,
    "height" integer,
    "bytes" integer,
    "etag" "text",
    "last_checked_at" timestamp with time zone,
    "error" "text",
    CONSTRAINT "image_cache_status_check" CHECK (("status" = ANY (ARRAY['READY'::"text", 'PROCESSING'::"text", 'FAILED'::"text"])))
);


ALTER TABLE "public"."image_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_cache" (
    "key" "text" NOT NULL,
    "data" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL
);


ALTER TABLE "public"."price_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "user_id" "uuid" NOT NULL,
    "username" "public"."citext",
    "display_name" "text",
    "avatar_url" "text",
    "bio" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recent_views" (
    "user_id" "uuid" NOT NULL,
    "target_type" "public"."view_target" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "last_viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "view_count" integer DEFAULT 1 NOT NULL,
    "source" "text",
    "ctx" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."recent_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "onboarding_complete" boolean DEFAULT false,
    "push_opt_in" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_settings" OWNER TO "postgres";


ALTER TABLE ONLY "public"."collection_items" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."collection_items_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collection_items"
    ADD CONSTRAINT "collection_items_collection_id_target_type_target_id_key" UNIQUE ("collection_id", "target_type", "target_id");



ALTER TABLE ONLY "public"."collection_items"
    ADD CONSTRAINT "collection_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_owner_id_slug_key" UNIQUE ("owner_id", "slug");



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."demo_user_map"
    ADD CONSTRAINT "demo_user_map_pkey" PRIMARY KEY ("demo_user_id");



ALTER TABLE ONLY "public"."image_cache"
    ADD CONSTRAINT "image_cache_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."price_cache"
    ADD CONSTRAINT "price_cache_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."recent_views"
    ADD CONSTRAINT "recent_views_pkey" PRIMARY KEY ("user_id", "target_type", "target_id");



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "ci_collection_position" ON "public"."collection_items" USING "btree" ("collection_id", "position");



CREATE INDEX "idx_cards_genre" ON "public"."cards" USING "btree" ("genre");



CREATE INDEX "idx_cards_last_updated" ON "public"."cards" USING "btree" ("last_updated");



CREATE INDEX "idx_cards_name" ON "public"."cards" USING "btree" ("name");



CREATE INDEX "idx_cards_set_name" ON "public"."cards" USING "btree" ("set_name");



CREATE INDEX "image_cache_expires_idx" ON "public"."image_cache" USING "btree" ("expires_at");



CREATE INDEX "price_cache_expires_idx" ON "public"."price_cache" USING "btree" ("expires_at");



CREATE INDEX "profiles_username_idx" ON "public"."profiles" USING "btree" ("username");



CREATE INDEX "rv_user_time_desc" ON "public"."recent_views" USING "btree" ("user_id", "last_viewed_at" DESC);



CREATE OR REPLACE TRIGGER "trg_cards_set_last_updated" BEFORE UPDATE ON "public"."cards" FOR EACH ROW EXECUTE FUNCTION "public"."set_cards_last_updated"();



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_back_id_fkey" FOREIGN KEY ("back_id") REFERENCES "public"."image_cache"("key") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cards"
    ADD CONSTRAINT "cards_front_id_fkey" FOREIGN KEY ("front_id") REFERENCES "public"."image_cache"("key") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."collection_items"
    ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."collections"
    ADD CONSTRAINT "collections_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demo_user_map"
    ADD CONSTRAINT "demo_user_map_base_user_id_fkey" FOREIGN KEY ("base_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."demo_user_map"
    ADD CONSTRAINT "demo_user_map_demo_user_id_fkey" FOREIGN KEY ("demo_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recent_views"
    ADD CONSTRAINT "recent_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Owner select" ON "public"."user_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Owner update" ON "public"."user_settings" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Owner upsert" ON "public"."user_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Public read cards" ON "public"."cards" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Self insert profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Self update profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."cards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collection_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."collections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "delete own (no demo)" ON "public"."collections" FOR DELETE USING ((("auth"."uid"() = "owner_id") AND (NOT "public"."is_demo_user"())));



ALTER TABLE "public"."image_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner read/write collections" ON "public"."collections" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



ALTER TABLE "public"."price_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read as effective user" ON "public"."collections" FOR SELECT USING (("owner_id" = "public"."effective_user_id"()));



CREATE POLICY "read cache (auth only)" ON "public"."image_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read cache (auth only)" ON "public"."price_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read image cache (auth only)" ON "public"."image_cache" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "read items by effective" ON "public"."collection_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_items"."collection_id") AND ("c"."owner_id" = "public"."effective_user_id"())))));



CREATE POLICY "read recent effective" ON "public"."recent_views" FOR SELECT USING (("user_id" = "public"."effective_user_id"()));



ALTER TABLE "public"."recent_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update own (no demo)" ON "public"."collections" FOR UPDATE USING ((("auth"."uid"() = "owner_id") AND (NOT "public"."is_demo_user"()))) WITH CHECK ((("auth"."uid"() = "owner_id") AND (NOT "public"."is_demo_user"())));



ALTER TABLE "public"."user_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "write items (no demo)" ON "public"."collection_items" USING (((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_items"."collection_id") AND ("c"."owner_id" = "auth"."uid"())))) AND (NOT "public"."is_demo_user"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."collections" "c"
  WHERE (("c"."id" = "collection_items"."collection_id") AND ("c"."owner_id" = "auth"."uid"())))) AND (NOT "public"."is_demo_user"())));



CREATE POLICY "write own (no demo)" ON "public"."collections" FOR INSERT WITH CHECK ((("auth"."uid"() = "owner_id") AND (NOT "public"."is_demo_user"())));



CREATE POLICY "write recent (no demo)" ON "public"."recent_views" USING ((("auth"."uid"() = "user_id") AND (NOT "public"."is_demo_user"()))) WITH CHECK ((("auth"."uid"() = "user_id") AND (NOT "public"."is_demo_user"())));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."add_to_collection"("p_collection_id" "uuid", "p_target_type" "public"."view_target", "p_target_id" "uuid", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_to_collection"("p_collection_id" "uuid", "p_target_type" "public"."view_target", "p_target_id" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_to_collection"("p_collection_id" "uuid", "p_target_type" "public"."view_target", "p_target_id" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_collection"("p_name" "text", "p_desc" "text", "p_is_public" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_collection"("p_name" "text", "p_desc" "text", "p_is_public" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_collection"("p_name" "text", "p_desc" "text", "p_is_public" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."effective_user_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."effective_user_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."effective_user_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_demo_mapping"("p_base_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_demo_mapping"("p_base_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_demo_mapping"("p_base_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_demo_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_demo_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_demo_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_cards_last_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_cards_last_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_cards_last_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_recent_view"("p_target_type" "public"."view_target", "p_target_id" "uuid", "p_source" "text", "p_ctx" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."touch_recent_view"("p_target_type" "public"."view_target", "p_target_id" "uuid", "p_source" "text", "p_ctx" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_recent_view"("p_target_type" "public"."view_target", "p_target_id" "uuid", "p_source" "text", "p_ctx" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."cards" TO "anon";
GRANT ALL ON TABLE "public"."cards" TO "authenticated";
GRANT ALL ON TABLE "public"."cards" TO "service_role";



GRANT ALL ON TABLE "public"."collection_items" TO "anon";
GRANT ALL ON TABLE "public"."collection_items" TO "authenticated";
GRANT ALL ON TABLE "public"."collection_items" TO "service_role";



GRANT ALL ON SEQUENCE "public"."collection_items_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."collection_items_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."collection_items_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."collections" TO "anon";
GRANT ALL ON TABLE "public"."collections" TO "authenticated";
GRANT ALL ON TABLE "public"."collections" TO "service_role";



GRANT ALL ON TABLE "public"."demo_user_map" TO "anon";
GRANT ALL ON TABLE "public"."demo_user_map" TO "authenticated";
GRANT ALL ON TABLE "public"."demo_user_map" TO "service_role";



GRANT ALL ON TABLE "public"."image_cache" TO "anon";
GRANT ALL ON TABLE "public"."image_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."image_cache" TO "service_role";



GRANT ALL ON TABLE "public"."price_cache" TO "anon";
GRANT ALL ON TABLE "public"."price_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."price_cache" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."recent_views" TO "anon";
GRANT ALL ON TABLE "public"."recent_views" TO "authenticated";
GRANT ALL ON TABLE "public"."recent_views" TO "service_role";



GRANT ALL ON TABLE "public"."user_settings" TO "anon";
GRANT ALL ON TABLE "public"."user_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."user_settings" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






RESET ALL;