export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '13.0.4'
  }
  public: {
    Tables: {
      card_enrichment_attempts: {
        Row: {
          best_score: number | null
          card_id: string
          created_at: string
          error: string | null
          id: number
          image_url: string | null
          matched_title: string | null
          outcome: string
          results: number | null
          run_id: string
          vendor: string | null
          with_image: number | null
        }
        Insert: {
          best_score?: number | null
          card_id: string
          created_at?: string
          error?: string | null
          id?: never
          image_url?: string | null
          matched_title?: string | null
          outcome: string
          results?: number | null
          run_id: string
          vendor?: string | null
          with_image?: number | null
        }
        Update: {
          best_score?: number | null
          card_id?: string
          created_at?: string
          error?: string | null
          id?: never
          image_url?: string | null
          matched_title?: string | null
          outcome?: string
          results?: number | null
          run_id?: string
          vendor?: string | null
          with_image?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'card_enrichment_attempts_card_id_fkey'
            columns: ['card_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'card_enrichment_attempts_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'enrichment_runs'
            referencedColumns: ['id']
          },
        ]
      }
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
      card_price_history: {
        Row: {
          card_id: string
          grade: string
          id: string
          price_cents: number
          recorded_at: string
          recorded_date: string
        }
        Insert: {
          card_id: string
          grade: string
          id?: string
          price_cents: number
          recorded_at?: string
          recorded_date?: string
        }
        Update: {
          card_id?: string
          grade?: string
          id?: string
          price_cents?: number
          recorded_at?: string
          recorded_date?: string
        }
        Relationships: [
          {
            foreignKeyName: 'card_price_history_card_id_fkey'
            columns: ['card_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id']
          },
        ]
      }
      card_price_refresh_attempts: {
        Row: {
          card_id: string
          cardhedge_id: string | null
          created_at: string
          error: string | null
          grades: number | null
          id: number
          match_confidence: number | null
          matched_description: string | null
          outcome: string
          run_id: string
        }
        Insert: {
          card_id: string
          cardhedge_id?: string | null
          created_at?: string
          error?: string | null
          grades?: number | null
          id?: never
          match_confidence?: number | null
          matched_description?: string | null
          outcome: string
          run_id: string
        }
        Update: {
          card_id?: string
          cardhedge_id?: string | null
          created_at?: string
          error?: string | null
          grades?: number | null
          id?: never
          match_confidence?: number | null
          matched_description?: string | null
          outcome?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'card_price_refresh_attempts_card_id_fkey'
            columns: ['card_id']
            isOneToOne: false
            referencedRelation: 'cards'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'card_price_refresh_attempts_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'price_refresh_runs'
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
          enriched_at: string | null
          enrichment_locked_at: string | null
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
          price_refresh_attempted_at: string | null
          price_refresh_locked_at: string | null
          price_refresh_status: string | null
          prices_refreshed_at: string | null
          release_date: string | null
          sealed: boolean
          search_vector: unknown
          set_name: string
        }
        Insert: {
          back_id?: string | null
          back_image_id?: string | null
          enriched_at?: string | null
          enrichment_locked_at?: string | null
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
          price_refresh_attempted_at?: string | null
          price_refresh_locked_at?: string | null
          price_refresh_status?: string | null
          prices_refreshed_at?: string | null
          release_date?: string | null
          sealed?: boolean
          search_vector?: unknown
          set_name: string
        }
        Update: {
          back_id?: string | null
          back_image_id?: string | null
          enriched_at?: string | null
          enrichment_locked_at?: string | null
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
          price_refresh_attempted_at?: string | null
          price_refresh_locked_at?: string | null
          price_refresh_status?: string | null
          prices_refreshed_at?: string | null
          release_date?: string | null
          sealed?: boolean
          search_vector?: unknown
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
      client_errors: {
        Row: {
          context: string
          created_at: string
          id: number
          message: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          context: string
          created_at?: string
          id?: never
          message: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          context?: string
          created_at?: string
          id?: never
          message?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      collection_group: {
        Row: {
          created_at: string
          id: string
          is_system: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      collection_group_items: {
        Row: {
          added_at: string
          collection_id: string
          group_id: string
          last_viewed_at: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          group_id: string
          last_viewed_at?: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          group_id?: string
          last_viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'collection_group_items_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'collection_group_items_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_group_items_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_group_items_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'collection_group'
            referencedColumns: ['id']
          },
        ]
      }
      collection_item_events: {
        Row: {
          collection_id: string
          grade_condition_id: string | null
          id: string
          occurred_at: string
          quantity_delta: number
          ref_id: string
        }
        Insert: {
          collection_id: string
          grade_condition_id?: string | null
          id?: string
          occurred_at?: string
          quantity_delta: number
          ref_id: string
        }
        Update: {
          collection_id?: string
          grade_condition_id?: string | null
          id?: string
          occurred_at?: string
          quantity_delta?: number
          ref_id?: string
        }
        Relationships: []
      }
      collection_item_images: {
        Row: {
          collection_item_id: string
          created_at: string
          height: number | null
          id: string
          image_cache_id: string
          is_primary: boolean
          position: number
          storage_path: string
          user_id: string
          width: number | null
        }
        Insert: {
          collection_item_id: string
          created_at?: string
          height?: number | null
          id?: string
          image_cache_id: string
          is_primary?: boolean
          position?: number
          storage_path: string
          user_id: string
          width?: number | null
        }
        Update: {
          collection_item_id?: string
          created_at?: string
          height?: number | null
          id?: string
          image_cache_id?: string
          is_primary?: boolean
          position?: number
          storage_path?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'collection_item_images_collection_item_id_fkey'
            columns: ['collection_item_id']
            isOneToOne: false
            referencedRelation: 'collection_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_item_images_image_cache_id_fkey'
            columns: ['image_cache_id']
            isOneToOne: false
            referencedRelation: 'image_cache'
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
          price_snapshot: Json | null
          price_snapshot_at: string | null
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
          price_snapshot?: Json | null
          price_snapshot_at?: string | null
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
          price_snapshot?: Json | null
          price_snapshot_at?: string | null
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
      collection_value_history: {
        Row: {
          collection_id: string
          id: string
          quantity_total: number
          snapshotted_at: string
          total_cents: number
        }
        Insert: {
          collection_id: string
          id?: string
          quantity_total?: number
          snapshotted_at?: string
          total_cents: number
        }
        Update: {
          collection_id?: string
          id?: string
          quantity_total?: number
          snapshotted_at?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: 'collection_value_history_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'collection_value_history_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_value_history_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
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
      enrichment_runs: {
        Row: {
          claimed: number
          enriched: number
          error: string | null
          failed: number
          finished_at: string | null
          hits_by_vendor: Json
          id: string
          no_match: number
          req_id: string
          started_at: string
          status: string
          vendors: string[]
        }
        Insert: {
          claimed?: number
          enriched?: number
          error?: string | null
          failed?: number
          finished_at?: string | null
          hits_by_vendor?: Json
          id?: string
          no_match?: number
          req_id: string
          started_at?: string
          status?: string
          vendors?: string[]
        }
        Update: {
          claimed?: number
          enriched?: number
          error?: string | null
          failed?: number
          finished_at?: string | null
          hits_by_vendor?: Json
          id?: string
          no_match?: number
          req_id?: string
          started_at?: string
          status?: string
          vendors?: string[]
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
      home_feed_section_meta: {
        Row: {
          enabled: boolean
          icon: string
          key: string
          layout: Json
          result_limit: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          icon: string
          key: string
          layout?: Json
          result_limit?: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          icon?: string
          key?: string
          layout?: Json
          result_limit?: number
          sort_order?: number
          title?: string
          updated_at?: string
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
          expires_at: string | null
          height: number | null
          id: string
          is_top_for_query: boolean | null
          last_checked_at: string | null
          mime: string | null
          query_hash: string | null
          source_url: string | null
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
          expires_at?: string | null
          height?: number | null
          id?: string
          is_top_for_query?: boolean | null
          last_checked_at?: string | null
          mime?: string | null
          query_hash?: string | null
          source_url?: string | null
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
          expires_at?: string | null
          height?: number | null
          id?: string
          is_top_for_query?: boolean | null
          last_checked_at?: string | null
          mime?: string | null
          query_hash?: string | null
          source_url?: string | null
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
      marketplace_section_items: {
        Row: {
          collection_item_id: string
          computed_at: string
          payload: Json
          rank: number
          section_key: string
        }
        Insert: {
          collection_item_id: string
          computed_at?: string
          payload: Json
          rank: number
          section_key: string
        }
        Update: {
          collection_item_id?: string
          computed_at?: string
          payload?: Json
          rank?: number
          section_key?: string
        }
        Relationships: [
          {
            foreignKeyName: 'marketplace_section_items_section_key_fkey'
            columns: ['section_key']
            isOneToOne: false
            referencedRelation: 'marketplace_section_meta'
            referencedColumns: ['key']
          },
        ]
      }
      marketplace_section_meta: {
        Row: {
          enabled: boolean
          expires_at: string | null
          key: string
          refresh_interval: string
          refreshed_at: string | null
          result_limit: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          expires_at?: string | null
          key: string
          refresh_interval?: string
          refreshed_at?: string | null
          result_limit?: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          expires_at?: string | null
          key?: string
          refresh_interval?: string
          refreshed_at?: string | null
          result_limit?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          category: string
          created_at: string
          dismissed_at: string | null
          id: string
          image_url: string | null
          payload: Json
          priority: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          category: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          image_url?: string | null
          payload?: Json
          priority?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          category?: string
          created_at?: string
          dismissed_at?: string | null
          id?: string
          image_url?: string | null
          payload?: Json
          priority?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_items: {
        Row: {
          card_snapshot: Json | null
          collection_item_id: string | null
          id: string
          offer_id: string
          offered_price_per_unit: number
          quantity: number
        }
        Insert: {
          card_snapshot?: Json | null
          collection_item_id?: string | null
          id?: string
          offer_id: string
          offered_price_per_unit: number
          quantity?: number
        }
        Update: {
          card_snapshot?: Json | null
          collection_item_id?: string | null
          id?: string
          offer_id?: string
          offered_price_per_unit?: number
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: 'offer_items_collection_item_id_fkey'
            columns: ['collection_item_id']
            isOneToOne: false
            referencedRelation: 'collection_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'offer_items_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: false
            referencedRelation: 'offers'
            referencedColumns: ['id']
          },
        ]
      }
      offers: {
        Row: {
          buyer_id: string
          buyer_note: string | null
          created_at: string | null
          id: string
          seller_id: string
          status: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          buyer_note?: string | null
          created_at?: string | null
          id?: string
          seller_id: string
          status?: string
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          buyer_note?: string | null
          created_at?: string | null
          id?: string
          seller_id?: string
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: []
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
      password_policy: {
        Row: {
          id: number
          min_length: number
          require_lowercase: boolean
          require_number: boolean
          require_special: boolean
          require_uppercase: boolean
        }
        Insert: {
          id?: number
          min_length?: number
          require_lowercase?: boolean
          require_number?: boolean
          require_special?: boolean
          require_uppercase?: boolean
        }
        Update: {
          id?: number
          min_length?: number
          require_lowercase?: boolean
          require_number?: boolean
          require_special?: boolean
          require_uppercase?: boolean
        }
        Relationships: []
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
      price_refresh_runs: {
        Row: {
          claimed: number
          error: string | null
          failed: number
          finished_at: string | null
          id: string
          refreshed: number
          req_id: string
          resolves_used: number
          started_at: string
          status: string
          unchanged: number
          unresolved: number
        }
        Insert: {
          claimed?: number
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          refreshed?: number
          req_id: string
          resolves_used?: number
          started_at?: string
          status?: string
          unchanged?: number
          unresolved?: number
        }
        Update: {
          claimed?: number
          error?: string | null
          failed?: number
          finished_at?: string | null
          id?: string
          refreshed?: number
          req_id?: string
          resolves_used?: number
          started_at?: string
          status?: string
          unchanged?: number
          unresolved?: number
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
      saved_collections: {
        Row: {
          collection_id: string
          last_viewed_at: string
          saved_at: string
          user_id: string
        }
        Insert: {
          collection_id: string
          last_viewed_at?: string
          saved_at?: string
          user_id: string
        }
        Update: {
          collection_id?: string
          last_viewed_at?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'saved_collections_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'saved_collections_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'saved_collections_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections_with_tags'
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
      search_config: {
        Row: {
          id: number
          min_score: number
          pop_log_divisor: number
          pop_sale_weight: number
          pop_wishlist_weight: number
          prefetch_enabled: boolean
          prefetch_threshold_ms: number
          snippet_max_fragments: number
          snippet_max_words: number
          snippet_min_words: number
          suggestion_queries: string[]
          suggestion_query_idx: number
          trgm_word_similarity_threshold: number
          updated_at: string | null
          weight_fts: number
          weight_pop: number
          weight_trgm: number
          weight_vector: number
        }
        Insert: {
          id?: number
          min_score?: number
          pop_log_divisor?: number
          pop_sale_weight?: number
          pop_wishlist_weight?: number
          prefetch_enabled?: boolean
          prefetch_threshold_ms?: number
          snippet_max_fragments?: number
          snippet_max_words?: number
          snippet_min_words?: number
          suggestion_queries?: string[]
          suggestion_query_idx?: number
          trgm_word_similarity_threshold?: number
          updated_at?: string | null
          weight_fts?: number
          weight_pop?: number
          weight_trgm?: number
          weight_vector?: number
        }
        Update: {
          id?: number
          min_score?: number
          pop_log_divisor?: number
          pop_sale_weight?: number
          pop_wishlist_weight?: number
          prefetch_enabled?: boolean
          prefetch_threshold_ms?: number
          snippet_max_fragments?: number
          snippet_max_words?: number
          snippet_min_words?: number
          suggestion_queries?: string[]
          suggestion_query_idx?: number
          trgm_word_similarity_threshold?: number
          updated_at?: string | null
          weight_fts?: number
          weight_pop?: number
          weight_trgm?: number
          weight_vector?: number
        }
        Relationships: []
      }
      search_perf_samples: {
        Row: {
          created_at: string
          id: string
          render_ms: number
        }
        Insert: {
          created_at?: string
          id?: string
          render_ms: number
        }
        Update: {
          created_at?: string
          id?: string
          render_ms?: number
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
      seller_follows: {
        Row: {
          created_at: string
          follower_id: string
          seller_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          seller_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          seller_id?: string
        }
        Relationships: []
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
      transaction_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          transaction_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          transaction_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transaction_messages_transaction_id_fkey'
            columns: ['transaction_id']
            isOneToOne: false
            referencedRelation: 'transactions'
            referencedColumns: ['id']
          },
        ]
      }
      transactions: {
        Row: {
          buyer_shipping_address: Json | null
          created_at: string | null
          id: string
          offer_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          buyer_shipping_address?: Json | null
          created_at?: string | null
          id?: string
          offer_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          buyer_shipping_address?: Json | null
          created_at?: string | null
          id?: string
          offer_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'transactions_offer_id_fkey'
            columns: ['offer_id']
            isOneToOne: true
            referencedRelation: 'offers'
            referencedColumns: ['id']
          },
        ]
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
          onboarding_state: Json
          preferences: Json
          shipping_address: Json | null
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
          onboarding_state?: Json
          preferences?: Json
          shipping_address?: Json | null
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
          onboarding_state?: Json
          preferences?: Json
          shipping_address?: Json | null
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
          profile_setup_complete: boolean
          push_opt_in: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          onboarding_complete?: boolean | null
          profile_setup_complete?: boolean
          push_opt_in?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          onboarding_complete?: boolean | null
          profile_setup_complete?: boolean
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
      wishlist_hit_notifications: {
        Row: {
          created_at: string
          listing_item_id: string
          notification_id: string | null
          ref_id: string
          seeded: boolean
          user_id: string
          wishlist_item_id: string
        }
        Insert: {
          created_at?: string
          listing_item_id: string
          notification_id?: string | null
          ref_id: string
          seeded?: boolean
          user_id: string
          wishlist_item_id: string
        }
        Update: {
          created_at?: string
          listing_item_id?: string
          notification_id?: string | null
          ref_id?: string
          seeded?: boolean
          user_id?: string
          wishlist_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wishlist_hit_notifications_listing_item_id_fkey'
            columns: ['listing_item_id']
            isOneToOne: false
            referencedRelation: 'collection_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wishlist_hit_notifications_wishlist_item_id_fkey'
            columns: ['wishlist_item_id']
            isOneToOne: false
            referencedRelation: 'collection_items'
            referencedColumns: ['id']
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
      enrichment_backlog: {
        Row: {
          backfill_card_failures_24h: number | null
          backfill_claimed_24h: number | null
          backfill_completed_24h: number | null
          backfill_enriched_24h: number | null
          backfill_failed_runs_24h: number | null
          backfill_no_match_24h: number | null
          backfill_runs_24h: number | null
          enriched_24h_all_paths: number | null
          est_days_remaining: number | null
          last_completed_at: string | null
          last_run_at: string | null
          last_run_status: string | null
          leased_now: number | null
          stale_leases: number | null
          unenriched: number | null
        }
        Relationships: []
      }
      enrichment_vendor_outcomes: {
        Row: {
          attempts: number | null
          avg_score: number | null
          outcome: string | null
          p10_score: number | null
          p50_score: number | null
          vendor: string | null
        }
        Relationships: []
      }
      my_pinned_collection_items: {
        Row: {
          added_at: string | null
          collection_id: string | null
          group_id: string | null
          last_viewed_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'collection_group_items_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collection_totals_with_flags'
            referencedColumns: ['collection_id']
          },
          {
            foreignKeyName: 'collection_group_items_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_group_items_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections_with_tags'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collection_group_items_group_id_fkey'
            columns: ['group_id']
            isOneToOne: false
            referencedRelation: 'collection_group'
            referencedColumns: ['id']
          },
        ]
      }
      price_refresh_backlog: {
        Row: {
          claimed_24h: number | null
          completed: number | null
          last_run_at: string | null
          last_run_status: string | null
          leased_now: number | null
          rate_limited: number | null
          refreshed_24h: number | null
          runs: number | null
          stale: number | null
          tracked_cards: number | null
          unresolved: number | null
        }
        Relationships: []
      }
      price_refresh_outcomes: {
        Row: {
          attempts: number | null
          avg_confidence: number | null
          outcome: string | null
          p10_confidence: number | null
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
      _marketplace_base_listings: {
        Args: never
        Returns: {
          back_id: string
          collection_id: string
          collection_item_id: string
          front_id: string
          genre: string
          grade_condition_id: string
          grades_prices: Json
          grading_company: string
          item_kind: Database['public']['Enums']['item_kind']
          latest_price: number
          listed_at: string
          market_value: number
          name: string
          popularity_score: number
          price_key: string
          quantity: number
          ref_id: string
          sealed: boolean
          seller_avatar_url: string
          seller_display_name: string
          seller_id: string
          seller_username: string
          set_name: string
          storefront_id: string
          variants: string[]
        }[]
      }
      _wishlist_hits: {
        Args: { p_user_id?: string }
        Returns: {
          current_price_cents: number
          grading_company: string
          listed_at: string
          listing_collection_id: string
          listing_item_id: string
          name: string
          price_key: string
          prices_refreshed_at: string
          ref_id: string
          savings_pct: number
          seller_avatar_url: string
          seller_display_name: string
          seller_id: string
          seller_username: string
          set_name: string
          snapshot_at: string
          snapshot_price_cents: number
          storefront_id: string
          user_id: string
          wishlist_grade_condition_id: string
          wishlist_item_id: string
          wishlisted_at: string
        }[]
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
      apply_card_price_refresh: {
        Args: {
          p_card_id: string
          p_latest_price_cents?: number
          p_prices: Json
        }
        Returns: Json
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
      canonical_genre: { Args: { p: string }; Returns: string }
      check_email_registered: { Args: { p_email: string }; Returns: boolean }
      claim_cards_for_backfill_enrichment: {
        Args: { p_lease_seconds?: number; p_limit: number }
        Returns: {
          id: string
          name: string
          set_name: string
        }[]
      }
      claim_cards_for_price_refresh: {
        Args: {
          p_lease_seconds?: number
          p_limit: number
          p_stale_hours?: number
          p_unresolved_retry_hours?: number
        }
        Returns: {
          cardhedge_id: string
          genre: string
          id: string
          name: string
          set_name: string
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
          collection_ref: string
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
          primary_image_cache_id: string
          primary_image_height: number
          primary_image_storage_path: string
          primary_image_width: number
          quantity: number
          ref_id: string
          set_name: string
          updated_at: string
          user_id: string
          variants: string[]
        }[]
      }
      collection_item_query_grouped: {
        Args: {
          p_collection_id: string
          p_page_param?: string
          p_page_size?: number
          p_search?: string
        }
        Returns: {
          items: Json
          ref_id: string
          ref_latest_created_at: string
        }[]
      }
      collection_item_query_grouped_slim: {
        Args: {
          p_collection_id: string
          p_page_param?: string
          p_page_size?: number
          p_search?: string
        }
        Returns: Json
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
          price_snapshot: Json | null
          price_snapshot_at: string | null
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
      ensure_card_stub:
        | {
            Args: {
              p_external_id?: string
              p_genre?: string
              p_grades_prices?: Json
              p_id: string
              p_image_url?: string
              p_latest_price?: number
              p_name: string
              p_provider?: string
              p_set_name?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_external_id?: string
              p_genre?: string
              p_id: string
              p_name: string
              p_provider?: string
              p_set_name?: string
            }
            Returns: undefined
          }
      ensure_default_collections: { Args: never; Returns: undefined }
      ensure_default_collections_for_user: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      ensure_demo_mapping: {
        Args: { p_base_user_id: string }
        Returns: undefined
      }
      ensure_pinned_group_for_user: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_wishlist_hit_notifications: {
        Args: { p_max_per_user?: number }
        Returns: number
      }
      get_activation_status: {
        Args: never
        Returns: {
          activated: boolean
          has_collection_item: boolean
          has_offer: boolean
          has_storefront: boolean
        }[]
      }
      get_featured_listings: {
        Args: { result_limit?: number }
        Returns: {
          back_id: string
          collection_id: string
          collection_item_id: string
          front_id: string
          genre: string
          grade_condition_id: string
          grades_prices: Json
          grading_company: string
          item_kind: Database['public']['Enums']['item_kind']
          latest_price: number
          listed_at: string
          market_value: number
          name: string
          popularity_score: number
          price_key: string
          quantity: number
          ref_id: string
          seller_avatar_url: string
          seller_display_name: string
          seller_id: string
          seller_username: string
          set_name: string
          storefront_id: string
          variants: string[]
        }[]
      }
      get_followed_sellers: {
        Args: never
        Returns: {
          seller_id: string
        }[]
      }
      get_home_feed_sections: {
        Args: never
        Returns: {
          icon: string
          key: string
          layout: Json
          result_limit: number
          sort_order: number
          title: string
        }[]
      }
      get_marketplace_sections: {
        Args: never
        Returns: {
          items: Json
          refreshed_at: string
          section_key: string
          sort_order: number
          title: string
        }[]
      }
      get_portfolio_history: {
        Args: { p_collection_id: string; p_from?: string; p_to?: string }
        Returns: {
          quantity_total: number
          snapshotted_at: string
          total_cents: number
        }[]
      }
      get_public_profile: {
        Args: { target_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          is_seller: boolean
          location: string
          user_id: string
          username: string
        }[]
      }
      get_public_profiles: {
        Args: { user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          is_seller: boolean
          user_id: string
          username: string
        }[]
      }
      get_public_storefronts: {
        Args: { page_param?: string; result_limit?: number }
        Returns: {
          description: string
          item_count: number
          listed_at: string
          seller_avatar_url: string
          seller_display_name: string
          seller_id: string
          seller_is_seller: boolean
          seller_username: string
          storefront_id: string
          tags: string[]
          title: string
        }[]
      }
      get_recommended_listings: {
        Args: { result_limit?: number }
        Returns: {
          back_id: string
          collection_id: string
          collection_item_id: string
          front_id: string
          genre: string
          grade_condition_id: string
          grades_prices: Json
          grading_company: string
          item_kind: Database['public']['Enums']['item_kind']
          latest_price: number
          listed_at: string
          market_value: number
          name: string
          popularity_score: number
          price_key: string
          quantity: number
          ref_id: string
          seller_avatar_url: string
          seller_display_name: string
          seller_id: string
          seller_username: string
          set_name: string
          storefront_id: string
          variants: string[]
        }[]
      }
      get_suggested_sellers: {
        Args: { exclude_user_id?: string; result_limit?: number }
        Returns: {
          avatar_url: string
          display_name: string
          is_seller: boolean
          user_id: string
          username: string
        }[]
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
      get_ticker_items: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          change_pct: number
          current_cents: number
          name: string
          past_cents: number
          price_key: string
          ref_id: string
          set_name: string
          source: string
        }[]
      }
      get_wishlist_hits: {
        Args: { p_limit?: number }
        Returns: {
          current_price_cents: number
          grading_company: string
          listed_at: string
          listing_collection_id: string
          listing_item_id: string
          name: string
          other_listings_count: number
          price_key: string
          prices_refreshed_at: string
          ref_id: string
          savings_pct: number
          seller_avatar_url: string
          seller_display_name: string
          seller_id: string
          seller_username: string
          set_name: string
          snapshot_at: string
          snapshot_price_cents: number
          storefront_id: string
          wishlist_item_id: string
          wishlisted_at: string
        }[]
      }
      grade_condition_price_key: {
        Args: { p_grade_condition_id: string }
        Returns: string
      }
      grade_key: { Args: { p_slug: string; p_value: number }; Returns: string }
      is_demo_user: { Args: never; Returns: boolean }
      list_card_genres: {
        Args: never
        Returns: {
          genre: string
          n: number
        }[]
      }
      list_card_sets: {
        Args: { p_genre?: string }
        Returns: {
          n: number
          set_name: string
        }[]
      }
      mark_card_price_refresh: {
        Args: { p_card_id: string; p_status: string }
        Returns: undefined
      }
      most_used_variants: {
        Args: { p_card_id: string; p_limit?: number; p_query?: string }
        Returns: {
          total_quantity: number
          usage_count: number
          variant_id: string
          variant_name: string
        }[]
      }
      normalize_grade_key: { Args: { p_key: string }; Returns: string }
      normalize_grades_prices: { Args: { p: Json }; Returns: Json }
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
      refresh_marketplace_sections: { Args: never; Returns: undefined }
      release_card_price_refresh: {
        Args: { p_card_ids: string[] }
        Returns: undefined
      }
      remove_pinned_collection: {
        Args: { p_collection_id: string }
        Returns: undefined
      }
      resolve_external_refs: {
        Args: { p_ids: string[]; p_provider: string }
        Returns: {
          card_id: string
          external_id: string
        }[]
      }
      search_cards_blended: {
        Args: {
          p_genre?: string
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_q: string
          p_sealed?: boolean
          p_sets?: string[]
        }
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
      search_storefront_items: {
        Args: {
          p_genre?: string
          p_grading?: string[]
          p_limit?: number
          p_max_price?: number
          p_min_price?: number
          p_q?: string
          p_sealed?: boolean
          p_sets?: string[]
        }
        Returns: {
          card_id: string
          genre: string
          grade_label: string
          grading_company: string
          id: string
          name: string
          price: number
          reason: Json
          score: number
          sealed: boolean
          seller_id: string
          seller_username: string
          set_name: string
          snippet: string
        }[]
      }
      set_primary_collection_item_photo: {
        Args: { p_photo_id: string }
        Returns: undefined
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
      toggle_seller_follow: {
        Args: { p_seller_id: string }
        Returns: {
          is_following: boolean
        }[]
      }
      touch_collection_group_item: {
        Args: { p_collection_id: string; p_group_id: string }
        Returns: undefined
      }
      touch_pinned_collection: {
        Args: { p_collection_id: string }
        Returns: undefined
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
      touch_saved_collection: {
        Args: { p_collection_id: string }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
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
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
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
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
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
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
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
