create type "auth"."oauth_authorization_status" as enum ('pending', 'approved', 'denied', 'expired');

create type "auth"."oauth_client_type" as enum ('public', 'confidential');

create type "auth"."oauth_response_type" as enum ('code');

revoke select on table "auth"."schema_migrations" from "postgres";

alter table "auth"."oauth_clients" drop constraint "oauth_clients_client_id_key";

drop index if exists "auth"."oauth_clients_client_id_idx";

drop index if exists "auth"."oauth_clients_client_id_key";


  create table "auth"."oauth_authorizations" (
    "id" uuid not null,
    "authorization_id" text not null,
    "client_id" uuid not null,
    "user_id" uuid,
    "redirect_uri" text not null,
    "scope" text not null,
    "state" text,
    "resource" text,
    "code_challenge" text,
    "code_challenge_method" auth.code_challenge_method,
    "response_type" auth.oauth_response_type not null default 'code'::auth.oauth_response_type,
    "status" auth.oauth_authorization_status not null default 'pending'::auth.oauth_authorization_status,
    "authorization_code" text,
    "created_at" timestamp with time zone not null default now(),
    "expires_at" timestamp with time zone not null default (now() + '00:03:00'::interval),
    "approved_at" timestamp with time zone,
    "nonce" text
      );



  create table "auth"."oauth_client_states" (
    "id" uuid not null,
    "provider_type" text not null,
    "code_verifier" text,
    "created_at" timestamp with time zone not null
      );



  create table "auth"."oauth_consents" (
    "id" uuid not null,
    "user_id" uuid not null,
    "client_id" uuid not null,
    "scopes" text not null,
    "granted_at" timestamp with time zone not null default now(),
    "revoked_at" timestamp with time zone
      );


alter table "auth"."mfa_factors" add column "last_webauthn_challenge_data" jsonb;

alter table "auth"."oauth_clients" drop column "client_id";

alter table "auth"."oauth_clients" add column "client_type" auth.oauth_client_type not null default 'confidential'::auth.oauth_client_type;

alter table "auth"."oauth_clients" alter column "client_secret_hash" drop not null;

alter table "auth"."sessions" add column "oauth_client_id" uuid;

alter table "auth"."sessions" add column "refresh_token_counter" bigint;

alter table "auth"."sessions" add column "refresh_token_hmac_key" text;

alter table "auth"."sessions" add column "scopes" text;

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);

CREATE UNIQUE INDEX oauth_authorizations_authorization_code_key ON auth.oauth_authorizations USING btree (authorization_code);

CREATE UNIQUE INDEX oauth_authorizations_authorization_id_key ON auth.oauth_authorizations USING btree (authorization_id);

CREATE UNIQUE INDEX oauth_authorizations_pkey ON auth.oauth_authorizations USING btree (id);

CREATE UNIQUE INDEX oauth_client_states_pkey ON auth.oauth_client_states USING btree (id);

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);

CREATE UNIQUE INDEX oauth_consents_pkey ON auth.oauth_consents USING btree (id);

CREATE UNIQUE INDEX oauth_consents_user_client_unique ON auth.oauth_consents USING btree (user_id, client_id);

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_pkey" PRIMARY KEY using index "oauth_authorizations_pkey";

alter table "auth"."oauth_client_states" add constraint "oauth_client_states_pkey" PRIMARY KEY using index "oauth_client_states_pkey";

alter table "auth"."oauth_consents" add constraint "oauth_consents_pkey" PRIMARY KEY using index "oauth_consents_pkey";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_authorization_code_key" UNIQUE using index "oauth_authorizations_authorization_code_key";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_authorization_code_length" CHECK ((char_length(authorization_code) <= 255)) not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_authorization_code_length";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_authorization_id_key" UNIQUE using index "oauth_authorizations_authorization_id_key";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_client_id_fkey" FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_client_id_fkey";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_code_challenge_length" CHECK ((char_length(code_challenge) <= 128)) not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_code_challenge_length";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_expires_at_future" CHECK ((expires_at > created_at)) not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_expires_at_future";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_nonce_length" CHECK ((char_length(nonce) <= 255)) not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_nonce_length";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_redirect_uri_length" CHECK ((char_length(redirect_uri) <= 2048)) not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_redirect_uri_length";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_resource_length" CHECK ((char_length(resource) <= 2048)) not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_resource_length";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_scope_length" CHECK ((char_length(scope) <= 4096)) not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_scope_length";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_state_length" CHECK ((char_length(state) <= 4096)) not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_state_length";

alter table "auth"."oauth_authorizations" add constraint "oauth_authorizations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "auth"."oauth_authorizations" validate constraint "oauth_authorizations_user_id_fkey";

alter table "auth"."oauth_consents" add constraint "oauth_consents_client_id_fkey" FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE not valid;

alter table "auth"."oauth_consents" validate constraint "oauth_consents_client_id_fkey";

alter table "auth"."oauth_consents" add constraint "oauth_consents_revoked_after_granted" CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))) not valid;

alter table "auth"."oauth_consents" validate constraint "oauth_consents_revoked_after_granted";

alter table "auth"."oauth_consents" add constraint "oauth_consents_scopes_length" CHECK ((char_length(scopes) <= 2048)) not valid;

alter table "auth"."oauth_consents" validate constraint "oauth_consents_scopes_length";

alter table "auth"."oauth_consents" add constraint "oauth_consents_scopes_not_empty" CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0)) not valid;

alter table "auth"."oauth_consents" validate constraint "oauth_consents_scopes_not_empty";

alter table "auth"."oauth_consents" add constraint "oauth_consents_user_client_unique" UNIQUE using index "oauth_consents_user_client_unique";

alter table "auth"."oauth_consents" add constraint "oauth_consents_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "auth"."oauth_consents" validate constraint "oauth_consents_user_id_fkey";

alter table "auth"."sessions" add constraint "sessions_oauth_client_id_fkey" FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE not valid;

alter table "auth"."sessions" validate constraint "sessions_oauth_client_id_fkey";

alter table "auth"."sessions" add constraint "sessions_scopes_length" CHECK ((char_length(scopes) <= 4096)) not valid;

alter table "auth"."sessions" validate constraint "sessions_scopes_length";

grant delete on table "auth"."oauth_authorizations" to "postgres";

grant insert on table "auth"."oauth_authorizations" to "postgres";

grant references on table "auth"."oauth_authorizations" to "postgres";

grant select on table "auth"."oauth_authorizations" to "postgres";

grant trigger on table "auth"."oauth_authorizations" to "postgres";

grant truncate on table "auth"."oauth_authorizations" to "postgres";

grant update on table "auth"."oauth_authorizations" to "postgres";

grant delete on table "auth"."oauth_client_states" to "postgres";

grant insert on table "auth"."oauth_client_states" to "postgres";

grant references on table "auth"."oauth_client_states" to "postgres";

grant select on table "auth"."oauth_client_states" to "postgres";

grant trigger on table "auth"."oauth_client_states" to "postgres";

grant truncate on table "auth"."oauth_client_states" to "postgres";

grant update on table "auth"."oauth_client_states" to "postgres";

grant delete on table "auth"."oauth_consents" to "postgres";

grant insert on table "auth"."oauth_consents" to "postgres";

grant references on table "auth"."oauth_consents" to "postgres";

grant select on table "auth"."oauth_consents" to "postgres";

grant trigger on table "auth"."oauth_consents" to "postgres";

grant truncate on table "auth"."oauth_consents" to "postgres";

grant update on table "auth"."oauth_consents" to "postgres";


