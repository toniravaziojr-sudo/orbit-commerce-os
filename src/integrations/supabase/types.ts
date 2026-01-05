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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_channel_config: {
        Row: {
          channel_type: string
          created_at: string
          custom_instructions: string | null
          forbidden_topics: string[] | null
          id: string
          is_enabled: boolean
          max_response_length: number | null
          system_prompt_override: string | null
          tenant_id: string
          updated_at: string
          use_emojis: boolean | null
        }
        Insert: {
          channel_type: string
          created_at?: string
          custom_instructions?: string | null
          forbidden_topics?: string[] | null
          id?: string
          is_enabled?: boolean
          max_response_length?: number | null
          system_prompt_override?: string | null
          tenant_id: string
          updated_at?: string
          use_emojis?: boolean | null
        }
        Update: {
          channel_type?: string
          created_at?: string
          custom_instructions?: string | null
          forbidden_topics?: string[] | null
          id?: string
          is_enabled?: boolean
          max_response_length?: number | null
          system_prompt_override?: string | null
          tenant_id?: string
          updated_at?: string
          use_emojis?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_channel_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_support_config: {
        Row: {
          ai_model: string | null
          approval_mode: boolean | null
          auto_import_categories: boolean | null
          auto_import_faqs: boolean | null
          auto_import_policies: boolean | null
          auto_import_products: boolean | null
          created_at: string | null
          custom_knowledge: string | null
          forbidden_topics: string[] | null
          handle_audio: boolean | null
          handle_files: boolean | null
          handle_images: boolean | null
          handoff_keywords: string[] | null
          id: string
          image_analysis_prompt: string | null
          is_enabled: boolean | null
          max_messages_before_handoff: number | null
          max_response_length: number | null
          metadata: Json | null
          operating_hours: Json | null
          out_of_hours_message: string | null
          personality_name: string | null
          personality_tone: string | null
          rules: Json | null
          system_prompt: string | null
          target_first_response_seconds: number | null
          target_resolution_minutes: number | null
          tenant_id: string
          updated_at: string | null
          use_emojis: boolean | null
        }
        Insert: {
          ai_model?: string | null
          approval_mode?: boolean | null
          auto_import_categories?: boolean | null
          auto_import_faqs?: boolean | null
          auto_import_policies?: boolean | null
          auto_import_products?: boolean | null
          created_at?: string | null
          custom_knowledge?: string | null
          forbidden_topics?: string[] | null
          handle_audio?: boolean | null
          handle_files?: boolean | null
          handle_images?: boolean | null
          handoff_keywords?: string[] | null
          id?: string
          image_analysis_prompt?: string | null
          is_enabled?: boolean | null
          max_messages_before_handoff?: number | null
          max_response_length?: number | null
          metadata?: Json | null
          operating_hours?: Json | null
          out_of_hours_message?: string | null
          personality_name?: string | null
          personality_tone?: string | null
          rules?: Json | null
          system_prompt?: string | null
          target_first_response_seconds?: number | null
          target_resolution_minutes?: number | null
          tenant_id: string
          updated_at?: string | null
          use_emojis?: boolean | null
        }
        Update: {
          ai_model?: string | null
          approval_mode?: boolean | null
          auto_import_categories?: boolean | null
          auto_import_faqs?: boolean | null
          auto_import_policies?: boolean | null
          auto_import_products?: boolean | null
          created_at?: string | null
          custom_knowledge?: string | null
          forbidden_topics?: string[] | null
          handle_audio?: boolean | null
          handle_files?: boolean | null
          handle_images?: boolean | null
          handoff_keywords?: string[] | null
          id?: string
          image_analysis_prompt?: string | null
          is_enabled?: boolean | null
          max_messages_before_handoff?: number | null
          max_response_length?: number | null
          metadata?: Json | null
          operating_hours?: Json | null
          out_of_hours_message?: string | null
          personality_name?: string | null
          personality_tone?: string | null
          rules?: Json | null
          system_prompt?: string | null
          target_first_response_seconds?: number | null
          target_resolution_minutes?: number | null
          tenant_id?: string
          updated_at?: string | null
          use_emojis?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_support_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      block_implementation_requests: {
        Row: {
          created_at: string | null
          css_sample: string | null
          custom_block_id: string | null
          html_sample: string
          id: string
          implementation_notes: string | null
          implemented_as: string | null
          mapped_to_block: string | null
          occurrences_count: number | null
          pattern_description: string | null
          pattern_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_platform: string | null
          source_url: string | null
          status: string | null
          suggested_props: Json | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          css_sample?: string | null
          custom_block_id?: string | null
          html_sample: string
          id?: string
          implementation_notes?: string | null
          implemented_as?: string | null
          mapped_to_block?: string | null
          occurrences_count?: number | null
          pattern_description?: string | null
          pattern_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform?: string | null
          source_url?: string | null
          status?: string | null
          suggested_props?: Json | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          css_sample?: string | null
          custom_block_id?: string | null
          html_sample?: string
          id?: string
          implementation_notes?: string | null
          implemented_as?: string | null
          mapped_to_block?: string | null
          occurrences_count?: number | null
          pattern_description?: string | null
          pattern_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform?: string | null
          source_url?: string | null
          status?: string | null
          suggested_props?: Json | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "block_implementation_requests_custom_block_id_fkey"
            columns: ["custom_block_id"]
            isOneToOne: false
            referencedRelation: "custom_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_implementation_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_implementation_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          content: Json | null
          created_at: string
          excerpt: string | null
          featured_image_alt: string | null
          featured_image_url: string | null
          id: string
          published_at: string | null
          read_time_minutes: number | null
          seo_description: string | null
          seo_image_url: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[] | null
          tenant_id: string
          title: string
          updated_at: string
          view_count: number | null
        }
        Insert: {
          author_id?: string | null
          content?: Json | null
          created_at?: string
          excerpt?: string | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          published_at?: string | null
          read_time_minutes?: number | null
          seo_description?: string | null
          seo_image_url?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[] | null
          tenant_id: string
          title: string
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          author_id?: string | null
          content?: Json | null
          created_at?: string
          excerpt?: string | null
          featured_image_alt?: string | null
          featured_image_url?: string | null
          id?: string
          published_at?: string | null
          read_time_minutes?: number | null
          seo_description?: string | null
          seo_image_url?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[] | null
          tenant_id?: string
          title?: string
          updated_at?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      buy_together_rules: {
        Row: {
          created_at: string
          discount_type: string | null
          discount_value: number | null
          id: string
          is_active: boolean
          priority: number | null
          suggested_product_id: string
          tenant_id: string
          title: string | null
          trigger_product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          priority?: number | null
          suggested_product_id: string
          tenant_id: string
          title?: string | null
          trigger_product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          priority?: number | null
          suggested_product_id?: string
          tenant_id?: string
          title?: string | null
          trigger_product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_together_rules_suggested_product_id_fkey"
            columns: ["suggested_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_together_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_together_rules_trigger_product_id_fkey"
            columns: ["trigger_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          unit_price: number
          updated_at: string
          variant_id: string | null
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          unit_price: number
          updated_at?: string
          variant_id?: string | null
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          updated_at?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          customer_id: string | null
          expires_at: string | null
          id: string
          session_id: string | null
          status: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          session_id?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          session_id?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          banner_desktop_url: string | null
          banner_mobile_url: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          banner_desktop_url?: string | null
          banner_mobile_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          banner_desktop_url?: string | null
          banner_mobile_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_accounts: {
        Row: {
          account_name: string
          channel_type: Database["public"]["Enums"]["support_channel_type"]
          created_at: string | null
          credentials: Json | null
          external_account_id: string | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_sync_at: string | null
          metadata: Json | null
          rate_limit_per_day: number | null
          rate_limit_per_minute: number | null
          tenant_id: string
          updated_at: string | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          account_name: string
          channel_type: Database["public"]["Enums"]["support_channel_type"]
          created_at?: string | null
          credentials?: Json | null
          external_account_id?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          tenant_id: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          account_name?: string
          channel_type?: Database["public"]["Enums"]["support_channel_type"]
          created_at?: string | null
          credentials?: Json | null
          external_account_id?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          rate_limit_per_day?: number | null
          rate_limit_per_minute?: number | null
          tenant_id?: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          abandoned_at: string | null
          attribution_data: Json | null
          cart_id: string | null
          contact_captured_at: string | null
          converted_at: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          items_snapshot: Json | null
          last_seen_at: string
          metadata: Json | null
          order_id: string | null
          recovered_at: string | null
          region: string | null
          started_at: string
          status: string
          tenant_id: string
          total_estimated: number | null
          updated_at: string
          utm: Json | null
        }
        Insert: {
          abandoned_at?: string | null
          attribution_data?: Json | null
          cart_id?: string | null
          contact_captured_at?: string | null
          converted_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items_snapshot?: Json | null
          last_seen_at?: string
          metadata?: Json | null
          order_id?: string | null
          recovered_at?: string | null
          region?: string | null
          started_at?: string
          status?: string
          tenant_id: string
          total_estimated?: number | null
          updated_at?: string
          utm?: Json | null
        }
        Update: {
          abandoned_at?: string | null
          attribution_data?: Json | null
          cart_id?: string | null
          contact_captured_at?: string | null
          converted_at?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items_snapshot?: Json | null
          last_seen_at?: string
          metadata?: Json | null
          order_id?: string | null
          recovered_at?: string | null
          region?: string | null
          started_at?: string
          status?: string
          tenant_id?: string
          total_estimated?: number | null
          updated_at?: string
          utm?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_testimonial_products: {
        Row: {
          id: string
          product_id: string
          testimonial_id: string
        }
        Insert: {
          id?: string
          product_id: string
          testimonial_id: string
        }
        Update: {
          id?: string
          product_id?: string
          testimonial_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_testimonial_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_testimonial_products_testimonial_id_fkey"
            columns: ["testimonial_id"]
            isOneToOne: false
            referencedRelation: "checkout_testimonials"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_testimonials: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          rating: number
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          rating?: number
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          rating?: number
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_testimonials_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          abandoned_at: string | null
          cart_id: string
          completed_at: string | null
          coupon_code: string | null
          created_at: string
          customer_cpf: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_total: number | null
          id: string
          items_snapshot: Json | null
          notes: string | null
          payment_method: string | null
          recovery_status: string
          shipping_address_id: string | null
          shipping_carrier: string | null
          shipping_city: string | null
          shipping_complement: string | null
          shipping_country: string | null
          shipping_estimated_days: number | null
          shipping_method: string | null
          shipping_neighborhood: string | null
          shipping_number: string | null
          shipping_postal_code: string | null
          shipping_price: number | null
          shipping_state: string | null
          shipping_street: string | null
          shipping_total: number | null
          status: string | null
          step: string | null
          subtotal: number | null
          tenant_id: string
          total: number | null
          updated_at: string
        }
        Insert: {
          abandoned_at?: string | null
          cart_id: string
          completed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_total?: number | null
          id?: string
          items_snapshot?: Json | null
          notes?: string | null
          payment_method?: string | null
          recovery_status?: string
          shipping_address_id?: string | null
          shipping_carrier?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_country?: string | null
          shipping_estimated_days?: number | null
          shipping_method?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_postal_code?: string | null
          shipping_price?: number | null
          shipping_state?: string | null
          shipping_street?: string | null
          shipping_total?: number | null
          status?: string | null
          step?: string | null
          subtotal?: number | null
          tenant_id: string
          total?: number | null
          updated_at?: string
        }
        Update: {
          abandoned_at?: string | null
          cart_id?: string
          completed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_cpf?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_total?: number | null
          id?: string
          items_snapshot?: Json | null
          notes?: string | null
          payment_method?: string | null
          recovery_status?: string
          shipping_address_id?: string | null
          shipping_carrier?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_country?: string | null
          shipping_estimated_days?: number | null
          shipping_method?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_postal_code?: string | null
          shipping_price?: number | null
          shipping_state?: string | null
          shipping_street?: string | null
          shipping_total?: number | null
          status?: string | null
          step?: string | null
          subtotal?: number | null
          tenant_id?: string
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_shipping_address_id_fkey"
            columns: ["shipping_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_type: string | null
          conversation_id: string
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          new_value: Json | null
          old_value: Json | null
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string | null
          conversation_id: string
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_type?: string | null
          conversation_id?: string
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          old_value?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          avatar_url: string | null
          conversation_id: string
          customer_id: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          joined_at: string | null
          left_at: string | null
          participant_type: string
          role: string | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          conversation_id: string
          customer_id?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          participant_type: string
          role?: string | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          conversation_id?: string
          customer_id?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          participant_type?: string
          role?: string | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          channel_account_id: string | null
          channel_type: Database["public"]["Enums"]["support_channel_type"]
          created_at: string | null
          csat_feedback: string | null
          csat_score: number | null
          customer_avatar_url: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          external_conversation_id: string | null
          external_thread_id: string | null
          first_response_at: string | null
          id: string
          last_agent_message_at: string | null
          last_customer_message_at: string | null
          last_message_at: string | null
          message_count: number | null
          metadata: Json | null
          order_id: string | null
          priority: number | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["conversation_status"] | null
          subject: string | null
          summary: string | null
          tags: string[] | null
          tenant_id: string
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          channel_account_id?: string | null
          channel_type: Database["public"]["Enums"]["support_channel_type"]
          created_at?: string | null
          csat_feedback?: string | null
          csat_score?: number | null
          customer_avatar_url?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          external_conversation_id?: string | null
          external_thread_id?: string | null
          first_response_at?: string | null
          id?: string
          last_agent_message_at?: string | null
          last_customer_message_at?: string | null
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          order_id?: string | null
          priority?: number | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"] | null
          subject?: string | null
          summary?: string | null
          tags?: string[] | null
          tenant_id: string
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          channel_account_id?: string | null
          channel_type?: Database["public"]["Enums"]["support_channel_type"]
          created_at?: string | null
          csat_feedback?: string | null
          csat_score?: number | null
          customer_avatar_url?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          external_conversation_id?: string | null
          external_thread_id?: string | null
          first_response_at?: string | null
          id?: string
          last_agent_message_at?: string | null
          last_customer_message_at?: string | null
          last_message_at?: string | null
          message_count?: number | null
          metadata?: Json | null
          order_id?: string | null
          priority?: number | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"] | null
          subject?: string | null
          summary?: string | null
          tags?: string[] | null
          tenant_id?: string
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_account_id_fkey"
            columns: ["channel_account_id"]
            isOneToOne: false
            referencedRelation: "channel_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_blocks: {
        Row: {
          block_type: string
          created_at: string | null
          css_snapshot: string | null
          detected_pattern: Json | null
          html_template: string
          id: string
          name: string
          pattern_hash: string | null
          promoted_to_block: string | null
          source_platform: string | null
          source_url: string | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          block_type: string
          created_at?: string | null
          css_snapshot?: string | null
          detected_pattern?: Json | null
          html_template: string
          id?: string
          name: string
          pattern_hash?: string | null
          promoted_to_block?: string | null
          source_platform?: string | null
          source_url?: string | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          block_type?: string
          created_at?: string | null
          css_snapshot?: string | null
          detected_pattern?: Json | null
          html_template?: string
          id?: string
          name?: string
          pattern_hash?: string | null
          promoted_to_block?: string | null
          source_platform?: string | null
          source_url?: string | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string
          complement: string | null
          country: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean | null
          label: string
          neighborhood: string
          number: string
          postal_code: string
          recipient_name: string
          reference: string | null
          state: string
          street: string
          updated_at: string
        }
        Insert: {
          city: string
          complement?: string | null
          country?: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean | null
          label?: string
          neighborhood: string
          number: string
          postal_code: string
          recipient_name: string
          reference?: string | null
          state: string
          street: string
          updated_at?: string
        }
        Update: {
          city?: string
          complement?: string | null
          country?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean | null
          label?: string
          neighborhood?: string
          number?: string
          postal_code?: string
          recipient_name?: string
          reference?: string | null
          state?: string
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          customer_id: string
          id: string
          is_pinned: boolean | null
          updated_at: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          customer_id: string
          id?: string
          is_pinned?: boolean | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_pinned?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notifications: {
        Row: {
          channel: string
          clicked_at: string | null
          content: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          metadata: Json | null
          opened_at: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
          type: string
        }
        Insert: {
          channel: string
          clicked_at?: string | null
          content?: string | null
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          type: string
        }
        Update: {
          channel?: string
          clicked_at?: string | null
          content?: string | null
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          metadata?: Json | null
          opened_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          customer_id: string
          id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          customer_id: string
          id?: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          customer_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          accepts_marketing: boolean | null
          auth_user_id: string | null
          average_ticket: number | null
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string
          email_verified: boolean | null
          first_order_at: string | null
          full_name: string
          gender: string | null
          id: string
          last_order_at: string | null
          loyalty_points: number | null
          loyalty_tier: string | null
          phone: string | null
          phone_verified: boolean | null
          status: string
          tenant_id: string
          total_orders: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          accepts_marketing?: boolean | null
          auth_user_id?: string | null
          average_ticket?: number | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          email_verified?: boolean | null
          first_order_at?: string | null
          full_name: string
          gender?: string | null
          id?: string
          last_order_at?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          status?: string
          tenant_id: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          accepts_marketing?: boolean | null
          auth_user_id?: string | null
          average_ticket?: number | null
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          email_verified?: boolean | null
          first_order_at?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          last_order_at?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          status?: string
          tenant_id?: string
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_redemptions: {
        Row: {
          amount: number
          created_at: string
          customer_email: string
          discount_id: string
          id: string
          order_id: string | null
          redeemed_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_email: string
          discount_id: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_email?: string
          discount_id?: string
          id?: string
          order_id?: string | null
          redeemed_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discounts: {
        Row: {
          auto_apply_first_purchase: boolean
          code: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          min_subtotal: number | null
          name: string
          starts_at: string | null
          tenant_id: string
          type: string
          updated_at: string
          usage_limit_per_customer: number | null
          usage_limit_total: number | null
          value: number
        }
        Insert: {
          auto_apply_first_purchase?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal?: number | null
          name: string
          starts_at?: string | null
          tenant_id: string
          type: string
          updated_at?: string
          usage_limit_per_customer?: number | null
          usage_limit_total?: number | null
          value?: number
        }
        Update: {
          auto_apply_first_purchase?: boolean
          code?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal?: number | null
          name?: string
          starts_at?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
          usage_limit_per_customer?: number | null
          usage_limit_total?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_attachments: {
        Row: {
          content_id: string | null
          content_type: string | null
          created_at: string
          filename: string
          id: string
          is_inline: boolean | null
          message_id: string
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          filename: string
          id?: string
          is_inline?: boolean | null
          message_id: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          content_id?: string | null
          content_type?: string | null
          created_at?: string
          filename?: string
          id?: string
          is_inline?: boolean | null
          message_id?: string
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "email_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_folders: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_system: boolean | null
          mailbox_id: string
          name: string
          slug: string
          sort_order: number | null
          unread_count: number | null
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean | null
          mailbox_id: string
          name: string
          slug: string
          sort_order?: number | null
          unread_count?: number | null
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_system?: boolean | null
          mailbox_id?: string
          name?: string
          slug?: string
          sort_order?: number | null
          unread_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "email_folders_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          attachment_count: number | null
          bcc_emails: Json | null
          body_html: string | null
          body_text: string | null
          cc_emails: Json | null
          created_at: string
          external_message_id: string | null
          folder_id: string
          from_email: string
          from_name: string | null
          has_attachments: boolean | null
          id: string
          in_reply_to: string | null
          is_draft: boolean | null
          is_read: boolean | null
          is_sent: boolean | null
          is_starred: boolean | null
          labels: string[] | null
          mailbox_id: string
          received_at: string | null
          reply_to: string | null
          sent_at: string | null
          snippet: string | null
          subject: string | null
          tenant_id: string
          thread_id: string | null
          to_emails: Json
          updated_at: string
        }
        Insert: {
          attachment_count?: number | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string
          external_message_id?: string | null
          folder_id: string
          from_email: string
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          in_reply_to?: string | null
          is_draft?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          is_starred?: boolean | null
          labels?: string[] | null
          mailbox_id: string
          received_at?: string | null
          reply_to?: string | null
          sent_at?: string | null
          snippet?: string | null
          subject?: string | null
          tenant_id: string
          thread_id?: string | null
          to_emails?: Json
          updated_at?: string
        }
        Update: {
          attachment_count?: number | null
          bcc_emails?: Json | null
          body_html?: string | null
          body_text?: string | null
          cc_emails?: Json | null
          created_at?: string
          external_message_id?: string | null
          folder_id?: string
          from_email?: string
          from_name?: string | null
          has_attachments?: boolean | null
          id?: string
          in_reply_to?: string | null
          is_draft?: boolean | null
          is_read?: boolean | null
          is_sent?: boolean | null
          is_starred?: boolean | null
          labels?: string[] | null
          mailbox_id?: string
          received_at?: string | null
          reply_to?: string | null
          sent_at?: string | null
          snippet?: string | null
          subject?: string | null
          tenant_id?: string
          thread_id?: string | null
          to_emails?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "email_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_mailbox_id_fkey"
            columns: ["mailbox_id"]
            isOneToOne: false
            referencedRelation: "mailboxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_provider_configs: {
        Row: {
          created_at: string
          dns_all_ok: boolean | null
          dns_records: Json | null
          from_email: string | null
          from_name: string
          id: string
          is_verified: boolean | null
          last_test_at: string | null
          last_test_result: Json | null
          last_verify_check_at: string | null
          last_verify_error: string | null
          provider_type: string
          reply_to: string | null
          resend_domain_id: string | null
          sending_domain: string | null
          support_connection_status: string | null
          support_email_address: string | null
          support_email_enabled: boolean | null
          support_last_error: string | null
          support_reply_from_email: string | null
          support_reply_from_name: string | null
          tenant_id: string
          updated_at: string
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          dns_all_ok?: boolean | null
          dns_records?: Json | null
          from_email?: string | null
          from_name?: string
          id?: string
          is_verified?: boolean | null
          last_test_at?: string | null
          last_test_result?: Json | null
          last_verify_check_at?: string | null
          last_verify_error?: string | null
          provider_type?: string
          reply_to?: string | null
          resend_domain_id?: string | null
          sending_domain?: string | null
          support_connection_status?: string | null
          support_email_address?: string | null
          support_email_enabled?: boolean | null
          support_last_error?: string | null
          support_reply_from_email?: string | null
          support_reply_from_name?: string | null
          tenant_id: string
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          dns_all_ok?: boolean | null
          dns_records?: Json | null
          from_email?: string | null
          from_name?: string
          id?: string
          is_verified?: boolean | null
          last_test_at?: string | null
          last_test_result?: Json | null
          last_verify_check_at?: string | null
          last_verify_error?: string | null
          provider_type?: string
          reply_to?: string | null
          resend_domain_id?: string | null
          sending_domain?: string | null
          support_connection_status?: string | null
          support_email_address?: string | null
          support_email_enabled?: boolean | null
          support_last_error?: string | null
          support_reply_from_email?: string | null
          support_reply_from_name?: string | null
          tenant_id?: string
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_provider_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      events_inbox: {
        Row: {
          created_at: string
          event_type: string
          id: string
          idempotency_key: string
          occurred_at: string
          payload_normalized: Json | null
          payload_raw: Json | null
          processed_at: string | null
          processing_error: string | null
          provider: string
          provider_event_id: string | null
          received_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          idempotency_key: string
          occurred_at?: string
          payload_normalized?: Json | null
          payload_raw?: Json | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
          received_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          idempotency_key?: string
          occurred_at?: string
          payload_normalized?: Json | null
          payload_raw?: Json | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          provider_event_id?: string | null
          received_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_inbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entries: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          description: string
          entry_date: string
          finance_entry_type_id: string | null
          id: string
          notes: string | null
          source: string
          source_id: string | null
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          description: string
          entry_date?: string
          finance_entry_type_id?: string | null
          id?: string
          notes?: string | null
          source?: string
          source_id?: string | null
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          description?: string
          entry_date?: string
          finance_entry_type_id?: string | null
          id?: string
          notes?: string | null
          source?: string
          source_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_finance_entry_type_id_fkey"
            columns: ["finance_entry_type_id"]
            isOneToOne: false
            referencedRelation: "finance_entry_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_entry_types: {
        Row: {
          created_at: string | null
          description: string | null
          entry_type: string
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          entry_type: string
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          entry_type?: string
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_entry_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_inutilizacoes: {
        Row: {
          created_at: string | null
          id: string
          justificativa: string
          numero_final: number
          numero_inicial: number
          protocolo: string | null
          response_data: Json | null
          serie: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          justificativa: string
          numero_final: number
          numero_inicial: number
          protocolo?: string | null
          response_data?: Json | null
          serie: string
          status?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          justificativa?: string
          numero_final?: number
          numero_inicial?: number
          protocolo?: string | null
          response_data?: Json | null
          serie?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_inutilizacoes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoice_cces: {
        Row: {
          correcao: string
          created_at: string | null
          id: string
          invoice_id: string
          numero_sequencia: number
          protocolo: string | null
          response_data: Json | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          correcao: string
          created_at?: string | null
          id?: string
          invoice_id: string
          numero_sequencia: number
          protocolo?: string | null
          response_data?: Json | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          correcao?: string
          created_at?: string | null
          id?: string
          invoice_id?: string
          numero_sequencia?: number
          protocolo?: string | null
          response_data?: Json | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoice_cces_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoice_cces_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoice_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          invoice_id: string
          request_payload: Json | null
          response_payload: Json | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          invoice_id: string
          request_payload?: Json | null
          response_payload?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          invoice_id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoice_events_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoice_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoice_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoice_items: {
        Row: {
          cfop: string
          codigo_produto: string
          created_at: string | null
          csosn: string | null
          cst: string | null
          descricao: string
          id: string
          invoice_id: string
          ncm: string
          numero_item: number
          order_item_id: string | null
          origem: number | null
          quantidade: number
          unidade: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          cfop: string
          codigo_produto: string
          created_at?: string | null
          csosn?: string | null
          cst?: string | null
          descricao: string
          id?: string
          invoice_id: string
          ncm: string
          numero_item: number
          order_item_id?: string | null
          origem?: number | null
          quantidade: number
          unidade?: string | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          cfop?: string
          codigo_produto?: string
          created_at?: string | null
          csosn?: string | null
          cst?: string | null
          descricao?: string
          id?: string
          invoice_id?: string
          ncm?: string
          numero_item?: number
          order_item_id?: string | null
          origem?: number | null
          quantidade?: number
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoice_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_invoices: {
        Row: {
          action_dismissed_at: string | null
          action_reason: string | null
          authorized_at: string | null
          cancel_justificativa: string | null
          cancelled_at: string | null
          cfop: string | null
          chave_acesso: string | null
          created_at: string | null
          danfe_printed_at: string | null
          danfe_url: string | null
          dest_cpf_cnpj: string
          dest_email: string | null
          dest_endereco_bairro: string | null
          dest_endereco_cep: string | null
          dest_endereco_complemento: string | null
          dest_endereco_logradouro: string | null
          dest_endereco_municipio: string | null
          dest_endereco_municipio_codigo: string | null
          dest_endereco_numero: string | null
          dest_endereco_uf: string | null
          dest_inscricao_estadual: string | null
          dest_nome: string
          dest_telefone: string | null
          emitido_por: string | null
          especie_volumes: string | null
          finalidade_emissao: number | null
          focus_ref: string | null
          id: string
          modalidade_frete: string | null
          natureza_operacao: string | null
          nfe_referenciada: string | null
          numero: number
          observacoes: string | null
          order_id: string | null
          peso_bruto: number | null
          peso_liquido: number | null
          printed_at: string | null
          protocolo: string | null
          quantidade_volumes: number | null
          requires_action: boolean | null
          serie: number
          status: string
          status_motivo: string | null
          submitted_at: string | null
          tenant_id: string
          tipo_documento: number | null
          transportadora_cnpj: string | null
          transportadora_nome: string | null
          updated_at: string | null
          valor_desconto: number | null
          valor_frete: number | null
          valor_outras_despesas: number | null
          valor_produtos: number
          valor_seguro: number | null
          valor_total: number
          xml_autorizado: string | null
          xml_url: string | null
        }
        Insert: {
          action_dismissed_at?: string | null
          action_reason?: string | null
          authorized_at?: string | null
          cancel_justificativa?: string | null
          cancelled_at?: string | null
          cfop?: string | null
          chave_acesso?: string | null
          created_at?: string | null
          danfe_printed_at?: string | null
          danfe_url?: string | null
          dest_cpf_cnpj: string
          dest_email?: string | null
          dest_endereco_bairro?: string | null
          dest_endereco_cep?: string | null
          dest_endereco_complemento?: string | null
          dest_endereco_logradouro?: string | null
          dest_endereco_municipio?: string | null
          dest_endereco_municipio_codigo?: string | null
          dest_endereco_numero?: string | null
          dest_endereco_uf?: string | null
          dest_inscricao_estadual?: string | null
          dest_nome: string
          dest_telefone?: string | null
          emitido_por?: string | null
          especie_volumes?: string | null
          finalidade_emissao?: number | null
          focus_ref?: string | null
          id?: string
          modalidade_frete?: string | null
          natureza_operacao?: string | null
          nfe_referenciada?: string | null
          numero: number
          observacoes?: string | null
          order_id?: string | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          printed_at?: string | null
          protocolo?: string | null
          quantidade_volumes?: number | null
          requires_action?: boolean | null
          serie: number
          status?: string
          status_motivo?: string | null
          submitted_at?: string | null
          tenant_id: string
          tipo_documento?: number | null
          transportadora_cnpj?: string | null
          transportadora_nome?: string | null
          updated_at?: string | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_outras_despesas?: number | null
          valor_produtos: number
          valor_seguro?: number | null
          valor_total: number
          xml_autorizado?: string | null
          xml_url?: string | null
        }
        Update: {
          action_dismissed_at?: string | null
          action_reason?: string | null
          authorized_at?: string | null
          cancel_justificativa?: string | null
          cancelled_at?: string | null
          cfop?: string | null
          chave_acesso?: string | null
          created_at?: string | null
          danfe_printed_at?: string | null
          danfe_url?: string | null
          dest_cpf_cnpj?: string
          dest_email?: string | null
          dest_endereco_bairro?: string | null
          dest_endereco_cep?: string | null
          dest_endereco_complemento?: string | null
          dest_endereco_logradouro?: string | null
          dest_endereco_municipio?: string | null
          dest_endereco_municipio_codigo?: string | null
          dest_endereco_numero?: string | null
          dest_endereco_uf?: string | null
          dest_inscricao_estadual?: string | null
          dest_nome?: string
          dest_telefone?: string | null
          emitido_por?: string | null
          especie_volumes?: string | null
          finalidade_emissao?: number | null
          focus_ref?: string | null
          id?: string
          modalidade_frete?: string | null
          natureza_operacao?: string | null
          nfe_referenciada?: string | null
          numero?: number
          observacoes?: string | null
          order_id?: string | null
          peso_bruto?: number | null
          peso_liquido?: number | null
          printed_at?: string | null
          protocolo?: string | null
          quantidade_volumes?: number | null
          requires_action?: boolean | null
          serie?: number
          status?: string
          status_motivo?: string | null
          submitted_at?: string | null
          tenant_id?: string
          tipo_documento?: number | null
          transportadora_cnpj?: string | null
          transportadora_nome?: string | null
          updated_at?: string | null
          valor_desconto?: number | null
          valor_frete?: number | null
          valor_outras_despesas?: number | null
          valor_produtos?: number
          valor_seguro?: number | null
          valor_total?: number
          xml_autorizado?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_invoices_emitido_por_fkey"
            columns: ["emitido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_operation_natures: {
        Row: {
          ativo: boolean | null
          cfop_inter: string
          cfop_intra: string
          codigo: string | null
          consumidor_final: boolean | null
          created_at: string | null
          crt: number | null
          csosn_padrao: string | null
          cst_cofins: string | null
          cst_icms: string | null
          cst_pis: string | null
          descricao: string | null
          faturada: boolean | null
          finalidade: number | null
          id: string
          ind_pres: number | null
          info_complementares: string | null
          info_fisco: string | null
          is_system: boolean | null
          nome: string
          operacao_devolucao: boolean | null
          serie: number | null
          tenant_id: string
          tipo_documento: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cfop_inter: string
          cfop_intra: string
          codigo?: string | null
          consumidor_final?: boolean | null
          created_at?: string | null
          crt?: number | null
          csosn_padrao?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao?: string | null
          faturada?: boolean | null
          finalidade?: number | null
          id?: string
          ind_pres?: number | null
          info_complementares?: string | null
          info_fisco?: string | null
          is_system?: boolean | null
          nome: string
          operacao_devolucao?: boolean | null
          serie?: number | null
          tenant_id: string
          tipo_documento?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cfop_inter?: string
          cfop_intra?: string
          codigo?: string | null
          consumidor_final?: boolean | null
          created_at?: string | null
          crt?: number | null
          csosn_padrao?: string | null
          cst_cofins?: string | null
          cst_icms?: string | null
          cst_pis?: string | null
          descricao?: string | null
          faturada?: boolean | null
          finalidade?: number | null
          id?: string
          ind_pres?: number | null
          info_complementares?: string | null
          info_fisco?: string | null
          is_system?: boolean | null
          nome?: string
          operacao_devolucao?: boolean | null
          serie?: number | null
          tenant_id?: string
          tipo_documento?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_operation_natures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_products: {
        Row: {
          cest: string | null
          cfop_override: string | null
          created_at: string | null
          csosn_override: string | null
          cst_override: string | null
          id: string
          ncm: string | null
          origem: number | null
          product_id: string
          tenant_id: string
          unidade_comercial: string | null
          updated_at: string | null
        }
        Insert: {
          cest?: string | null
          cfop_override?: string | null
          created_at?: string | null
          csosn_override?: string | null
          cst_override?: string | null
          id?: string
          ncm?: string | null
          origem?: number | null
          product_id: string
          tenant_id: string
          unidade_comercial?: string | null
          updated_at?: string | null
        }
        Update: {
          cest?: string | null
          cfop_override?: string | null
          created_at?: string | null
          csosn_override?: string | null
          cst_override?: string | null
          id?: string
          ncm?: string | null
          origem?: number | null
          product_id?: string
          tenant_id?: string
          unidade_comercial?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_settings: {
        Row: {
          ambiente: string | null
          auto_create_shipment: boolean | null
          auto_update_order_status: boolean | null
          certificado_cn: string | null
          certificado_cnpj: string | null
          certificado_pfx: string | null
          certificado_senha: string | null
          certificado_serial: string | null
          certificado_uploaded_at: string | null
          certificado_valido_ate: string | null
          cfop_interestadual: string | null
          cfop_intrastadual: string | null
          cnae: string | null
          cnpj: string | null
          created_at: string | null
          crt: number | null
          csosn_padrao: string | null
          cst_padrao: string | null
          default_shipping_provider: string | null
          desmembrar_estrutura: boolean | null
          email_nfe_body: string | null
          email_nfe_subject: string | null
          emissao_automatica: boolean | null
          emitir_apos_status: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_complemento: string | null
          endereco_logradouro: string | null
          endereco_municipio: string | null
          endereco_municipio_codigo: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          enviar_email_nfe: boolean | null
          focus_ambiente: string | null
          focus_empresa_criada_em: string | null
          focus_empresa_id: string | null
          focus_ultima_sincronizacao: string | null
          id: string
          ie_isento: boolean | null
          inscricao_estadual: string | null
          is_configured: boolean | null
          nome_fantasia: string | null
          numero_nfe_atual: number | null
          provider: string | null
          provider_token: string | null
          razao_social: string | null
          serie_nfe: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ambiente?: string | null
          auto_create_shipment?: boolean | null
          auto_update_order_status?: boolean | null
          certificado_cn?: string | null
          certificado_cnpj?: string | null
          certificado_pfx?: string | null
          certificado_senha?: string | null
          certificado_serial?: string | null
          certificado_uploaded_at?: string | null
          certificado_valido_ate?: string | null
          cfop_interestadual?: string | null
          cfop_intrastadual?: string | null
          cnae?: string | null
          cnpj?: string | null
          created_at?: string | null
          crt?: number | null
          csosn_padrao?: string | null
          cst_padrao?: string | null
          default_shipping_provider?: string | null
          desmembrar_estrutura?: boolean | null
          email_nfe_body?: string | null
          email_nfe_subject?: string | null
          emissao_automatica?: boolean | null
          emitir_apos_status?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_municipio?: string | null
          endereco_municipio_codigo?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          enviar_email_nfe?: boolean | null
          focus_ambiente?: string | null
          focus_empresa_criada_em?: string | null
          focus_empresa_id?: string | null
          focus_ultima_sincronizacao?: string | null
          id?: string
          ie_isento?: boolean | null
          inscricao_estadual?: string | null
          is_configured?: boolean | null
          nome_fantasia?: string | null
          numero_nfe_atual?: number | null
          provider?: string | null
          provider_token?: string | null
          razao_social?: string | null
          serie_nfe?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ambiente?: string | null
          auto_create_shipment?: boolean | null
          auto_update_order_status?: boolean | null
          certificado_cn?: string | null
          certificado_cnpj?: string | null
          certificado_pfx?: string | null
          certificado_senha?: string | null
          certificado_serial?: string | null
          certificado_uploaded_at?: string | null
          certificado_valido_ate?: string | null
          cfop_interestadual?: string | null
          cfop_intrastadual?: string | null
          cnae?: string | null
          cnpj?: string | null
          created_at?: string | null
          crt?: number | null
          csosn_padrao?: string | null
          cst_padrao?: string | null
          default_shipping_provider?: string | null
          desmembrar_estrutura?: boolean | null
          email_nfe_body?: string | null
          email_nfe_subject?: string | null
          emissao_automatica?: boolean | null
          emitir_apos_status?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_municipio?: string | null
          endereco_municipio_codigo?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          enviar_email_nfe?: boolean | null
          focus_ambiente?: string | null
          focus_empresa_criada_em?: string | null
          focus_empresa_id?: string | null
          focus_ultima_sincronizacao?: string | null
          id?: string
          ie_isento?: boolean | null
          inscricao_estadual?: string | null
          is_configured?: boolean | null
          nome_fantasia?: string | null
          numero_nfe_atual?: number | null
          provider?: string | null
          provider_token?: string | null
          razao_social?: string | null
          serie_nfe?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ibge_municipios: {
        Row: {
          codigo: string
          nome: string
          uf: string
        }
        Insert: {
          codigo: string
          nome: string
          uf: string
        }
        Update: {
          codigo?: string
          nome?: string
          uf?: string
        }
        Relationships: []
      }
      import_items: {
        Row: {
          created_at: string
          data_normalized: Json | null
          data_raw: Json | null
          errors: Json | null
          external_id: string | null
          id: string
          internal_id: string | null
          job_id: string
          module: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          data_normalized?: Json | null
          data_raw?: Json | null
          errors?: Json | null
          external_id?: string | null
          id?: string
          internal_id?: string | null
          job_id: string
          module: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          data_normalized?: Json | null
          data_raw?: Json | null
          errors?: Json | null
          external_id?: string | null
          id?: string
          internal_id?: string | null
          job_id?: string
          module?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          errors: Json | null
          id: string
          modules: Json
          platform: string
          progress: Json
          source_data: Json | null
          source_url: string | null
          started_at: string | null
          stats: Json | null
          status: string
          tenant_id: string
          updated_at: string
          warnings: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          errors?: Json | null
          id?: string
          modules?: Json
          platform: string
          progress?: Json
          source_data?: Json | null
          source_url?: string | null
          started_at?: string | null
          stats?: Json | null
          status?: string
          tenant_id: string
          updated_at?: string
          warnings?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          errors?: Json | null
          id?: string
          modules?: Json
          platform?: string
          progress?: Json
          source_data?: Json | null
          source_url?: string | null
          started_at?: string | null
          stats?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mailboxes: {
        Row: {
          auto_reply_enabled: boolean | null
          auto_reply_message: string | null
          created_at: string
          display_name: string | null
          dns_records: Json | null
          dns_verified: boolean | null
          domain: string
          email_address: string
          id: string
          last_dns_check_at: string | null
          last_received_at: string | null
          last_sent_at: string | null
          purpose: Database["public"]["Enums"]["email_purpose"]
          resend_domain_id: string | null
          sending_verified: boolean | null
          signature_html: string | null
          status: Database["public"]["Enums"]["mailbox_status"]
          tenant_id: string
          total_messages: number | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          auto_reply_enabled?: boolean | null
          auto_reply_message?: string | null
          created_at?: string
          display_name?: string | null
          dns_records?: Json | null
          dns_verified?: boolean | null
          domain: string
          email_address: string
          id?: string
          last_dns_check_at?: string | null
          last_received_at?: string | null
          last_sent_at?: string | null
          purpose?: Database["public"]["Enums"]["email_purpose"]
          resend_domain_id?: string | null
          sending_verified?: boolean | null
          signature_html?: string | null
          status?: Database["public"]["Enums"]["mailbox_status"]
          tenant_id: string
          total_messages?: number | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          auto_reply_enabled?: boolean | null
          auto_reply_message?: string | null
          created_at?: string
          display_name?: string | null
          dns_records?: Json | null
          dns_verified?: boolean | null
          domain?: string
          email_address?: string
          id?: string
          last_dns_check_at?: string | null
          last_received_at?: string | null
          last_sent_at?: string | null
          purpose?: Database["public"]["Enums"]["email_purpose"]
          resend_domain_id?: string | null
          sending_verified?: boolean | null
          signature_html?: string | null
          status?: Database["public"]["Enums"]["mailbox_status"]
          tenant_id?: string
          total_messages?: number | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailboxes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_events_log: {
        Row: {
          created_at: string
          event_data: Json | null
          event_id: string
          event_name: string
          event_source: string
          id: string
          order_id: string | null
          provider: string
          provider_error: string | null
          provider_response: Json | null
          provider_status: string | null
          sent_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_id: string
          event_name: string
          event_source: string
          id?: string
          order_id?: string | null
          provider: string
          provider_error?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          sent_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_id?: string
          event_name?: string
          event_source?: string
          id?: string
          order_id?: string | null
          provider?: string
          provider_error?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          sent_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_events_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_events_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_integrations: {
        Row: {
          consent_mode_enabled: boolean
          created_at: string
          google_ads_conversion_id: string | null
          google_ads_conversion_label: string | null
          google_api_secret: string | null
          google_enabled: boolean
          google_last_error: string | null
          google_last_test_at: string | null
          google_measurement_id: string | null
          google_status: string | null
          id: string
          meta_access_token: string | null
          meta_capi_enabled: boolean
          meta_enabled: boolean
          meta_last_error: string | null
          meta_last_test_at: string | null
          meta_pixel_id: string | null
          meta_status: string | null
          tenant_id: string
          tiktok_access_token: string | null
          tiktok_enabled: boolean
          tiktok_events_api_enabled: boolean
          tiktok_last_error: string | null
          tiktok_last_test_at: string | null
          tiktok_pixel_id: string | null
          tiktok_status: string | null
          updated_at: string
        }
        Insert: {
          consent_mode_enabled?: boolean
          created_at?: string
          google_ads_conversion_id?: string | null
          google_ads_conversion_label?: string | null
          google_api_secret?: string | null
          google_enabled?: boolean
          google_last_error?: string | null
          google_last_test_at?: string | null
          google_measurement_id?: string | null
          google_status?: string | null
          id?: string
          meta_access_token?: string | null
          meta_capi_enabled?: boolean
          meta_enabled?: boolean
          meta_last_error?: string | null
          meta_last_test_at?: string | null
          meta_pixel_id?: string | null
          meta_status?: string | null
          tenant_id: string
          tiktok_access_token?: string | null
          tiktok_enabled?: boolean
          tiktok_events_api_enabled?: boolean
          tiktok_last_error?: string | null
          tiktok_last_test_at?: string | null
          tiktok_pixel_id?: string | null
          tiktok_status?: string | null
          updated_at?: string
        }
        Update: {
          consent_mode_enabled?: boolean
          created_at?: string
          google_ads_conversion_id?: string | null
          google_ads_conversion_label?: string | null
          google_api_secret?: string | null
          google_enabled?: boolean
          google_last_error?: string | null
          google_last_test_at?: string | null
          google_measurement_id?: string | null
          google_status?: string | null
          id?: string
          meta_access_token?: string | null
          meta_capi_enabled?: boolean
          meta_enabled?: boolean
          meta_last_error?: string | null
          meta_last_test_at?: string | null
          meta_pixel_id?: string | null
          meta_status?: string | null
          tenant_id?: string
          tiktok_access_token?: string | null
          tiktok_enabled?: boolean
          tiktok_events_api_enabled?: boolean
          tiktok_last_error?: string | null
          tiktok_last_test_at?: string | null
          tiktok_pixel_id?: string | null
          tiktok_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_library: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          tenant_id: string
          variant: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          tenant_id: string
          variant: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          tenant_id?: string
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_library_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string
          id: string
          item_type: string
          label: string
          menu_id: string
          parent_id: string | null
          ref_id: string | null
          sort_order: number | null
          tenant_id: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_type?: string
          label: string
          menu_id: string
          parent_id?: string | null
          ref_id?: string | null
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_type?: string
          label?: string
          menu_id?: string
          parent_id?: string | null
          ref_id?: string | null
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          location: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          location?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          location?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          file_name: string
          file_path: string
          file_size: number | null
          file_url: string | null
          height: number | null
          id: string
          is_safe: boolean | null
          message_id: string
          metadata: Json | null
          mime_type: string | null
          moderation_result: Json | null
          tenant_id: string
          thumbnail_path: string | null
          thumbnail_url: string | null
          transcription: string | null
          width: number | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_url?: string | null
          height?: number | null
          id?: string
          is_safe?: boolean | null
          message_id: string
          metadata?: Json | null
          mime_type?: string | null
          moderation_result?: Json | null
          tenant_id: string
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          transcription?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_url?: string | null
          height?: number | null
          id?: string
          is_safe?: boolean | null
          message_id?: string
          metadata?: Json | null
          mime_type?: string | null
          moderation_result?: Json | null
          tenant_id?: string
          thumbnail_path?: string | null
          thumbnail_url?: string | null
          transcription?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_confidence: number | null
          ai_context_used: Json | null
          ai_model_used: string | null
          channel_metadata: Json | null
          content: string | null
          content_type: string | null
          conversation_id: string
          created_at: string | null
          delivered_at: string | null
          delivery_status:
            | Database["public"]["Enums"]["message_delivery_status"]
            | null
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id: string | null
          failed_at: string | null
          failure_reason: string | null
          id: string
          idempotency_key: string | null
          is_ai_generated: boolean | null
          is_internal: boolean | null
          is_note: boolean | null
          metadata: Json | null
          read_at: string | null
          reply_to_message_id: string | null
          sender_id: string | null
          sender_name: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ai_confidence?: number | null
          ai_context_used?: Json | null
          ai_model_used?: string | null
          channel_metadata?: Json | null
          content?: string | null
          content_type?: string | null
          conversation_id: string
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["message_delivery_status"]
            | null
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          is_ai_generated?: boolean | null
          is_internal?: boolean | null
          is_note?: boolean | null
          metadata?: Json | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ai_confidence?: number | null
          ai_context_used?: Json | null
          ai_model_used?: string | null
          channel_metadata?: Json | null
          content?: string | null
          content_type?: string | null
          conversation_id?: string
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?:
            | Database["public"]["Enums"]["message_delivery_status"]
            | null
          direction?: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          failed_at?: string | null
          failure_reason?: string | null
          id?: string
          idempotency_key?: string | null
          is_ai_generated?: boolean | null
          is_internal?: boolean | null
          is_note?: boolean | null
          metadata?: Json | null
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_attempts: {
        Row: {
          attempt_no: number
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          notification_id: string
          provider_response: Json | null
          started_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          attempt_no?: number
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          notification_id: string
          provider_response?: Json | null
          started_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          attempt_no?: number
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          notification_id?: string
          provider_response?: Json | null
          started_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_attempts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_dedup_ledger: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          notification_id: string | null
          rule_id: string
          scope_key: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          notification_id?: string | null
          rule_id: string
          scope_key?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          notification_id?: string | null
          rule_id?: string
          scope_key?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_dedup_ledger_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_dedup_ledger_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_dedup_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          attachments: Json | null
          attempt_count: number | null
          channel: string
          checkout_session_id: string | null
          content_preview: string | null
          created_at: string
          customer_id: string | null
          error_message: string | null
          id: string
          notification_id: string | null
          order_id: string | null
          recipient: string | null
          rule_id: string | null
          rule_type: string
          scheduled_for: string | null
          sent_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          attempt_count?: number | null
          channel: string
          checkout_session_id?: string | null
          content_preview?: string | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string | null
          order_id?: string | null
          recipient?: string | null
          rule_id?: string | null
          rule_type: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          attempt_count?: number | null
          channel?: string
          checkout_session_id?: string | null
          content_preview?: string | null
          created_at?: string
          customer_id?: string | null
          error_message?: string | null
          id?: string
          notification_id?: string | null
          order_id?: string | null
          recipient?: string | null
          rule_id?: string | null
          rule_type?: string
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          actions: Json | null
          attachments: Json | null
          channels: string[] | null
          created_at: string
          dedupe_scope: string | null
          delay_seconds: number | null
          delay_unit: string | null
          description: string | null
          effective_from: string
          email_body: string | null
          email_subject: string | null
          filters: Json | null
          id: string
          is_enabled: boolean
          name: string
          priority: number
          product_ids: string[] | null
          product_scope: string | null
          rule_type: string | null
          tenant_id: string
          trigger_condition: string | null
          trigger_event_type: string
          updated_at: string
          whatsapp_message: string | null
        }
        Insert: {
          actions?: Json | null
          attachments?: Json | null
          channels?: string[] | null
          created_at?: string
          dedupe_scope?: string | null
          delay_seconds?: number | null
          delay_unit?: string | null
          description?: string | null
          effective_from?: string
          email_body?: string | null
          email_subject?: string | null
          filters?: Json | null
          id?: string
          is_enabled?: boolean
          name: string
          priority?: number
          product_ids?: string[] | null
          product_scope?: string | null
          rule_type?: string | null
          tenant_id: string
          trigger_condition?: string | null
          trigger_event_type: string
          updated_at?: string
          whatsapp_message?: string | null
        }
        Update: {
          actions?: Json | null
          attachments?: Json | null
          channels?: string[] | null
          created_at?: string
          dedupe_scope?: string | null
          delay_seconds?: number | null
          delay_unit?: string | null
          description?: string | null
          effective_from?: string
          email_body?: string | null
          email_subject?: string | null
          filters?: Json | null
          id?: string
          is_enabled?: boolean
          name?: string
          priority?: number
          product_ids?: string[] | null
          product_scope?: string | null
          rule_type?: string | null
          tenant_id?: string
          trigger_condition?: string | null
          trigger_event_type?: string
          updated_at?: string
          whatsapp_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          dedupe_key: string
          event_id: string | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload: Json | null
          recipient: string
          rule_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          template_key: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          created_at?: string
          dedupe_key: string
          event_id?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json | null
          recipient: string
          rule_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template_key?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          dedupe_key?: string
          event_id?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload?: Json | null
          recipient?: string
          rule_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template_key?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "notification_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_rules: {
        Row: {
          created_at: string
          customer_type: string | null
          default_checked: boolean | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          is_active: boolean
          max_items: number | null
          min_order_value: number | null
          name: string
          priority: number
          suggested_product_ids: string[]
          tenant_id: string
          title: string | null
          trigger_product_ids: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_type?: string | null
          default_checked?: boolean | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          max_items?: number | null
          min_order_value?: number | null
          name: string
          priority?: number
          suggested_product_ids?: string[]
          tenant_id: string
          title?: string | null
          trigger_product_ids?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_type?: string | null
          default_checked?: boolean | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          is_active?: boolean
          max_items?: number | null
          min_order_value?: number | null
          name?: string
          priority?: number
          suggested_product_ids?: string[]
          tenant_id?: string
          title?: string | null
          trigger_product_ids?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attribution: {
        Row: {
          attribution_medium: string | null
          attribution_source: string | null
          created_at: string
          fbclid: string | null
          first_touch_at: string | null
          gclid: string | null
          id: string
          landing_page: string | null
          msclkid: string | null
          order_id: string
          referrer_domain: string | null
          referrer_url: string | null
          session_id: string | null
          tenant_id: string
          ttclid: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          attribution_medium?: string | null
          attribution_source?: string | null
          created_at?: string
          fbclid?: string | null
          first_touch_at?: string | null
          gclid?: string | null
          id?: string
          landing_page?: string | null
          msclkid?: string | null
          order_id: string
          referrer_domain?: string | null
          referrer_url?: string | null
          session_id?: string | null
          tenant_id: string
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          attribution_medium?: string | null
          attribution_source?: string | null
          created_at?: string
          fbclid?: string | null
          first_touch_at?: string | null
          gclid?: string | null
          id?: string
          landing_page?: string | null
          msclkid?: string | null
          order_id?: string
          referrer_domain?: string | null
          referrer_url?: string | null
          session_id?: string | null
          tenant_id?: string
          ttclid?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attribution_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attribution_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_history: {
        Row: {
          action: string
          author_id: string | null
          created_at: string
          description: string | null
          id: string
          new_value: Json | null
          order_id: string
          previous_value: Json | null
        }
        Insert: {
          action: string
          author_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          new_value?: Json | null
          order_id: string
          previous_value?: Json | null
        }
        Update: {
          action?: string
          author_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          new_value?: Json | null
          order_id?: string
          previous_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          order_id: string
          product_id: string | null
          product_image_url: string | null
          product_name: string
          quantity: number
          sku: string
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          order_id: string
          product_id?: string | null
          product_image_url?: string | null
          product_name: string
          quantity?: number
          sku: string
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          order_id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string
          quantity?: number
          sku?: string
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_city: string | null
          billing_complement: string | null
          billing_country: string | null
          billing_neighborhood: string | null
          billing_number: string | null
          billing_postal_code: string | null
          billing_state: string | null
          billing_street: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_email: string
          customer_id: string | null
          customer_name: string
          customer_notes: string | null
          customer_phone: string | null
          delivered_at: string | null
          discount_code: string | null
          discount_name: string | null
          discount_total: number
          discount_type: string | null
          free_shipping: boolean
          id: string
          internal_notes: string | null
          order_number: string
          paid_at: string | null
          payment_gateway: string | null
          payment_gateway_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipped_at: string | null
          shipping_carrier: string | null
          shipping_city: string | null
          shipping_complement: string | null
          shipping_country: string | null
          shipping_estimated_days: number | null
          shipping_neighborhood: string | null
          shipping_number: string | null
          shipping_postal_code: string | null
          shipping_service_code: string | null
          shipping_service_name: string | null
          shipping_state: string | null
          shipping_status: Database["public"]["Enums"]["shipping_status"]
          shipping_street: string | null
          shipping_total: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_total: number
          tenant_id: string
          total: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          billing_city?: string | null
          billing_complement?: string | null
          billing_country?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          billing_street?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_email: string
          customer_id?: string | null
          customer_name: string
          customer_notes?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_code?: string | null
          discount_name?: string | null
          discount_total?: number
          discount_type?: string | null
          free_shipping?: boolean
          id?: string
          internal_notes?: string | null
          order_number: string
          paid_at?: string | null
          payment_gateway?: string | null
          payment_gateway_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipped_at?: string | null
          shipping_carrier?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_country?: string | null
          shipping_estimated_days?: number | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_postal_code?: string | null
          shipping_service_code?: string | null
          shipping_service_name?: string | null
          shipping_state?: string | null
          shipping_status?: Database["public"]["Enums"]["shipping_status"]
          shipping_street?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          tenant_id: string
          total?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          billing_city?: string | null
          billing_complement?: string | null
          billing_country?: string | null
          billing_neighborhood?: string | null
          billing_number?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          billing_street?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          customer_notes?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          discount_code?: string | null
          discount_name?: string | null
          discount_total?: number
          discount_type?: string | null
          free_shipping?: boolean
          id?: string
          internal_notes?: string | null
          order_number?: string
          paid_at?: string | null
          payment_gateway?: string | null
          payment_gateway_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipped_at?: string | null
          shipping_carrier?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_country?: string | null
          shipping_estimated_days?: number | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_postal_code?: string | null
          shipping_service_code?: string | null
          shipping_service_name?: string | null
          shipping_state?: string | null
          shipping_status?: Database["public"]["Enums"]["shipping_status"]
          shipping_street?: string | null
          shipping_total?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          tenant_id?: string
          total?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      page_templates: {
        Row: {
          content: Json | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          is_system: boolean | null
          name: string
          slug: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name: string
          slug: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name?: string
          slug?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          processing_result: string | null
          provider: string
          provider_payment_id: string | null
          received_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_result?: string | null
          provider?: string
          provider_payment_id?: string | null
          received_at?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_result?: string | null
          provider?: string
          provider_payment_id?: string | null
          received_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          discount_type: string | null
          discount_value: number | null
          display_name: string
          display_order: number
          id: string
          info_message: string | null
          is_enabled: boolean
          method: string
          provider_id: string | null
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          display_name: string
          display_order?: number
          id?: string
          info_message?: string | null
          is_enabled?: boolean
          method: string
          provider_id?: string | null
          settings?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_type?: string | null
          discount_value?: number | null
          display_name?: string
          display_order?: number
          id?: string
          info_message?: string | null
          is_enabled?: boolean
          method?: string
          provider_id?: string | null
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "payment_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_providers: {
        Row: {
          created_at: string
          credentials: Json
          environment: string
          id: string
          is_enabled: boolean
          provider: string
          settings: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          environment?: string
          id?: string
          is_enabled?: boolean
          provider: string
          settings?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          environment?: string
          id?: string
          is_enabled?: boolean
          provider?: string
          settings?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_providers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          checkout_id: string | null
          created_at: string
          currency: string
          error_message: string | null
          id: string
          method: string
          order_id: string | null
          paid_amount: number | null
          paid_at: string | null
          payment_data: Json
          provider: string
          provider_transaction_id: string | null
          refunded_amount: number | null
          status: string
          tenant_id: string
          updated_at: string
          webhook_payload: Json | null
        }
        Insert: {
          amount: number
          checkout_id?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          method: string
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_data?: Json
          provider: string
          provider_transaction_id?: string | null
          refunded_amount?: number | null
          status?: string
          tenant_id: string
          updated_at?: string
          webhook_payload?: Json | null
        }
        Update: {
          amount?: number
          checkout_id?: string | null
          created_at?: string
          currency?: string
          error_message?: string | null
          id?: string
          method?: string
          order_id?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          payment_data?: Json
          provider?: string
          provider_transaction_id?: string | null
          refunded_amount?: number | null
          status?: string
          tenant_id?: string
          updated_at?: string
          webhook_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string | null
          permissions: Json | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name?: string | null
          permissions?: Json | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string | null
          permissions?: Json | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_credentials: {
        Row: {
          created_at: string
          credential_key: string
          credential_value: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_test_success: boolean | null
          last_tested_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          credential_key: string
          credential_value?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_test_success?: boolean | null
          last_tested_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          credential_key?: string
          credential_value?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_test_success?: boolean | null
          last_tested_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      post_sale_backfill_items: {
        Row: {
          created_at: string
          customer_id: string
          error_message: string | null
          id: string
          job_id: string
          processed_at: string | null
          scheduled_for: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          error_message?: string | null
          id?: string
          job_id: string
          processed_at?: string | null
          scheduled_for: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          error_message?: string | null
          id?: string
          job_id?: string
          processed_at?: string | null
          scheduled_for?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_backfill_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_backfill_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "post_sale_backfill_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_sale_backfill_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      post_sale_backfill_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          error_message: string | null
          id: string
          processed_customers: number
          rate_limit_per_hour: number
          started_at: string | null
          status: string
          tenant_id: string
          total_customers: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          id?: string
          processed_customers?: number
          rate_limit_per_hour?: number
          started_at?: string | null
          status?: string
          tenant_id: string
          total_customers?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          id?: string
          processed_customers?: number
          rate_limit_per_hour?: number
          started_at?: string | null
          status?: string
          tenant_id?: string
          total_customers?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_sale_backfill_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          position: number | null
          product_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          position?: number | null
          product_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          position?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_components: {
        Row: {
          component_product_id: string
          cost_price: number | null
          created_at: string | null
          id: string
          parent_product_id: string
          quantity: number
          sale_price: number | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          component_product_id: string
          cost_price?: number | null
          created_at?: string | null
          id?: string
          parent_product_id: string
          quantity?: number
          sale_price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          component_product_id?: string
          cost_price?: number | null
          created_at?: string | null
          id?: string
          parent_product_id?: string
          quantity?: number
          sale_price?: number | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_components_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_components_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_feed_status: {
        Row: {
          created_at: string
          error_count: number | null
          feed_path: string | null
          feed_type: string
          id: string
          last_error: string | null
          last_generated_at: string | null
          product_count: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_count?: number | null
          feed_path?: string | null
          feed_type: string
          id?: string
          last_error?: string | null
          last_generated_at?: string | null
          product_count?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_count?: number | null
          feed_path?: string | null
          feed_type?: string
          id?: string
          last_error?: string | null
          last_generated_at?: string | null
          product_count?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_feed_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          is_primary: boolean | null
          product_id: string
          sort_order: number | null
          url: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          product_id: string
          sort_order?: number | null
          url: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean | null
          product_id?: string
          sort_order?: number | null
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          content: string | null
          created_at: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          id: string
          is_verified_purchase: boolean | null
          product_id: string
          rating: number
          status: string
          tenant_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          is_verified_purchase?: boolean | null
          product_id: string
          rating: number
          status?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          content?: string | null
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          is_verified_purchase?: boolean | null
          product_id?: string
          rating?: number
          status?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          gtin: string | null
          id: string
          is_active: boolean | null
          name: string
          option1_name: string | null
          option1_value: string | null
          option2_name: string | null
          option2_value: string | null
          option3_name: string | null
          option3_value: string | null
          price: number | null
          product_id: string
          promotion_end_date: string | null
          promotion_start_date: string | null
          sku: string
          stock_quantity: number
          updated_at: string
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          option1_name?: string | null
          option1_value?: string | null
          option2_name?: string | null
          option2_value?: string | null
          option3_name?: string | null
          option3_value?: string | null
          price?: number | null
          product_id: string
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          sku: string
          stock_quantity?: number
          updated_at?: string
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          option1_name?: string | null
          option1_value?: string | null
          option2_name?: string | null
          option2_value?: string | null
          option3_name?: string | null
          option3_value?: string | null
          price?: number | null
          product_id?: string
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          sku?: string
          stock_quantity?: number
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          allow_backorder: boolean | null
          barcode: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          depth: number | null
          description: string | null
          gtin: string | null
          has_variants: boolean | null
          height: number | null
          id: string
          is_featured: boolean | null
          low_stock_threshold: number | null
          manage_stock: boolean | null
          name: string
          ncm: string | null
          price: number
          product_format: string | null
          promotion_end_date: string | null
          promotion_start_date: string | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string
          slug: string
          status: string
          stock_quantity: number
          stock_type: string | null
          tenant_id: string
          updated_at: string
          weight: number | null
          width: number | null
        }
        Insert: {
          allow_backorder?: boolean | null
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          depth?: number | null
          description?: string | null
          gtin?: string | null
          has_variants?: boolean | null
          height?: number | null
          id?: string
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          manage_stock?: boolean | null
          name: string
          ncm?: string | null
          price: number
          product_format?: string | null
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku: string
          slug: string
          status?: string
          stock_quantity?: number
          stock_type?: string | null
          tenant_id: string
          updated_at?: string
          weight?: number | null
          width?: number | null
        }
        Update: {
          allow_backorder?: boolean | null
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          depth?: number | null
          description?: string | null
          gtin?: string | null
          has_variants?: boolean | null
          height?: number | null
          id?: string
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          manage_stock?: boolean | null
          name?: string
          ncm?: string | null
          price?: number
          product_format?: string | null
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string
          slug?: string
          status?: string
          stock_quantity?: number
          stock_type?: string | null
          tenant_id?: string
          updated_at?: string
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_tenant_id: string | null
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_tenant_id?: string | null
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_tenant_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_tenant_id_fkey"
            columns: ["current_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          description: string
          id: string
          product_id: string | null
          purchase_id: string
          quantity: number
          tenant_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          product_id?: string | null
          purchase_id: string
          quantity?: number
          tenant_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          product_id?: string | null
          purchase_id?: string
          quantity?: number
          tenant_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          actual_delivery_date: string | null
          created_at: string
          description: string | null
          entry_invoice_id: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_number: string
          purchase_type_id: string | null
          status: string
          supplier_id: string | null
          tenant_id: string
          total_value: number
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string
          description?: string | null
          entry_invoice_id?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          purchase_type_id?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id: string
          total_value?: number
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string
          description?: string | null
          entry_invoice_id?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          purchase_type_id?: string | null
          status?: string
          supplier_id?: string | null
          tenant_id?: string
          total_value?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_entry_invoice_id_fkey"
            columns: ["entry_invoice_id"]
            isOneToOne: false
            referencedRelation: "fiscal_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_purchase_type_id_fkey"
            columns: ["purchase_type_id"]
            isOneToOne: false
            referencedRelation: "purchase_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          category: string | null
          channels: Database["public"]["Enums"]["support_channel_type"][] | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          shortcut: string | null
          tags: string[] | null
          tenant_id: string
          title: string
          updated_at: string | null
          use_count: number | null
          variables: string[] | null
        }
        Insert: {
          category?: string | null
          channels?:
            | Database["public"]["Enums"]["support_channel_type"][]
            | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          shortcut?: string | null
          tags?: string[] | null
          tenant_id: string
          title: string
          updated_at?: string | null
          use_count?: number | null
          variables?: string[] | null
        }
        Update: {
          category?: string | null
          channels?:
            | Database["public"]["Enums"]["support_channel_type"][]
            | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          shortcut?: string | null
          tags?: string[] | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
          use_count?: number | null
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      related_products: {
        Row: {
          created_at: string
          id: string
          position: number | null
          product_id: string
          related_product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number | null
          product_id: string
          related_product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number | null
          product_id?: string
          related_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "related_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "related_products_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_system_emails: {
        Row: {
          attempts: number | null
          created_at: string
          email: string
          error_message: string | null
          id: string
          provider_message_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          template_key: string
          updated_at: string
          user_id: string
          user_name: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          template_key: string
          updated_at?: string
          user_id: string
          user_name?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          provider_message_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          template_key?: string
          updated_at?: string
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      shipment_events: {
        Row: {
          created_at: string
          description: string | null
          id: string
          location: string | null
          occurred_at: string
          provider_event_id: string | null
          raw_payload: Json | null
          shipment_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          provider_event_id?: string | null
          raw_payload?: Json | null
          shipment_id: string
          status: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          occurred_at?: string
          provider_event_id?: string | null
          raw_payload?: Json | null
          shipment_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_events_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string
          created_at: string
          delivered_at: string | null
          delivery_status: Database["public"]["Enums"]["delivery_status"]
          estimated_delivery_at: string | null
          id: string
          last_poll_error: string | null
          last_polled_at: string | null
          last_status_at: string
          metadata: Json | null
          next_poll_at: string | null
          order_id: string
          poll_error_count: number | null
          source: string | null
          source_id: string | null
          tenant_id: string
          tracking_code: string
          updated_at: string
        }
        Insert: {
          carrier: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          estimated_delivery_at?: string | null
          id?: string
          last_poll_error?: string | null
          last_polled_at?: string | null
          last_status_at?: string
          metadata?: Json | null
          next_poll_at?: string | null
          order_id: string
          poll_error_count?: number | null
          source?: string | null
          source_id?: string | null
          tenant_id: string
          tracking_code: string
          updated_at?: string
        }
        Update: {
          carrier?: string
          created_at?: string
          delivered_at?: string | null
          delivery_status?: Database["public"]["Enums"]["delivery_status"]
          estimated_delivery_at?: string | null
          id?: string
          last_poll_error?: string | null
          last_polled_at?: string | null
          last_status_at?: string
          metadata?: Json | null
          next_poll_at?: string | null
          order_id?: string
          poll_error_count?: number | null
          source?: string | null
          source_id?: string | null
          tenant_id?: string
          tracking_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_providers: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          is_enabled: boolean
          provider: string
          settings: Json
          supports_quote: boolean
          supports_tracking: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          is_enabled?: boolean
          provider: string
          settings?: Json
          supports_quote?: boolean
          supports_tracking?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          is_enabled?: boolean
          provider?: string
          settings?: Json
          supports_quote?: boolean
          supports_tracking?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_providers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      special_tenants: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          notes: string | null
          reason: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          reason: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          reason?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_page_versions: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          entity_type: string
          id: string
          page_id: string | null
          page_type: string | null
          status: string
          tenant_id: string
          updated_at: string
          version: number
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          entity_type: string
          id?: string
          page_id?: string | null
          page_type?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          entity_type?: string
          id?: string
          page_id?: string | null
          page_type?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "store_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_page_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pages: {
        Row: {
          builder_enabled: boolean | null
          canonical_url: string | null
          content: Json | null
          created_at: string
          draft_version: number | null
          id: string
          individual_content: string | null
          is_homepage: boolean | null
          is_published: boolean | null
          is_system: boolean | null
          menu_label: string | null
          menu_order: number | null
          meta_description: string | null
          meta_image_url: string | null
          meta_title: string | null
          no_index: boolean | null
          page_overrides: Json | null
          published_version: number | null
          seo_description: string | null
          seo_title: string | null
          show_in_menu: boolean | null
          slug: string
          status: string | null
          template_id: string | null
          tenant_id: string
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          builder_enabled?: boolean | null
          canonical_url?: string | null
          content?: Json | null
          created_at?: string
          draft_version?: number | null
          id?: string
          individual_content?: string | null
          is_homepage?: boolean | null
          is_published?: boolean | null
          is_system?: boolean | null
          menu_label?: string | null
          menu_order?: number | null
          meta_description?: string | null
          meta_image_url?: string | null
          meta_title?: string | null
          no_index?: boolean | null
          page_overrides?: Json | null
          published_version?: number | null
          seo_description?: string | null
          seo_title?: string | null
          show_in_menu?: boolean | null
          slug: string
          status?: string | null
          template_id?: string | null
          tenant_id: string
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          builder_enabled?: boolean | null
          canonical_url?: string | null
          content?: Json | null
          created_at?: string
          draft_version?: number | null
          id?: string
          individual_content?: string | null
          is_homepage?: boolean | null
          is_published?: boolean | null
          is_system?: boolean | null
          menu_label?: string | null
          menu_order?: number | null
          meta_description?: string | null
          meta_image_url?: string | null
          meta_title?: string | null
          no_index?: boolean | null
          page_overrides?: Json | null
          published_version?: number | null
          seo_description?: string | null
          seo_title?: string | null
          show_in_menu?: boolean | null
          slug?: string
          status?: string | null
          template_id?: string | null
          tenant_id?: string
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "page_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          accent_color: string | null
          benefit_config: Json | null
          business_cnpj: string | null
          business_legal_name: string | null
          cart_config: Json | null
          checkout_config: Json | null
          contact_address: string | null
          contact_email: string | null
          contact_phone: string | null
          contact_support_hours: string | null
          created_at: string
          custom_css: string | null
          custom_scripts: string | null
          facebook_pixel_id: string | null
          favicon_url: string | null
          footer_style: string | null
          google_analytics_id: string | null
          header_style: string | null
          id: string
          is_published: boolean | null
          logo_url: string | null
          offers_config: Json | null
          primary_color: string | null
          secondary_color: string | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          shipping_config: Json | null
          social_custom: Json | null
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_whatsapp: string | null
          social_youtube: string | null
          store_description: string | null
          store_name: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          benefit_config?: Json | null
          business_cnpj?: string | null
          business_legal_name?: string | null
          cart_config?: Json | null
          checkout_config?: Json | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_support_hours?: string | null
          created_at?: string
          custom_css?: string | null
          custom_scripts?: string | null
          facebook_pixel_id?: string | null
          favicon_url?: string | null
          footer_style?: string | null
          google_analytics_id?: string | null
          header_style?: string | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          offers_config?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          shipping_config?: Json | null
          social_custom?: Json | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_whatsapp?: string | null
          social_youtube?: string | null
          store_description?: string | null
          store_name?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          benefit_config?: Json | null
          business_cnpj?: string | null
          business_legal_name?: string | null
          cart_config?: Json | null
          checkout_config?: Json | null
          contact_address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contact_support_hours?: string | null
          created_at?: string
          custom_css?: string | null
          custom_scripts?: string | null
          facebook_pixel_id?: string | null
          favicon_url?: string | null
          footer_style?: string | null
          google_analytics_id?: string | null
          header_style?: string | null
          id?: string
          is_published?: boolean | null
          logo_url?: string | null
          offers_config?: Json | null
          primary_color?: string | null
          secondary_color?: string | null
          seo_description?: string | null
          seo_keywords?: string[] | null
          seo_title?: string | null
          shipping_config?: Json | null
          social_custom?: Json | null
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_whatsapp?: string | null
          social_youtube?: string | null
          store_description?: string | null
          store_name?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_global_layout: {
        Row: {
          checkout_footer_config: Json
          checkout_header_config: Json
          created_at: string
          footer_config: Json
          footer_enabled: boolean
          header_config: Json
          header_enabled: boolean
          id: string
          show_footer_1: boolean
          show_footer_2: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          checkout_footer_config?: Json
          checkout_header_config?: Json
          created_at?: string
          footer_config?: Json
          footer_enabled?: boolean
          header_config?: Json
          header_enabled?: boolean
          id?: string
          show_footer_1?: boolean
          show_footer_2?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          checkout_footer_config?: Json
          checkout_header_config?: Json
          created_at?: string
          footer_config?: Json
          footer_enabled?: boolean
          header_config?: Json
          header_enabled?: boolean
          id?: string
          show_footer_1?: boolean
          show_footer_2?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_global_layout_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_page_templates: {
        Row: {
          created_at: string
          draft_version: number | null
          id: string
          page_overrides: Json | null
          page_type: string
          published_version: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          draft_version?: number | null
          id?: string
          page_overrides?: Json | null
          page_type: string
          published_version?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          draft_version?: number | null
          id?: string
          page_overrides?: Json | null
          page_type?: string
          published_version?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_page_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_runtime_violations: {
        Row: {
          created_at: string
          details: Json | null
          host: string
          id: string
          path: string
          resolved_at: string | null
          source: string | null
          tenant_id: string
          violation_type: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          host: string
          id?: string
          path: string
          resolved_at?: string | null
          source?: string | null
          tenant_id: string
          violation_type: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          host?: string
          id?: string
          path?: string
          resolved_at?: string | null
          source?: string | null
          tenant_id?: string
          violation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_runtime_violations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_templates: {
        Row: {
          id: string
          page_type: string
          template_json: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          page_type: string
          template_json?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          page_type?: string
          template_json?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_types: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          cnpj: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          supplier_type_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          supplier_type_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          supplier_type_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_supplier_type_id_fkey"
            columns: ["supplier_type_id"]
            isOneToOne: false
            referencedRelation: "supplier_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_stats_daily: {
        Row: {
          avg_first_response_time: number | null
          avg_resolution_time: number | null
          channel_type:
            | Database["public"]["Enums"]["support_channel_type"]
            | null
          conversations_new: number | null
          conversations_resolved: number | null
          created_at: string | null
          csat_responses: number | null
          csat_total_score: number | null
          id: string
          messages_by_agent: number | null
          messages_by_ai: number | null
          messages_inbound: number | null
          messages_outbound: number | null
          stat_date: string
          tenant_id: string
        }
        Insert: {
          avg_first_response_time?: number | null
          avg_resolution_time?: number | null
          channel_type?:
            | Database["public"]["Enums"]["support_channel_type"]
            | null
          conversations_new?: number | null
          conversations_resolved?: number | null
          created_at?: string | null
          csat_responses?: number | null
          csat_total_score?: number | null
          id?: string
          messages_by_agent?: number | null
          messages_by_ai?: number | null
          messages_inbound?: number | null
          messages_outbound?: number | null
          stat_date: string
          tenant_id: string
        }
        Update: {
          avg_first_response_time?: number | null
          avg_resolution_time?: number | null
          channel_type?:
            | Database["public"]["Enums"]["support_channel_type"]
            | null
          conversations_new?: number | null
          conversations_resolved?: number | null
          created_at?: string | null
          csat_responses?: number | null
          csat_total_score?: number | null
          id?: string
          messages_by_agent?: number | null
          messages_by_ai?: number | null
          messages_inbound?: number | null
          messages_outbound?: number | null
          stat_date?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_stats_daily_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_email_config: {
        Row: {
          created_at: string
          dns_records: Json | null
          from_email: string
          from_name: string
          id: string
          last_test_at: string | null
          last_test_result: Json | null
          last_verify_check_at: string | null
          last_verify_error: string | null
          provider_type: string
          reply_to: string | null
          resend_domain_id: string | null
          sending_domain: string | null
          updated_at: string
          verification_status: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          dns_records?: Json | null
          from_email?: string
          from_name?: string
          id?: string
          last_test_at?: string | null
          last_test_result?: Json | null
          last_verify_check_at?: string | null
          last_verify_error?: string | null
          provider_type?: string
          reply_to?: string | null
          resend_domain_id?: string | null
          sending_domain?: string | null
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          dns_records?: Json | null
          from_email?: string
          from_name?: string
          id?: string
          last_test_at?: string | null
          last_test_result?: Json | null
          last_verify_check_at?: string | null
          last_verify_error?: string | null
          provider_type?: string
          reply_to?: string | null
          resend_domain_id?: string | null
          sending_domain?: string | null
          updated_at?: string
          verification_status?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      system_email_logs: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          metadata: Json | null
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      system_email_templates: {
        Row: {
          auto_send: boolean | null
          body_html: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          send_delay_minutes: number | null
          subject: string
          template_key: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          auto_send?: boolean | null
          body_html: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          send_delay_minutes?: number | null
          subject: string
          template_key: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          auto_send?: boolean | null
          body_html?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          send_delay_minutes?: number | null
          subject?: string
          template_key?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      system_health_check_targets: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          label: string
          shops_base_url: string | null
          storefront_base_url: string
          tenant_id: string
          test_coupon_code: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          label: string
          shops_base_url?: string | null
          storefront_base_url: string
          tenant_id: string
          test_coupon_code?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          label?: string
          shops_base_url?: string | null
          storefront_base_url?: string
          tenant_id?: string
          test_coupon_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_health_check_targets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health_checks: {
        Row: {
          check_suite: string
          created_at: string
          details: Json | null
          duration_ms: number | null
          environment: string
          id: string
          ran_at: string
          status: string
          summary: string | null
          target_id: string | null
          tenant_id: string
        }
        Insert: {
          check_suite: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          environment?: string
          id?: string
          ran_at?: string
          status: string
          summary?: string | null
          target_id?: string | null
          tenant_id: string
        }
        Update: {
          check_suite?: string
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          environment?: string
          id?: string
          ran_at?: string
          status?: string
          summary?: string | null
          target_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_health_checks_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "system_health_check_targets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_health_checks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          created_at: string
          domain: string
          external_id: string | null
          id: string
          is_primary: boolean
          last_checked_at: string | null
          last_error: string | null
          ssl_status: string | null
          status: string
          target_hostname: string | null
          tenant_id: string
          type: string
          updated_at: string
          verification_token: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          external_id?: string | null
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          ssl_status?: string | null
          status?: string
          target_hostname?: string | null
          tenant_id: string
          type?: string
          updated_at?: string
          verification_token: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          external_id?: string | null
          id?: string
          is_primary?: boolean
          last_checked_at?: string | null
          last_error?: string | null
          ssl_status?: string | null
          status?: string
          target_hostname?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_shipping_integrations: {
        Row: {
          carrier: string
          created_at: string
          credentials: Json
          id: string
          is_enabled: boolean
          settings: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          carrier: string
          created_at?: string
          credentials?: Json
          id?: string
          is_enabled?: boolean
          settings?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          carrier?: string
          created_at?: string
          credentials?: Json
          id?: string
          is_enabled?: boolean
          settings?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_shipping_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          next_order_number: number
          settings: Json | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          next_order_number?: number
          settings?: Json | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          next_order_number?: number
          settings?: Json | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_secrets: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          provider: string
          secret: string
          secret_hash: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          provider: string
          secret: string
          secret_hash?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          provider?: string
          secret?: string
          secret_hash?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_secrets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_configs: {
        Row: {
          client_token: string | null
          connection_status: string | null
          created_at: string
          id: string
          instance_id: string | null
          instance_token: string | null
          is_enabled: boolean | null
          last_connected_at: string | null
          last_disconnected_at: string | null
          last_error: string | null
          phone_number: string | null
          provider: string
          qr_code: string | null
          qr_expires_at: string | null
          tenant_id: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          client_token?: string | null
          connection_status?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          is_enabled?: boolean | null
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          last_error?: string | null
          phone_number?: string | null
          provider?: string
          qr_code?: string | null
          qr_expires_at?: string | null
          tenant_id: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          client_token?: string | null
          connection_status?: string | null
          created_at?: string
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          is_enabled?: boolean | null
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          last_error?: string | null
          phone_number?: string | null
          provider?: string
          qr_code?: string | null
          qr_expires_at?: string | null
          tenant_id?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          delivered_at: string | null
          error_message: string | null
          failed_at: string | null
          id: string
          message_content: string | null
          message_id_provider: string | null
          message_type: string | null
          metadata: Json | null
          notification_id: string | null
          provider_message_id: string | null
          provider_response: Json | null
          read_at: string | null
          recipient_phone: string
          sent_at: string | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message_content?: string | null
          message_id_provider?: string | null
          message_type?: string | null
          metadata?: Json | null
          notification_id?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          read_at?: string | null
          recipient_phone: string
          sent_at?: string | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          error_message?: string | null
          failed_at?: string | null
          id?: string
          message_content?: string | null
          message_id_provider?: string | null
          message_type?: string | null
          metadata?: Json | null
          notification_id?: string | null
          provider_message_id?: string | null
          provider_response?: Json | null
          read_at?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_tenant_for_user: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          next_order_number: number
          settings: Json | null
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_order_number: { Args: { p_tenant_id: string }; Returns: string }
      get_current_tenant_id: { Args: { _user_id: string }; Returns: string }
      get_discount_usage: { Args: { p_discount_id: string }; Returns: number }
      get_discount_usage_by_customer: {
        Args: { p_discount_id: string; p_email: string }
        Returns: number
      }
      get_ibge_municipio_codigo: {
        Args: { p_cidade: string; p_uf: string }
        Returns: string
      }
      get_public_marketing_config: {
        Args: { p_tenant_id: string }
        Returns: {
          consent_mode_enabled: boolean
          google_ads_conversion_id: string
          google_ads_conversion_label: string
          google_enabled: boolean
          google_measurement_id: string
          meta_enabled: boolean
          meta_pixel_id: string
          tiktok_enabled: boolean
          tiktok_pixel_id: string
        }[]
      }
      get_whatsapp_config_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: {
          connection_status: string
          created_at: string
          id: string
          instance_id: string
          is_enabled: boolean
          last_connected_at: string
          last_error: string
          phone_number: string
          provider: string
          qr_code: string
          qr_expires_at: string
          tenant_id: string
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      increment_blog_view_count: {
        Args: { post_id: string }
        Returns: undefined
      }
      initialize_default_page_template: {
        Args: { p_tenant_id: string }
        Returns: string
      }
      initialize_storefront_templates: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      initialize_system_pages: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      is_platform_admin: { Args: never; Returns: boolean }
      user_belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "operator"
        | "support"
        | "finance"
        | "viewer"
      conversation_status:
        | "new"
        | "open"
        | "waiting_customer"
        | "waiting_agent"
        | "bot"
        | "resolved"
        | "spam"
      delivery_status:
        | "label_created"
        | "posted"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "failed"
        | "returned"
        | "canceled"
        | "unknown"
      email_purpose: "notifications" | "support" | "manual"
      mailbox_status: "pending_dns" | "active" | "error" | "disabled"
      message_delivery_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
      message_direction: "inbound" | "outbound"
      message_sender_type: "customer" | "agent" | "bot" | "system"
      order_status:
        | "pending"
        | "awaiting_payment"
        | "paid"
        | "processing"
        | "shipped"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "returned"
      payment_method:
        | "pix"
        | "credit_card"
        | "debit_card"
        | "boleto"
        | "mercado_pago"
        | "pagarme"
      payment_status:
        | "pending"
        | "processing"
        | "approved"
        | "declined"
        | "refunded"
        | "cancelled"
      shipping_status:
        | "pending"
        | "processing"
        | "shipped"
        | "in_transit"
        | "out_for_delivery"
        | "delivered"
        | "returned"
        | "failed"
      support_channel_type:
        | "whatsapp"
        | "email"
        | "facebook_messenger"
        | "instagram_dm"
        | "mercadolivre"
        | "shopee"
        | "chat"
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
      app_role: ["owner", "admin", "operator", "support", "finance", "viewer"],
      conversation_status: [
        "new",
        "open",
        "waiting_customer",
        "waiting_agent",
        "bot",
        "resolved",
        "spam",
      ],
      delivery_status: [
        "label_created",
        "posted",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "failed",
        "returned",
        "canceled",
        "unknown",
      ],
      email_purpose: ["notifications", "support", "manual"],
      mailbox_status: ["pending_dns", "active", "error", "disabled"],
      message_delivery_status: [
        "queued",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
      message_direction: ["inbound", "outbound"],
      message_sender_type: ["customer", "agent", "bot", "system"],
      order_status: [
        "pending",
        "awaiting_payment",
        "paid",
        "processing",
        "shipped",
        "in_transit",
        "delivered",
        "cancelled",
        "returned",
      ],
      payment_method: [
        "pix",
        "credit_card",
        "debit_card",
        "boleto",
        "mercado_pago",
        "pagarme",
      ],
      payment_status: [
        "pending",
        "processing",
        "approved",
        "declined",
        "refunded",
        "cancelled",
      ],
      shipping_status: [
        "pending",
        "processing",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "returned",
        "failed",
      ],
      support_channel_type: [
        "whatsapp",
        "email",
        "facebook_messenger",
        "instagram_dm",
        "mercadolivre",
        "shopee",
        "chat",
      ],
    },
  },
} as const
