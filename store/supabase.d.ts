export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      card_images: {
        Row: {
          bytes: number | null
          card_id: string | null
          content_type: string | null
          created_at: string
          height: number | null
          id: string
          image_cache_id: string | null
          is_primary: boolean
          kind: string | null
          legacy_key: string | null
          provider: string | null
          quality_score: number | null
          source_url: string | null
          status: string
          storage_path: string | null
          updated_at: string
          url_hash: string | null
          width: number | null
        }
        Insert: {
          bytes?: number | null
          card_id?: string | null
          content_type?: string | null
          created_at?: string
          height?: number | null
          id?: string
          image_cache_id?: string | null
          is_primary?: boolean
          kind?: string | null
          legacy_key?: string | null
          provider?: string | null
          quality_score?: number | null
          source_url?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          url_hash?: string | null
          width?: number | null
        }
        Update: {
          bytes?: number | null
          card_id?: string | null
          content_type?: string | null
          created_at?: string
          height?: number | null
          id?: string
          image_cache_id?: string | null
          is_primary?: boolean
          kind?: string | null
          legacy_key?: string | null
          provider?: string | null
          quality_score?: number | null
          source_url?: string | null
          status?: string
          storage_path?: string | null
          updated_at?: string
          url_hash?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "card_images_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_images_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "wishlist_cards_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_images_image_cache_id_fkey"
            columns: ["image_cache_id"]
            isOneToOne: false
            referencedRelation: "image_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          back_id: string | null
          back_image_id: string | null
          extra_image_ids: string[] | null
          extras: string[] | null
          front_id: string | null
          front_image_id: string | null
          genre: string
          grades_prices: Json
          id: string
          last_updated: string
          latest_price: number | null
          name: string
          release_date: string | null
          set_name: string
        }
        Insert: {
          back_id?: string | null
          back_image_id?: string | null
          extra_image_ids?: string[] | null
          extras?: string[] | null
          front_id?: string | null
          front_image_id?: string | null
          genre: string
          grades_prices?: Json
          id?: string
          last_updated?: string
          latest_price?: number | null
          name: string
          release_date?: string | null
          set_name: string
        }
        Update: {
          back_id?: string | null
          back_image_id?: string | null
          extra_image_ids?: string[] | null
          extras?: string[] | null
          front_id?: string | null
          front_image_id?: string | null
          genre?: string
          grades_prices?: Json
          id?: string
          last_updated?: string
          latest_price?: number | null
          name?: string
          release_date?: string | null
          set_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_back_image_id_fkey"
            columns: ["back_image_id"]
            isOneToOne: false
            referencedRelation: "card_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_front_image_id_fkey"
            columns: ["front_image_id"]
            isOneToOne: false
            referencedRelation: "card_images"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          added_at: string | null
          collection_id: string
          id: number
          note: string | null
          position: number
          target_id: string
          target_type: Database["public"]["Enums"]["view_target"]
        }
        Insert: {
          added_at?: string | null
          collection_id: string
          id?: number
          note?: string | null
          position?: number
          target_id: string
          target_type: Database["public"]["Enums"]["view_target"]
        }
        Update: {
          added_at?: string | null
          collection_id?: string
          id?: number
          note?: string | null
          position?: number
          target_id?: string
          target_type?: Database["public"]["Enums"]["view_target"]
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean
          name: string
          owner_id: string
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      demo_user_map: {
        Row: {
          base_user_id: string
          demo_user_id: string
        }
        Insert: {
          base_user_id: string
          demo_user_id: string
        }
        Update: {
          base_user_id?: string
          demo_user_id?: string
        }
        Relationships: []
      }
      external_refs: {
        Row: {
          card_id: string
          created_at: string
          external_id: string
          provider: string
          suggested_uuid: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          external_id: string
          provider: string
          suggested_uuid?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          external_id?: string
          provider?: string
          suggested_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_refs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_refs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "wishlist_cards_enriched"
            referencedColumns: ["id"]
          },
        ]
      }
      image_cache: {
        Row: {
          bytes: number | null
          content_sha256: string | null
          content_type: string | null
          created_at: string | null
          error: string | null
          etag: string | null
          expires_at: string
          height: number | null
          id: string
          is_top_for_query: boolean | null
          last_checked_at: string | null
          mime: string | null
          query_hash: string | null
          source_url: string
          status: string | null
          storage_path: string | null
          updated_at: string
          url_hash: string | null
          width: number | null
        }
        Insert: {
          bytes?: number | null
          content_sha256?: string | null
          content_type?: string | null
          created_at?: string | null
          error?: string | null
          etag?: string | null
          expires_at: string
          height?: number | null
          id?: string
          is_top_for_query?: boolean | null
          last_checked_at?: string | null
          mime?: string | null
          query_hash?: string | null
          source_url: string
          status?: string | null
          storage_path?: string | null
          updated_at?: string
          url_hash?: string | null
          width?: number | null
        }
        Update: {
          bytes?: number | null
          content_sha256?: string | null
          content_type?: string | null
          created_at?: string | null
          error?: string | null
          etag?: string | null
          expires_at?: string
          height?: number | null
          id?: string
          is_top_for_query?: boolean | null
          last_checked_at?: string | null
          mime?: string | null
          query_hash?: string | null
          source_url?: string
          status?: string | null
          storage_path?: string | null
          updated_at?: string
          url_hash?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "image_cache_query_hash_fkey"
            columns: ["query_hash"]
            isOneToOne: false
            referencedRelation: "image_search_cache"
            referencedColumns: ["query_hash"]
          },
        ]
      }
      image_search_cache: {
        Row: {
          candidates: Json
          created_at: string
          query_hash: string
          query_norm: string
          top_image_id: string | null
          top_url: string | null
          ttl_seconds: number
          updated_at: string
        }
        Insert: {
          candidates: Json
          created_at?: string
          query_hash: string
          query_norm: string
          top_image_id?: string | null
          top_url?: string | null
          ttl_seconds?: number
          updated_at?: string
        }
        Update: {
          candidates?: Json
          created_at?: string
          query_hash?: string
          query_norm?: string
          top_image_id?: string | null
          top_url?: string | null
          ttl_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_search_cache_top_image_fk"
            columns: ["top_image_id"]
            isOneToOne: false
            referencedRelation: "image_cache"
            referencedColumns: ["id"]
          },
        ]
      }
      price_cache: {
        Row: {
          data: Json
          expires_at: string
          key: string
          updated_at: string
        }
        Insert: {
          data: Json
          expires_at: string
          key: string
          updated_at?: string
        }
        Update: {
          data?: Json
          expires_at?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          updated_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          updated_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          updated_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      provider_search_cache: {
        Row: {
          expires_at: string
          fetched_at: string
          normalized_items: Json
          provider: string
          provider_query_key: string
          raw_payload: Json | null
        }
        Insert: {
          expires_at: string
          fetched_at?: string
          normalized_items: Json
          provider: string
          provider_query_key: string
          raw_payload?: Json | null
        }
        Update: {
          expires_at?: string
          fetched_at?: string
          normalized_items?: Json
          provider?: string
          provider_query_key?: string
          raw_payload?: Json | null
        }
        Relationships: []
      }
      recent_views: {
        Row: {
          item_id: string
          item_type: string
          meta: Json | null
          user_id: string
          viewed_at: string
          views: number
        }
        Insert: {
          item_id: string
          item_type: string
          meta?: Json | null
          user_id: string
          viewed_at?: string
          views?: number
        }
        Update: {
          item_id?: string
          item_type?: string
          meta?: Json | null
          user_id?: string
          viewed_at?: string
          views?: number
        }
        Relationships: []
      }
      search_cache: {
        Row: {
          created_at: string
          etag: string | null
          payload: Json
          query_hash: string
          ttl_seconds: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          etag?: string | null
          payload: Json
          query_hash: string
          ttl_seconds?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          etag?: string | null
          payload?: Json
          query_hash?: string
          ttl_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      search_queries: {
        Row: {
          committed_at: string | null
          created_at: string
          hits: number
          id: string
          last_seen: string
          query_hash: string
          query_norm: string
          query_raw: string
          source: string
          user_id: string | null
        }
        Insert: {
          committed_at?: string | null
          created_at?: string
          hits?: number
          id?: string
          last_seen?: string
          query_hash: string
          query_norm: string
          query_raw: string
          source?: string
          user_id?: string | null
        }
        Update: {
          committed_at?: string | null
          created_at?: string
          hits?: number
          id?: string
          last_seen?: string
          query_hash?: string
          query_norm?: string
          query_raw?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      search_results: {
        Row: {
          card_id: string
          created_at: string
          id: string
          rank: number
          reason: Json | null
          score: number
          search_query_id: string
          snippet: string | null
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          rank: number
          reason?: Json | null
          score?: number
          search_query_id: string
          snippet?: string | null
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          rank?: number
          reason?: Json | null
          score?: number
          search_query_id?: string
          snippet?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "search_results_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_results_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "wishlist_cards_enriched"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "search_results_search_query_id_fkey"
            columns: ["search_query_id"]
            isOneToOne: false
            referencedRelation: "search_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string | null
          onboarding_complete: boolean | null
          push_opt_in: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          onboarding_complete?: boolean | null
          push_opt_in?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          onboarding_complete?: boolean | null
          push_opt_in?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          created_at: string
          kind: string
          metadata: Json
          ref_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          kind: string
          metadata?: Json
          ref_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          metadata?: Json
          ref_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_kind_fkey"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "wishlist_kind"
            referencedColumns: ["name"]
          },
        ]
      }
      wishlist_kind: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      wishlist_totals: {
        Row: {
          computed_at: string
          total_cents: number
          user_id: string
        }
        Insert: {
          computed_at?: string
          total_cents?: number
          user_id: string
        }
        Update: {
          computed_at?: string
          total_cents?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      wishlist_cards_enriched: {
        Row: {
          back_id: string | null
          back_image_id: string | null
          created_at: string | null
          extra_image_ids: string[] | null
          extras: string[] | null
          front_id: string | null
          front_image_id: string | null
          genre: string | null
          grades_prices: Json | null
          id: string | null
          last_updated: string | null
          latest_price: number | null
          name: string | null
          release_date: string | null
          set_name: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cards_back_image_id_fkey"
            columns: ["back_image_id"]
            isOneToOne: false
            referencedRelation: "card_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cards_front_image_id_fkey"
            columns: ["front_image_id"]
            isOneToOne: false
            referencedRelation: "card_images"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_counts: {
        Row: {
          kind: string | null
          ref_id: string | null
          wishlist_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_kind_fkey"
            columns: ["kind"]
            isOneToOne: false
            referencedRelation: "wishlist_kind"
            referencedColumns: ["name"]
          },
        ]
      }
    }
    Functions: {
      _wishlist_row_cost_cents: {
        Args: { p_kind: string; p_metadata: Json; p_ref_id: string }
        Returns: number
      }
      add_to_collection: {
        Args: {
          p_collection_id: string
          p_note?: string
          p_target_id: string
          p_target_type: Database["public"]["Enums"]["view_target"]
        }
        Returns: undefined
      }
      bump_search_query: {
        Args: {
          p_query_hash: string
          p_query_norm: string
          p_query_raw: string
          p_source?: string
        }
        Returns: {
          committed_at: string
          hits: number
          last_seen: string
        }[]
      }
      citext: {
        Args: { "": boolean } | { "": string } | { "": unknown }
        Returns: string
      }
      citext_hash: {
        Args: { "": string }
        Returns: number
      }
      citextin: {
        Args: { "": unknown }
        Returns: string
      }
      citextout: {
        Args: { "": string }
        Returns: unknown
      }
      citextrecv: {
        Args: { "": unknown }
        Returns: string
      }
      citextsend: {
        Args: { "": string }
        Returns: string
      }
      create_collection: {
        Args: { p_desc?: string; p_is_public?: boolean; p_name: string }
        Returns: string
      }
      effective_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      ensure_demo_mapping: {
        Args: { p_base_user_id: string }
        Returns: undefined
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_demo_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      resolve_external_refs: {
        Args: { p_ids: string[]; p_provider: string }
        Returns: {
          card_id: string
          external_id: string
        }[]
      }
      search_cards_blended: {
        Args: { p_limit?: number; p_q: string }
        Returns: {
          id: string
          latest_price: number
          name: string
          reason: Json
          score: number
          set_name: string
          snippet: string
        }[]
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      touch_recent_view: {
        Args:
          | {
              p_ctx?: Json
              p_source?: string
              p_target_id: string
              p_target_type: Database["public"]["Enums"]["view_target"]
            }
          | {
              p_item_id: string
              p_item_type: string
              p_meta?: Json
              p_user_id: string
            }
        Returns: undefined
      }
      upsert_image_by_url: {
        Args: { p_h: number; p_mime: string; p_url: string; p_w: number }
        Returns: string
      }
      wishlist_recompute_total: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      wishlist_set_grades: {
        Args: {
          p_delete_when_empty?: boolean
          p_grades: string[]
          p_kind: string
          p_ref_id: string
        }
        Returns: {
          grades: string[]
        }[]
      }
      wishlist_toggle: {
        Args:
          | { p_kind: string; p_metadata?: Json; p_ref_id: string }
          | { p_kind: string; p_ref_id: string }
        Returns: {
          is_wishlisted: boolean
        }[]
      }
      wishlist_toggle_grade: {
        Args: {
          p_delete_when_empty?: boolean
          p_grade: string
          p_kind: string
          p_ref_id: string
        }
        Returns: {
          grades: string[]
        }[]
      }
      wishlist_total: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
    }
    Enums: {
      view_target: "card" | "listing"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      view_target: ["card", "listing"],
    },
  },
} as const
