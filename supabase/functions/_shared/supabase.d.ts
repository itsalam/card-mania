export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.4'
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
            foreignKeyName: 'card_images_card_id_fkey'
            columns: ['card_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'card_images_image_cache_id_fkey'
            columns: ['image_cache_id']
            isOneToOne: false
            referencedRelation: 'image_cache'
            referencedColumns: ['id']
          },
        ]
      }
      card_variants: {
        Row: {
          card_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: 'card_variants_card_id_fkey'
            columns: ['card_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id']
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
            foreignKeyName: 'cards_back_image_id_fkey'
            columns: ['back_image_id']
            isOneToOne: false
            referencedRelation: 'card_images'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cards_front_image_id_fkey'
            columns: ['front_image_id']
            isOneToOne: false
            referencedRelation: 'card_images'
            referencedColumns: ['id']
          },
        ]
      }
      collection_items: {
        Row: {
          collection_id: string
          collection_ref: string | null
          created_at: string
          grade_condition_id: string | null
          grading_company: string | null
          id: string
          item_kind: Database['public']['Enums']['item_kind']
          position: number
          quantity: number
          ref_id: string
          updated_at: string
          user_id: string
          variants: string[] | null
        }
        Insert: {
          collection_id: string
          collection_ref?: string | null
          created_at?: string
          grade_condition_id?: string | null
          grading_company?: string | null
          id?: string
          item_kind?: Database['public']['Enums']['item_kind']
          position?: number
          quantity: number
          ref_id: string
          updated_at?: string
          user_id: string
          variants?: string[] | null
        }
        Update: {
          collection_id?: string
          collection_ref?: string | null
          created_at?: string
          grade_condition_id?: string | null
          grading_company?: string | null
          id?: string
          item_kind?: Database['public']['Enums']['item_kind']
          position?: number
          quantity?: number
          ref_id?: string
          updated_at?: string
          user_id?: string
          variants?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: 'collection_items_collection_fk'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'collection_items_collection_fk'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_items_collection_fk'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_items_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'collection_items_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_items_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_items_collection_ref_fkey'
            columns: ['collection_ref']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'collection_items_collection_ref_fkey'
            columns: ['collection_ref']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_items_collection_ref_fkey'
            columns: ['collection_ref']
            isOneToOne: false
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_items_grade_condition_id_fkey'
            columns: ['grade_condition_id']
            isOneToOne: false
            referencedRelation: 'grade_conditions'
            referencedColumns: ['id']
          },
        ]
      }
      collection_stats: {
        Row: {
          collection_id: string
          item_count: number
          last_item_at: string | null
          updated_at: string
        }
        Insert: {
          collection_id: string
          item_count?: number
          last_item_at?: string | null
          updated_at?: string
        }
        Update: {
          collection_id?: string
          item_count?: number
          last_item_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'collection_stats_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: true
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'collection_stats_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: true
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_stats_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: true
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
        ]
      }
      collection_tags: {
        Row: {
          collection_id: string
          created_at: string
          tag_id: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          tag_id: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'collection_tags_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'collection_tags_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_tags_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
      collection_totals: {
        Row: {
          collection_id: string
          computed_at: string
          quantity_total: number
          total_cents: number
        }
        Insert: {
          collection_id: string
          computed_at?: string
          quantity_total?: number
          total_cents?: number
        }
        Update: {
          collection_id?: string
          computed_at?: string
          quantity_total?: number
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: 'collection_totals_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: true
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'collection_totals_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: true
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_totals_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: true
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
        ]
      }
      collections: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          hide_sold_items: boolean | null
          id: string
          is_selling: boolean | null
          is_storefront: boolean | null
          is_vault: boolean | null
          is_wishlist: boolean
          name: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          hide_sold_items?: boolean | null
          id?: string
          is_selling?: boolean | null
          is_storefront?: boolean | null
          is_vault?: boolean | null
          is_wishlist?: boolean
          name: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          hide_sold_items?: boolean | null
          id?: string
          is_selling?: boolean | null
          is_storefront?: boolean | null
          is_vault?: boolean | null
          is_wishlist?: boolean
          name?: string
          updated_at?: string
          user_id?: string
          visibility?: string
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
            foreignKeyName: 'external_refs_card_id_fkey'
            columns: ['card_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id']
          },
        ]
      }
      grade_conditions: {
        Row: {
          company_id: string
          grade_value: number
          id: string
          label: string
        }
        Insert: {
          company_id: string
          grade_value: number
          id?: string
          label: string
        }
        Update: {
          company_id?: string
          grade_value?: number
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: 'grade_conditions_company_id_fkey'
            columns: ['company_id']
            isOneToOne: false
            referencedRelation: 'grading_companies'
            referencedColumns: ['id']
          },
        ]
      }
      grading_companies: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
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
            foreignKeyName: 'image_cache_query_hash_fkey'
            columns: ['query_hash']
            isOneToOne: false
            referencedRelation: 'image_search_cache'
            referencedColumns: ['query_hash']
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
            foreignKeyName: 'image_search_cache_top_image_fk'
            columns: ['top_image_id']
            isOneToOne: false
            referencedRelation: 'image_cache'
            referencedColumns: ['id']
          },
        ]
      }
      listing_items: {
        Row: {
          ask_unit_price: number
          condition: string | null
          condition_key: string
          grade: string
          item_kind: Database['public']['Enums']['item_kind']
          listing_id: string
          max_available: number
          ref_id: string
        }
        Insert: {
          ask_unit_price: number
          condition?: string | null
          condition_key?: string
          grade?: string
          item_kind: Database['public']['Enums']['item_kind']
          listing_id: string
          max_available: number
          ref_id: string
        }
        Update: {
          ask_unit_price?: number
          condition?: string | null
          condition_key?: string
          grade?: string
          item_kind?: Database['public']['Enums']['item_kind']
          listing_id?: string
          max_available?: number
          ref_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'listing_items_listing_id_fkey'
            columns: ['listing_id']
            isOneToOne: false
            referencedRelation: 'listings'
            referencedColumns: ['id']
          },
        ]
      }
      listings: {
        Row: {
          created_at: string
          currency: string
          id: string
          owner_user_id: string
          snapshot_id: string
          status: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          owner_user_id: string
          snapshot_id: string
          status?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          owner_user_id?: string
          snapshot_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'listings_snapshot_id_fkey'
            columns: ['snapshot_id']
            isOneToOne: false
            referencedRelation: 'public_snapshots'
            referencedColumns: ['id']
          },
        ]
      }
      order_items: {
        Row: {
          condition: string | null
          condition_key: string
          grade: string
          item_kind: Database['public']['Enums']['item_kind']
          order_id: string
          quantity: number
          ref_id: string
          unit_price: number
        }
        Insert: {
          condition?: string | null
          condition_key?: string
          grade?: string
          item_kind: Database['public']['Enums']['item_kind']
          order_id: string
          quantity: number
          ref_id: string
          unit_price: number
        }
        Update: {
          condition?: string | null
          condition_key?: string
          grade?: string
          item_kind?: Database['public']['Enums']['item_kind']
          order_id?: string
          quantity?: number
          ref_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey'
            columns: ['order_id']
            isOneToOne: false
            referencedRelation: 'orders'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: {
          buyer_user_id: string | null
          created_at: string
          id: string
          listing_id: string
          status: string
        }
        Insert: {
          buyer_user_id?: string | null
          created_at?: string
          id?: string
          listing_id: string
          status?: string
        }
        Update: {
          buyer_user_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: 'orders_listing_id_fkey'
            columns: ['listing_id']
            isOneToOne: false
            referencedRelation: 'listings'
            referencedColumns: ['id']
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
      public_snapshot_items: {
        Row: {
          condition: string | null
          condition_key: string
          created_at: string
          display: Json | null
          grade: string
          item_kind: Database['public']['Enums']['item_kind']
          quantity: number
          ref_id: string
          snapshot_id: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          condition?: string | null
          condition_key?: string
          created_at?: string
          display?: Json | null
          grade?: string
          item_kind: Database['public']['Enums']['item_kind']
          quantity: number
          ref_id: string
          snapshot_id: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          condition?: string | null
          condition_key?: string
          created_at?: string
          display?: Json | null
          grade?: string
          item_kind?: Database['public']['Enums']['item_kind']
          quantity?: number
          ref_id?: string
          snapshot_id?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'public_snapshot_items_snapshot_id_fkey'
            columns: ['snapshot_id']
            isOneToOne: false
            referencedRelation: 'public_snapshots'
            referencedColumns: ['id']
          },
        ]
      }
      public_snapshots: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string
          published_at: string
          slug: string
          source_collection_id: string | null
          status: string
          title: string
          total_est_value: number | null
          total_items: number
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id: string
          published_at?: string
          slug: string
          source_collection_id?: string | null
          status?: string
          title: string
          total_est_value?: number | null
          total_items?: number
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string
          published_at?: string
          slug?: string
          source_collection_id?: string | null
          status?: string
          title?: string
          total_est_value?: number | null
          total_items?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: 'public_snapshots_source_collection_id_fkey'
            columns: ['source_collection_id']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'public_snapshots_source_collection_id_fkey'
            columns: ['source_collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'public_snapshots_source_collection_id_fkey'
            columns: ['source_collection_id']
            isOneToOne: false
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
        ]
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
      reservations: {
        Row: {
          buyer_user_id: string | null
          condition: string | null
          created_at: string
          expires_at: string
          grade: string | null
          id: string
          item_kind: Database['public']['Enums']['item_kind']
          listing_id: string
          quantity: number
          ref_id: string
        }
        Insert: {
          buyer_user_id?: string | null
          condition?: string | null
          created_at?: string
          expires_at: string
          grade?: string | null
          id?: string
          item_kind: Database['public']['Enums']['item_kind']
          listing_id: string
          quantity: number
          ref_id: string
        }
        Update: {
          buyer_user_id?: string | null
          condition?: string | null
          created_at?: string
          expires_at?: string
          grade?: string | null
          id?: string
          item_kind?: Database['public']['Enums']['item_kind']
          listing_id?: string
          quantity?: number
          ref_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'reservations_listing_id_fkey'
            columns: ['listing_id']
            isOneToOne: false
            referencedRelation: 'listings'
            referencedColumns: ['id']
          },
        ]
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
            foreignKeyName: 'search_results_card_id_fkey'
            columns: ['card_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'search_results_search_query_id_fkey'
            columns: ['search_query_id']
            isOneToOne: false
            referencedRelation: 'search_queries'
            referencedColumns: ['id']
          },
        ]
      }
      storefronts: {
        Row: {
          collection_ids: string[]
          created_at: string
          description: string | null
          id: string
          is_listed: boolean
          listed_at: string | null
          tags: string[]
          title: string | null
          updated_at: string
          user_id: string
          whitelist_user_ids: string[]
        }
        Insert: {
          collection_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_listed?: boolean
          listed_at?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id: string
          whitelist_user_ids?: string[]
        }
        Update: {
          collection_ids?: string[]
          created_at?: string
          description?: string | null
          id?: string
          is_listed?: boolean
          listed_at?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          user_id?: string
          whitelist_user_ids?: string[]
        }
        Relationships: []
      }
      tag_aliases: {
        Row: {
          alias_slug: string
          tag_id: string
        }
        Insert: {
          alias_slug: string
          tag_id: string
        }
        Update: {
          alias_slug?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tag_aliases_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
      tag_categories: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      tag_category_tags: {
        Row: {
          category_id: string
          tag_id: string
        }
        Insert: {
          category_id: string
          tag_id: string
        }
        Update: {
          category_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tag_category_tags_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'tag_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tag_category_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
      tags: {
        Row: {
          approved_at: string | null
          created_at: string
          curated_weight: number
          id: string
          is_active: boolean
          name: string
          popularity: number
          slug: string
          source: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          curated_weight?: number
          id?: string
          is_active?: boolean
          name: string
          popularity?: number
          slug: string
          source?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          curated_weight?: number
          id?: string
          is_active?: boolean
          name?: string
          popularity?: number
          slug?: string
          source?: string
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          is_hobbyiest: boolean
          is_seller: boolean
          last_seen_at: string | null
          location: string | null
          preferences: Json
          timezone: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          is_hobbyiest?: boolean
          is_seller?: boolean
          last_seen_at?: string | null
          location?: string | null
          preferences?: Json
          timezone?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          is_hobbyiest?: boolean
          is_seller?: boolean
          last_seen_at?: string | null
          location?: string | null
          preferences?: Json
          timezone?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
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
      user_tag_stats: {
        Row: {
          last_used_at: string
          tag_id: string
          use_count: number
          user_id: string
        }
        Insert: {
          last_used_at?: string
          tag_id: string
          use_count?: number
          user_id: string
        }
        Update: {
          last_used_at?: string
          tag_id?: string
          use_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_tag_stats_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'tags'
            referencedColumns: ['id']
          },
        ]
      }
      wishlist: {
        Row: {
          collection_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wishlist_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'wishlist_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wishlist_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
        ]
      }
      wishlist_backup_20251204: {
        Row: {
          created_at: string | null
          kind: string | null
          metadata: Json | null
          ref_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          kind?: string | null
          metadata?: Json | null
          ref_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          kind?: string | null
          metadata?: Json | null
          ref_id?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      collection_item_variant_usage: {
        Row: {
          card_id: string | null
          total_quantity: number | null
          usage_count: number | null
          variant_lc: string | null
        }
        Relationships: []
      }
      collection_totals_with_flags: {
        Row: {
          collection_id: string | null
          computed_at: string | null
          is_selling: boolean | null
          is_vault: boolean | null
          is_wishlist: boolean | null
          quantity_total: number | null
          total_cents: number | null
          user_id: string | null
        }
        Relationships: []
      }
      collections_with_tags: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          tags_cache: string[] | null
          updated_at: string | null
          user_id: string | null
          visibility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _clamp_nonnegative: { Args: { val: number }; Returns: number }
      _collection_item_value_cents: {
        Args: {
          p_grade_condition_id: string
          p_item_kind: Database['public']['Enums']['item_kind']
          p_quantity?: number
          p_ref_id: string
        }
        Returns: number
      }
      _wishlist_row_cost_cents: {
        Args: { p_kind: string; p_metadata?: Json; p_ref_id: string }
        Returns: number
      }
      _wishlist_row_cost_cents_from_collection_item: {
        Args: {
          p_grade_condition_id: string
          p_grading_company: string
          p_item_kind: Database['public']['Enums']['item_kind']
          p_ref_id: string
        }
        Returns: number
      }
      add_to_collection: {
        Args: {
          p_collection_id: string
          p_condition?: string
          p_grade?: string
          p_item_kind: Database['public']['Enums']['item_kind']
          p_quantity?: number
          p_ref_id: string
          p_user?: string
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
      collection_item_query: {
        Args: {
          p_collection_id: string
          p_group?: boolean
          p_page_param?: string
          p_page_size?: number
          p_search?: string
        }
        Returns: {
          back_id: string
          collection_id: string
          collection_item_id: string
          collection_item_value: number
          created_at: string
          extras: string[]
          front_id: string
          genre: string
          grade_condition_id: string
          grades_prices: Json
          grading_company: string
          id: string
          item_kind: Database['public']['Enums']['item_kind']
          last_updated: string
          latest_price: number
          name: string
          position: number
          price_key: string
          quantity: number
          ref_id: string
          set_name: string
          updated_at: string
          user_id: string
          variants: string[]
        }[]
      }
      collection_items_by_ref: {
        Args: {
          p_collection_id: string
          p_item_kind?: Database['public']['Enums']['item_kind']
          p_ref_id: string
        }
        Returns: {
          collection_id: string
          collection_ref: string | null
          created_at: string
          grade_condition_id: string | null
          grading_company: string | null
          id: string
          item_kind: Database['public']['Enums']['item_kind']
          position: number
          quantity: number
          ref_id: string
          updated_at: string
          user_id: string
          variants: string[] | null
        }[]
        SetofOptions: {
          from: '*'
          to: 'collection_items'
          isOneToOne: false
          isSetofReturn: true
        }
      }
      collection_totals_for_user: {
        Args: { p_user_id?: string }
        Returns: {
          selling_quantity_total: number
          selling_total_cents: number
          user_id: string
          vault_quantity_total: number
          vault_total_cents: number
          wishlist_quantity_total: number
          wishlist_total_cents: number
        }[]
      }
      collections_with_membership: {
        Args: { p_card: string; p_user: string }
        Returns: {
          cover_image_url: string
          created_at: string
          description: string
          has_item: boolean
          id: string
          name: string
          tags_cache: string[]
          updated_at: string
          user_id: string
          visibility: string
        }[]
      }
      collections_with_membership_query: {
        Args: { p_card: string; p_query?: string; p_user: string }
        Returns: {
          cover_image_url: string
          created_at: string
          description: string
          has_item: boolean
          id: string
          name: string
          tags_cache: string[]
          updated_at: string
          user_id: string
          visibility: string
        }[]
      }
      create_collection: {
        Args: { p_desc?: string; p_is_public?: boolean; p_name: string }
        Returns: string
      }
      curated_tag_upsert: {
        Args: { p_name: string; p_slug: string; p_weight?: number }
        Returns: string
      }
      curated_tags_import: { Args: { payload: Json }; Returns: Json }
      effective_user_id: { Args: never; Returns: string }
      ensure_default_collections: { Args: never; Returns: undefined }
      ensure_default_collections_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      ensure_demo_mapping: {
        Args: { p_base_user_id: string }
        Returns: undefined
      }
      get_tag_categories: {
        Args: { tags: string[] }
        Returns: {
          category_names: string[]
          category_slugs: string[]
          input_text: string
          tag_id: string
          tag_name: string
          tag_slug: string
        }[]
      }
      is_demo_user: { Args: never; Returns: boolean }
      most_used_variants: {
        Args: { p_card_id: string; p_limit?: number; p_query?: string }
        Returns: {
          total_quantity: number
          usage_count: number
          variant_id: string
          variant_name: string
        }[]
      }
      publish_snapshot: {
        Args: {
          p_collection_id: string
          p_owner: string
          p_slug: string
          p_subset?: Json
          p_title: string
        }
        Returns: string
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
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { '': string }; Returns: string[] }
      suggest_tags: {
        Args: {
          category_ids?: string[]
          category_slugs?: string[]
          category_w?: number
          curated_w?: number
          global_w?: number
          max_results?: number
          personal_w?: number
          q?: string
          sim_thresh?: number
          tau_hours?: number
        }
        Returns: {
          id: string
          name: string
          score: number
        }[]
      }
      suggest_tags_v2: {
        Args: {
          category_ids?: string[]
          category_slugs?: string[]
          category_w?: number
          curated_w?: number
          global_w?: number
          max_results?: number
          personal_w?: number
          q?: string
          sim_thresh?: number
          tau_hours?: number
        }
        Returns: {
          category_names: string[]
          category_slugs: string[]
          id: string
          name: string
          score: number
        }[]
      }
      touch_recent_view:
        | {
            Args: {
              p_ctx?: Json
              p_source?: string
              p_target_id: string
              p_target_type: Database['public']['Enums']['view_target']
            }
            Returns: undefined
          }
        | {
            Args: {
              p_item_id: string
              p_item_type: string
              p_meta?: Json
              p_user_id: string
            }
            Returns: undefined
          }
      upsert_collection_items: {
        Args: { p_collection_id: string; p_items: Json; p_owner: string }
        Returns: undefined
      }
      upsert_image_by_url: {
        Args: { p_h: number; p_mime: string; p_url: string; p_w: number }
        Returns: string
      }
      wishlist_recompute_total: { Args: never; Returns: number }
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
        Args: { p_grade_cond_id?: string; p_kind: string; p_ref_id: string }
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
      wishlist_total: { Args: never; Returns: number }
    }
    Enums: {
      item_kind: 'card'
      view_target: 'card' | 'listing'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      item_kind: ['card'],
      view_target: ['card', 'listing'],
    },
  },
} as const
