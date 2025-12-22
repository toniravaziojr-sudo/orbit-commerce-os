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
      checkout_sessions: {
        Row: {
          abandoned_at: string | null
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
          location: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
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
      notification_rules: {
        Row: {
          actions: Json | null
          created_at: string
          dedupe_scope: string | null
          description: string | null
          filters: Json | null
          id: string
          is_enabled: boolean
          name: string
          priority: number
          tenant_id: string
          trigger_event_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          created_at?: string
          dedupe_scope?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_enabled?: boolean
          name: string
          priority?: number
          tenant_id: string
          trigger_event_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          created_at?: string
          dedupe_scope?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_enabled?: boolean
          name?: string
          priority?: number
          tenant_id?: string
          trigger_event_type?: string
          updated_at?: string
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
          promotion_end_date: string | null
          promotion_start_date: string | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string
          slug: string
          status: string
          stock_quantity: number
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
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku: string
          slug: string
          status?: string
          stock_quantity?: number
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
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string
          slug?: string
          status?: string
          stock_quantity?: number
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
          is_homepage: boolean | null
          is_published: boolean | null
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
          is_homepage?: boolean | null
          is_published?: boolean | null
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
          is_homepage?: boolean | null
          is_published?: boolean | null
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
          tenant_id?: string
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
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
          header_config: Json
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          checkout_footer_config?: Json
          checkout_header_config?: Json
          created_at?: string
          footer_config?: Json
          header_config?: Json
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          checkout_footer_config?: Json
          checkout_header_config?: Json
          created_at?: string
          footer_config?: Json
          header_config?: Json
          id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      initialize_storefront_templates: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
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
    },
  },
} as const
