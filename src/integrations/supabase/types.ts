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
      ads_autopilot_account_configs: {
        Row: {
          ad_account_id: string
          budget_cents: number | null
          budget_mode: string | null
          channel: string
          chat_overrides: Json | null
          created_at: string | null
          funnel_split_mode: string | null
          funnel_splits: Json | null
          human_approval_mode: string | null
          id: string
          is_ai_enabled: boolean | null
          kill_switch: boolean | null
          last_budget_adjusted_at: string | null
          lock_expires_at: string | null
          lock_session_id: string | null
          min_roi_cold: number | null
          min_roi_warm: number | null
          roas_scaling_threshold: number | null
          strategy_mode: string | null
          target_roi: number | null
          tenant_id: string
          updated_at: string | null
          user_instructions: string | null
        }
        Insert: {
          ad_account_id: string
          budget_cents?: number | null
          budget_mode?: string | null
          channel: string
          chat_overrides?: Json | null
          created_at?: string | null
          funnel_split_mode?: string | null
          funnel_splits?: Json | null
          human_approval_mode?: string | null
          id?: string
          is_ai_enabled?: boolean | null
          kill_switch?: boolean | null
          last_budget_adjusted_at?: string | null
          lock_expires_at?: string | null
          lock_session_id?: string | null
          min_roi_cold?: number | null
          min_roi_warm?: number | null
          roas_scaling_threshold?: number | null
          strategy_mode?: string | null
          target_roi?: number | null
          tenant_id: string
          updated_at?: string | null
          user_instructions?: string | null
        }
        Update: {
          ad_account_id?: string
          budget_cents?: number | null
          budget_mode?: string | null
          channel?: string
          chat_overrides?: Json | null
          created_at?: string | null
          funnel_split_mode?: string | null
          funnel_splits?: Json | null
          human_approval_mode?: string | null
          id?: string
          is_ai_enabled?: boolean | null
          kill_switch?: boolean | null
          last_budget_adjusted_at?: string | null
          lock_expires_at?: string | null
          lock_session_id?: string | null
          min_roi_cold?: number | null
          min_roi_warm?: number | null
          roas_scaling_threshold?: number | null
          strategy_mode?: string | null
          target_roi?: number | null
          tenant_id?: string
          updated_at?: string | null
          user_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_autopilot_account_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_autopilot_actions: {
        Row: {
          action_data: Json | null
          action_hash: string | null
          action_type: string
          channel: string
          confidence: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          expected_impact: string | null
          id: string
          metric_trigger: string | null
          reasoning: string | null
          rejection_reason: string | null
          rollback_data: Json | null
          session_id: string
          status: string
          tenant_id: string
        }
        Insert: {
          action_data?: Json | null
          action_hash?: string | null
          action_type: string
          channel: string
          confidence?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          expected_impact?: string | null
          id?: string
          metric_trigger?: string | null
          reasoning?: string | null
          rejection_reason?: string | null
          rollback_data?: Json | null
          session_id: string
          status?: string
          tenant_id: string
        }
        Update: {
          action_data?: Json | null
          action_hash?: string | null
          action_type?: string
          channel?: string
          confidence?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          expected_impact?: string | null
          id?: string
          metric_trigger?: string | null
          reasoning?: string | null
          rejection_reason?: string | null
          rollback_data?: Json | null
          session_id?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_autopilot_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ads_autopilot_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_autopilot_actions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_autopilot_artifacts: {
        Row: {
          ad_account_id: string | null
          artifact_type: string
          campaign_key: string
          created_at: string | null
          data: Json
          id: string
          session_id: string | null
          status: string
          strategy_run_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          ad_account_id?: string | null
          artifact_type: string
          campaign_key: string
          created_at?: string | null
          data?: Json
          id?: string
          session_id?: string | null
          status?: string
          strategy_run_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          ad_account_id?: string | null
          artifact_type?: string
          campaign_key?: string
          created_at?: string | null
          data?: Json
          id?: string
          session_id?: string | null
          status?: string
          strategy_run_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_autopilot_artifacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_autopilot_configs: {
        Row: {
          ai_model: string
          allocation_mode: string
          budget_cents: number
          budget_mode: string
          channel: string
          channel_limits: Json | null
          created_at: string
          funnel_split_mode: string | null
          funnel_splits: Json | null
          human_approval_mode: string | null
          id: string
          is_enabled: boolean
          kill_switch: boolean | null
          last_analysis_at: string | null
          lock_expires_at: string | null
          lock_session_id: string | null
          max_share_pct: number
          min_share_pct: number
          objective: string
          safety_rules: Json
          strategy_mode: string | null
          tenant_id: string
          total_actions_executed: number
          total_budget_cents: number | null
          total_budget_mode: string | null
          total_credits_consumed: number
          updated_at: string
          user_instructions: string | null
        }
        Insert: {
          ai_model?: string
          allocation_mode?: string
          budget_cents?: number
          budget_mode?: string
          channel: string
          channel_limits?: Json | null
          created_at?: string
          funnel_split_mode?: string | null
          funnel_splits?: Json | null
          human_approval_mode?: string | null
          id?: string
          is_enabled?: boolean
          kill_switch?: boolean | null
          last_analysis_at?: string | null
          lock_expires_at?: string | null
          lock_session_id?: string | null
          max_share_pct?: number
          min_share_pct?: number
          objective?: string
          safety_rules?: Json
          strategy_mode?: string | null
          tenant_id: string
          total_actions_executed?: number
          total_budget_cents?: number | null
          total_budget_mode?: string | null
          total_credits_consumed?: number
          updated_at?: string
          user_instructions?: string | null
        }
        Update: {
          ai_model?: string
          allocation_mode?: string
          budget_cents?: number
          budget_mode?: string
          channel?: string
          channel_limits?: Json | null
          created_at?: string
          funnel_split_mode?: string | null
          funnel_splits?: Json | null
          human_approval_mode?: string | null
          id?: string
          is_enabled?: boolean
          kill_switch?: boolean | null
          last_analysis_at?: string | null
          lock_expires_at?: string | null
          lock_session_id?: string | null
          max_share_pct?: number
          min_share_pct?: number
          objective?: string
          safety_rules?: Json
          strategy_mode?: string | null
          tenant_id?: string
          total_actions_executed?: number
          total_budget_cents?: number | null
          total_budget_mode?: string | null
          total_credits_consumed?: number
          updated_at?: string
          user_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_autopilot_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_autopilot_experiments: {
        Row: {
          ad_account_id: string | null
          budget_cents: number | null
          channel: string
          created_at: string | null
          duration_days: number | null
          end_at: string | null
          hypothesis: string
          id: string
          min_conversions: number | null
          min_spend_cents: number | null
          plan: Json | null
          results: Json | null
          start_at: string | null
          status: string | null
          success_criteria: Json | null
          tenant_id: string
          updated_at: string | null
          variable_type: string
          winner_variant_id: string | null
        }
        Insert: {
          ad_account_id?: string | null
          budget_cents?: number | null
          channel: string
          created_at?: string | null
          duration_days?: number | null
          end_at?: string | null
          hypothesis: string
          id?: string
          min_conversions?: number | null
          min_spend_cents?: number | null
          plan?: Json | null
          results?: Json | null
          start_at?: string | null
          status?: string | null
          success_criteria?: Json | null
          tenant_id: string
          updated_at?: string | null
          variable_type: string
          winner_variant_id?: string | null
        }
        Update: {
          ad_account_id?: string | null
          budget_cents?: number | null
          channel?: string
          created_at?: string | null
          duration_days?: number | null
          end_at?: string | null
          hypothesis?: string
          id?: string
          min_conversions?: number | null
          min_spend_cents?: number | null
          plan?: Json | null
          results?: Json | null
          start_at?: string | null
          status?: string | null
          success_criteria?: Json | null
          tenant_id?: string
          updated_at?: string | null
          variable_type?: string
          winner_variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_autopilot_experiments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_autopilot_insights: {
        Row: {
          ad_account_id: string | null
          body: string
          category: string | null
          channel: string
          created_at: string | null
          evidence: Json | null
          id: string
          priority: string | null
          recommended_action: Json | null
          resolved_at: string | null
          sentiment: string | null
          status: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          ad_account_id?: string | null
          body: string
          category?: string | null
          channel: string
          created_at?: string | null
          evidence?: Json | null
          id?: string
          priority?: string | null
          recommended_action?: Json | null
          resolved_at?: string | null
          sentiment?: string | null
          status?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          ad_account_id?: string | null
          body?: string
          category?: string | null
          channel?: string
          created_at?: string | null
          evidence?: Json | null
          id?: string
          priority?: string | null
          recommended_action?: Json | null
          resolved_at?: string | null
          sentiment?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_autopilot_insights_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_autopilot_sessions: {
        Row: {
          actions_executed: number
          actions_planned: number
          actions_rejected: number
          ai_response_raw: string | null
          channel: string
          context_snapshot: Json | null
          cost_credits: number
          created_at: string
          duration_ms: number | null
          id: string
          insights_generated: Json | null
          integration_status: Json | null
          media_block_reason: string | null
          media_blocked: boolean | null
          motor_type: string | null
          strategy_run_id: string | null
          tenant_id: string
          trigger_type: string
          used_adcreative_ids: Json | null
          used_asset_ids: Json | null
        }
        Insert: {
          actions_executed?: number
          actions_planned?: number
          actions_rejected?: number
          ai_response_raw?: string | null
          channel: string
          context_snapshot?: Json | null
          cost_credits?: number
          created_at?: string
          duration_ms?: number | null
          id?: string
          insights_generated?: Json | null
          integration_status?: Json | null
          media_block_reason?: string | null
          media_blocked?: boolean | null
          motor_type?: string | null
          strategy_run_id?: string | null
          tenant_id: string
          trigger_type?: string
          used_adcreative_ids?: Json | null
          used_asset_ids?: Json | null
        }
        Update: {
          actions_executed?: number
          actions_planned?: number
          actions_rejected?: number
          ai_response_raw?: string | null
          channel?: string
          context_snapshot?: Json | null
          cost_credits?: number
          created_at?: string
          duration_ms?: number | null
          id?: string
          insights_generated?: Json | null
          integration_status?: Json | null
          media_block_reason?: string | null
          media_blocked?: boolean | null
          motor_type?: string | null
          strategy_run_id?: string | null
          tenant_id?: string
          trigger_type?: string
          used_adcreative_ids?: Json | null
          used_asset_ids?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_autopilot_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_chat_conversations: {
        Row: {
          ad_account_id: string | null
          channel: string | null
          created_at: string
          created_by: string
          id: string
          scope: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          ad_account_id?: string | null
          channel?: string | null
          created_at?: string
          created_by: string
          id?: string
          scope?: string
          tenant_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string | null
          channel?: string | null
          created_at?: string
          created_by?: string
          id?: string
          scope?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_chat_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_chat_messages: {
        Row: {
          attachments: Json | null
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          role: string
          tenant_id: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          attachments?: Json | null
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          attachments?: Json | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ads_chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_chat_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_creative_assets: {
        Row: {
          ad_account_id: string | null
          angle: string | null
          aspect_ratio: string | null
          asset_url: string | null
          channel: string | null
          compliance_notes: string | null
          compliance_status: string | null
          copy_text: string | null
          created_at: string | null
          cta_type: string | null
          expected_image_hash: string | null
          expected_video_id: string | null
          experiment_id: string | null
          format: string | null
          funnel_stage: string | null
          headline: string | null
          id: string
          meta: Json | null
          performance: Json | null
          platform_ad_id: string | null
          platform_adcreative_id: string | null
          product_id: string | null
          session_id: string | null
          status: string | null
          storage_path: string | null
          tenant_id: string
          updated_at: string | null
          variation_of: string | null
        }
        Insert: {
          ad_account_id?: string | null
          angle?: string | null
          aspect_ratio?: string | null
          asset_url?: string | null
          channel?: string | null
          compliance_notes?: string | null
          compliance_status?: string | null
          copy_text?: string | null
          created_at?: string | null
          cta_type?: string | null
          expected_image_hash?: string | null
          expected_video_id?: string | null
          experiment_id?: string | null
          format?: string | null
          funnel_stage?: string | null
          headline?: string | null
          id?: string
          meta?: Json | null
          performance?: Json | null
          platform_ad_id?: string | null
          platform_adcreative_id?: string | null
          product_id?: string | null
          session_id?: string | null
          status?: string | null
          storage_path?: string | null
          tenant_id: string
          updated_at?: string | null
          variation_of?: string | null
        }
        Update: {
          ad_account_id?: string | null
          angle?: string | null
          aspect_ratio?: string | null
          asset_url?: string | null
          channel?: string | null
          compliance_notes?: string | null
          compliance_status?: string | null
          copy_text?: string | null
          created_at?: string | null
          cta_type?: string | null
          expected_image_hash?: string | null
          expected_video_id?: string | null
          experiment_id?: string | null
          format?: string | null
          funnel_stage?: string | null
          headline?: string | null
          id?: string
          meta?: Json | null
          performance?: Json | null
          platform_ad_id?: string | null
          platform_adcreative_id?: string | null
          product_id?: string | null
          session_id?: string | null
          status?: string | null
          storage_path?: string | null
          tenant_id?: string
          updated_at?: string | null
          variation_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ads_creative_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ads_creative_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ads_tracking_health: {
        Row: {
          ad_account_id: string | null
          alerts: Json | null
          channel: string
          created_at: string | null
          id: string
          indicators: Json | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          ad_account_id?: string | null
          alerts?: Json | null
          channel: string
          created_at?: string | null
          id?: string
          indicators?: Json | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          ad_account_id?: string | null
          alerts?: Json | null
          channel?: string
          created_at?: string | null
          id?: string
          indicators?: Json | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_tracking_health_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          ip_hash: string | null
          landing_url: string | null
          link_id: string | null
          referrer: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_url?: string | null
          link_id?: string | null
          referrer?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_url?: string | null
          link_id?: string | null
          referrer?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_clicks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          affiliate_id: string
          commission_cents: number
          created_at: string
          id: string
          order_id: string
          order_total_cents: number
          status: string
          tenant_id: string
        }
        Insert: {
          affiliate_id: string
          commission_cents?: number
          created_at?: string
          id?: string
          order_id: string
          order_total_cents?: number
          status?: string
          tenant_id: string
        }
        Update: {
          affiliate_id?: string
          commission_cents?: number
          created_at?: string
          id?: string
          order_id?: string
          order_total_cents?: number
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          affiliate_id: string
          code: string
          created_at: string
          id: string
          target_url: string | null
          tenant_id: string
        }
        Insert: {
          affiliate_id: string
          code: string
          created_at?: string
          id?: string
          target_url?: string | null
          tenant_id: string
        }
        Update: {
          affiliate_id?: string
          code?: string
          created_at?: string
          id?: string
          target_url?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_payouts: {
        Row: {
          affiliate_id: string
          amount_cents: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          proof_url: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          affiliate_id: string
          amount_cents: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          proof_url?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          affiliate_id?: string
          amount_cents?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          proof_url?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_payouts_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_payouts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_programs: {
        Row: {
          attribution_window_days: number
          commission_type: string
          commission_value_cents: number
          created_at: string
          is_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attribution_window_days?: number
          commission_type?: string
          commission_value_cents?: number
          created_at?: string
          is_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attribution_window_days?: number
          commission_type?: string
          commission_value_cents?: number
          created_at?: string
          is_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          payout_notes: string | null
          phone: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          payout_notes?: string | null
          phone?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          payout_notes?: string | null
          phone?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_reminders: {
        Row: {
          channel: string
          created_at: string
          id: string
          last_error: string | null
          remind_at: string
          sent_at: string | null
          status: string
          task_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          remind_at: string
          sent_at?: string | null
          status?: string
          task_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          last_error?: string | null
          remind_at?: string
          sent_at?: string | null
          status?: string
          task_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_reminders_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "agenda_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_reminders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_tasks: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_at: string
          id: string
          is_recurring: boolean | null
          recurrence: Json | null
          reminder_offsets: Json | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_at: string
          id?: string
          is_recurring?: boolean | null
          recurrence?: Json | null
          reminder_offsets?: Json | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_at?: string
          id?: string
          is_recurring?: boolean | null
          recurrence?: Json | null
          reminder_offsets?: Json | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      ai_conversation_summaries: {
        Row: {
          ai_agent: string
          conversation_id: string
          created_at: string
          id: string
          key_decisions: Json | null
          key_topics: string[] | null
          message_count: number | null
          summary: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          ai_agent: string
          conversation_id: string
          created_at?: string
          id?: string
          key_decisions?: Json | null
          key_topics?: string[] | null
          message_count?: number | null
          summary: string
          tenant_id: string
          user_id: string
        }
        Update: {
          ai_agent?: string
          conversation_id?: string
          created_at?: string
          id?: string
          key_decisions?: Json | null
          key_topics?: string[] | null
          message_count?: number | null
          summary?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_summaries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_landing_page_versions: {
        Row: {
          created_at: string
          created_by: string
          css_content: string | null
          generation_metadata: Json | null
          html_content: string
          id: string
          landing_page_id: string
          preview_url: string | null
          prompt: string
          prompt_type: string
          tenant_id: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by: string
          css_content?: string | null
          generation_metadata?: Json | null
          html_content: string
          id?: string
          landing_page_id: string
          preview_url?: string | null
          prompt: string
          prompt_type?: string
          tenant_id: string
          version: number
        }
        Update: {
          created_at?: string
          created_by?: string
          css_content?: string | null
          generation_metadata?: Json | null
          html_content?: string
          id?: string
          landing_page_id?: string
          preview_url?: string | null
          prompt?: string
          prompt_type?: string
          tenant_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_landing_page_versions_landing_page_id_fkey"
            columns: ["landing_page_id"]
            isOneToOne: false
            referencedRelation: "ai_landing_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_landing_page_versions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_landing_pages: {
        Row: {
          created_at: string
          created_by: string
          current_version: number | null
          generated_css: string | null
          generated_html: string | null
          id: string
          initial_prompt: string | null
          is_published: boolean | null
          metadata: Json | null
          name: string
          preview_url: string | null
          product_ids: string[] | null
          published_at: string | null
          reference_screenshot_url: string | null
          reference_url: string | null
          seo_description: string | null
          seo_image_url: string | null
          seo_title: string | null
          slug: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_version?: number | null
          generated_css?: string | null
          generated_html?: string | null
          id?: string
          initial_prompt?: string | null
          is_published?: boolean | null
          metadata?: Json | null
          name: string
          preview_url?: string | null
          product_ids?: string[] | null
          published_at?: string | null
          reference_screenshot_url?: string | null
          reference_url?: string | null
          seo_description?: string | null
          seo_image_url?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_version?: number | null
          generated_css?: string | null
          generated_html?: string | null
          id?: string
          initial_prompt?: string | null
          is_published?: boolean | null
          metadata?: Json | null
          name?: string
          preview_url?: string | null
          product_ids?: string[] | null
          published_at?: string | null
          reference_screenshot_url?: string | null
          reference_url?: string | null
          seo_description?: string | null
          seo_image_url?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_landing_pages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_media_queue: {
        Row: {
          attachment_id: string
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number | null
          message_id: string
          next_retry_at: string | null
          process_type: string
          processed_at: string | null
          result: Json | null
          status: string | null
          tenant_id: string
        }
        Insert: {
          attachment_id: string
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          message_id: string
          next_retry_at?: string | null
          process_type: string
          processed_at?: string | null
          result?: Json | null
          status?: string | null
          tenant_id: string
        }
        Update: {
          attachment_id?: string
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number | null
          message_id?: string
          next_retry_at?: string | null
          process_type?: string
          processed_at?: string | null
          result?: Json | null
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_media_queue_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "message_attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_media_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_media_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memories: {
        Row: {
          ai_agent: string
          category: string
          content: string
          created_at: string
          expires_at: string | null
          id: string
          importance: number
          metadata: Json | null
          source_conversation_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_agent: string
          category?: string
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          importance?: number
          metadata?: Json | null
          source_conversation_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_agent?: string
          category?: string
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          importance?: number
          metadata?: Json | null
          source_conversation_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_memories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_model_pricing: {
        Row: {
          cost_per_1k_tokens: number | null
          cost_per_image: number | null
          created_at: string | null
          effective_from: string
          effective_until: string | null
          id: string
          model: string
          provider: string
        }
        Insert: {
          cost_per_1k_tokens?: number | null
          cost_per_image?: number | null
          created_at?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          model: string
          provider: string
        }
        Update: {
          cost_per_1k_tokens?: number | null
          cost_per_image?: number | null
          created_at?: string | null
          effective_from?: string
          effective_until?: string | null
          id?: string
          model?: string
          provider?: string
        }
        Relationships: []
      }
      ai_packages: {
        Row: {
          created_at: string
          credits: number
          description: string | null
          features: Json
          id: string
          is_active: boolean
          name: string
          price_cents: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits?: number
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_pricing: {
        Row: {
          cost_usd: number
          created_at: string
          effective_from: string
          effective_until: string | null
          has_audio: boolean | null
          id: string
          model: string
          pricing_type: string
          provider: string
          quality: string | null
          resolution: string | null
        }
        Insert: {
          cost_usd: number
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          has_audio?: boolean | null
          id?: string
          model: string
          pricing_type: string
          provider: string
          quality?: string | null
          resolution?: string | null
        }
        Update: {
          cost_usd?: number
          created_at?: string
          effective_from?: string
          effective_until?: string | null
          has_audio?: boolean | null
          id?: string
          model?: string
          pricing_type?: string
          provider?: string
          quality?: string | null
          resolution?: string | null
        }
        Relationships: []
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
          data_retention_days: number | null
          forbidden_topics: string[] | null
          handle_audio: boolean | null
          handle_files: boolean | null
          handle_images: boolean | null
          handoff_keywords: string[] | null
          handoff_on_no_evidence: boolean | null
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
          rag_min_evidence_chunks: number | null
          rag_similarity_threshold: number | null
          rag_top_k: number | null
          redact_pii_in_logs: boolean | null
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
          data_retention_days?: number | null
          forbidden_topics?: string[] | null
          handle_audio?: boolean | null
          handle_files?: boolean | null
          handle_images?: boolean | null
          handoff_keywords?: string[] | null
          handoff_on_no_evidence?: boolean | null
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
          rag_min_evidence_chunks?: number | null
          rag_similarity_threshold?: number | null
          rag_top_k?: number | null
          redact_pii_in_logs?: boolean | null
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
          data_retention_days?: number | null
          forbidden_topics?: string[] | null
          handle_audio?: boolean | null
          handle_files?: boolean | null
          handle_images?: boolean | null
          handoff_keywords?: string[] | null
          handoff_on_no_evidence?: boolean | null
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
          rag_min_evidence_chunks?: number | null
          rag_similarity_threshold?: number | null
          rag_top_k?: number | null
          redact_pii_in_logs?: boolean | null
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
      billing_checkout_sessions: {
        Row: {
          billing_cycle: string
          created_at: string
          email: string
          error_message: string | null
          id: string
          mp_external_reference: string | null
          mp_init_point: string | null
          mp_payment_id: string | null
          mp_preapproval_id: string | null
          owner_name: string
          phone: string | null
          plan_key: string
          slug: string | null
          status: string
          store_name: string
          tenant_id: string | null
          token_expires_at: string | null
          token_hash: string | null
          updated_at: string
          user_id: string | null
          utm: Json | null
        }
        Insert: {
          billing_cycle: string
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          mp_external_reference?: string | null
          mp_init_point?: string | null
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          owner_name: string
          phone?: string | null
          plan_key: string
          slug?: string | null
          status?: string
          store_name: string
          tenant_id?: string | null
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
          utm?: Json | null
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          mp_external_reference?: string | null
          mp_init_point?: string | null
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          owner_name?: string
          phone?: string | null
          plan_key?: string
          slug?: string | null
          status?: string
          store_name?: string
          tenant_id?: string | null
          token_expires_at?: string | null
          token_hash?: string | null
          updated_at?: string
          user_id?: string | null
          utm?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_checkout_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          processing_error: string | null
          provider: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_feature_flags: {
        Row: {
          created_at: string
          description: string | null
          flag_key: string
          id: string
          is_enabled: boolean
          metadata: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          flag_key: string
          id?: string
          is_enabled?: boolean
          metadata?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          flag_key?: string
          id?: string
          is_enabled?: boolean
          metadata?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      billing_plans: {
        Row: {
          created_at: string
          description: string | null
          feature_bullets: Json | null
          included_orders_per_month: number | null
          is_active: boolean
          is_public: boolean
          is_recommended: boolean | null
          mp_plan_id_annual: string | null
          mp_plan_id_monthly: string | null
          name: string
          plan_key: string
          price_annual_cents: number
          price_monthly_cents: number
          sort_order: number | null
          support_level: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          feature_bullets?: Json | null
          included_orders_per_month?: number | null
          is_active?: boolean
          is_public?: boolean
          is_recommended?: boolean | null
          mp_plan_id_annual?: string | null
          mp_plan_id_monthly?: string | null
          name: string
          plan_key: string
          price_annual_cents?: number
          price_monthly_cents?: number
          sort_order?: number | null
          support_level?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          feature_bullets?: Json | null
          included_orders_per_month?: number | null
          is_active?: boolean
          is_public?: boolean
          is_recommended?: boolean | null
          mp_plan_id_annual?: string | null
          mp_plan_id_monthly?: string | null
          name?: string
          plan_key?: string
          price_annual_cents?: number
          price_monthly_cents?: number
          sort_order?: number | null
          support_level?: string | null
          updated_at?: string
        }
        Relationships: []
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
      chatgpt_conversations: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatgpt_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      chatgpt_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatgpt_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chatgpt_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatgpt_messages_tenant_id_fkey"
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
          published_at: string | null
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
          published_at?: string | null
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
          published_at?: string | null
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
      command_conversations: {
        Row: {
          created_at: string
          id: string
          tenant_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tenant_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      command_message_attachments: {
        Row: {
          bucket: string
          created_at: string
          filename: string
          id: string
          message_id: string
          mime_type: string | null
          path: string
          size: number | null
          tenant_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          filename: string
          id?: string
          message_id: string
          mime_type?: string | null
          path: string
          size?: number | null
          tenant_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          filename?: string
          id?: string
          message_id?: string
          mime_type?: string | null
          path?: string
          size?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "command_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "command_message_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      command_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          tenant_id: string
          user_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "command_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "command_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "command_messages_tenant_id_fkey"
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
      core_audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          after_json: Json
          before_json: Json | null
          changed_fields: string[]
          correlation_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          source: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after_json: Json
          before_json?: Json | null
          changed_fields?: string[]
          correlation_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          source?: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after_json?: Json
          before_json?: Json | null
          changed_fields?: string[]
          correlation_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_compliance_profiles: {
        Row: {
          created_at: string
          custom_rules: Json | null
          id: string
          prohibited_terms: string[] | null
          required_disclaimers: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_rules?: Json | null
          id?: string
          prohibited_terms?: string[] | null
          required_disclaimers?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_rules?: Json | null
          id?: string
          prohibited_terms?: string[] | null
          required_disclaimers?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_compliance_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_jobs: {
        Row: {
          authorization_accepted_at: string | null
          completed_at: string | null
          cost_cents: number | null
          created_at: string
          created_by: string | null
          current_step: number | null
          error_message: string | null
          external_model_id: string | null
          external_request_id: string | null
          has_authorization: boolean | null
          id: string
          last_poll_at: string | null
          output_folder_id: string | null
          output_urls: string[] | null
          pipeline_steps: Json | null
          poll_attempts: number | null
          processing_time_ms: number | null
          product_id: string | null
          product_image_url: string | null
          product_name: string | null
          prompt: string
          reference_audio_url: string | null
          reference_images: string[] | null
          reference_video_url: string | null
          settings: Json
          started_at: string | null
          status: Database["public"]["Enums"]["creative_job_status"]
          tenant_id: string
          type: Database["public"]["Enums"]["creative_type"]
          updated_at: string | null
        }
        Insert: {
          authorization_accepted_at?: string | null
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          created_by?: string | null
          current_step?: number | null
          error_message?: string | null
          external_model_id?: string | null
          external_request_id?: string | null
          has_authorization?: boolean | null
          id?: string
          last_poll_at?: string | null
          output_folder_id?: string | null
          output_urls?: string[] | null
          pipeline_steps?: Json | null
          poll_attempts?: number | null
          processing_time_ms?: number | null
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string | null
          prompt: string
          reference_audio_url?: string | null
          reference_images?: string[] | null
          reference_video_url?: string | null
          settings?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["creative_job_status"]
          tenant_id: string
          type: Database["public"]["Enums"]["creative_type"]
          updated_at?: string | null
        }
        Update: {
          authorization_accepted_at?: string | null
          completed_at?: string | null
          cost_cents?: number | null
          created_at?: string
          created_by?: string | null
          current_step?: number | null
          error_message?: string | null
          external_model_id?: string | null
          external_request_id?: string | null
          has_authorization?: boolean | null
          id?: string
          last_poll_at?: string | null
          output_folder_id?: string | null
          output_urls?: string[] | null
          pipeline_steps?: Json | null
          poll_attempts?: number | null
          processing_time_ms?: number | null
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string | null
          prompt?: string
          reference_audio_url?: string | null
          reference_images?: string[] | null
          reference_video_url?: string | null
          settings?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["creative_job_status"]
          tenant_id?: string
          type?: Database["public"]["Enums"]["creative_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_jobs_output_folder_id_fkey"
            columns: ["output_folder_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_preset_components: {
        Row: {
          component_key: string
          component_type: string
          config: Json
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          component_key: string
          component_type: string
          config?: Json
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          component_key?: string
          component_type?: string
          config?: Json
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      creative_video_candidates: {
        Row: {
          created_at: string
          duration_actual: number | null
          generation_metadata: Json | null
          id: string
          is_best: boolean | null
          is_fallback: boolean | null
          job_id: string
          ocr_confidence: number | null
          ocr_extracted_text: string | null
          qa_final_score: number | null
          qa_label_score: number | null
          qa_passed: boolean | null
          qa_quality_score: number | null
          qa_rejection_reason: string | null
          qa_similarity_score: number | null
          qa_temporal_score: number | null
          tenant_id: string
          thumbnail_url: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          duration_actual?: number | null
          generation_metadata?: Json | null
          id?: string
          is_best?: boolean | null
          is_fallback?: boolean | null
          job_id: string
          ocr_confidence?: number | null
          ocr_extracted_text?: string | null
          qa_final_score?: number | null
          qa_label_score?: number | null
          qa_passed?: boolean | null
          qa_quality_score?: number | null
          qa_rejection_reason?: string | null
          qa_similarity_score?: number | null
          qa_temporal_score?: number | null
          tenant_id: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          duration_actual?: number | null
          generation_metadata?: Json | null
          id?: string
          is_best?: boolean | null
          is_fallback?: boolean | null
          job_id?: string
          ocr_confidence?: number | null
          ocr_extracted_text?: string | null
          qa_final_score?: number | null
          qa_label_score?: number | null
          qa_passed?: boolean | null
          qa_quality_score?: number | null
          qa_rejection_reason?: string | null
          qa_similarity_score?: number | null
          qa_temporal_score?: number | null
          tenant_id?: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_video_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "creative_video_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_video_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_video_jobs: {
        Row: {
          aspect_ratio: string
          best_candidate_id: string | null
          completed_at: string | null
          constraints: Json | null
          cost_credits: number | null
          cost_usd: number | null
          created_at: string
          current_step: string | null
          duration_seconds: number
          error_message: string | null
          fallback_used: boolean | null
          fidelity_mode: boolean | null
          hard_fidelity: boolean | null
          id: string
          model: string | null
          n_variations: number
          negative_prompt: string | null
          preset_id: string | null
          product_id: string
          progress_percent: number | null
          provider: string | null
          qa_summary: Json | null
          result_thumbnail_url: string | null
          result_url: string | null
          retry_count: number | null
          rewritten_prompt: Json | null
          shot_plan: Json | null
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
          user_prompt: string | null
          video_type: string
        }
        Insert: {
          aspect_ratio?: string
          best_candidate_id?: string | null
          completed_at?: string | null
          constraints?: Json | null
          cost_credits?: number | null
          cost_usd?: number | null
          created_at?: string
          current_step?: string | null
          duration_seconds?: number
          error_message?: string | null
          fallback_used?: boolean | null
          fidelity_mode?: boolean | null
          hard_fidelity?: boolean | null
          id?: string
          model?: string | null
          n_variations?: number
          negative_prompt?: string | null
          preset_id?: string | null
          product_id: string
          progress_percent?: number | null
          provider?: string | null
          qa_summary?: Json | null
          result_thumbnail_url?: string | null
          result_url?: string | null
          retry_count?: number | null
          rewritten_prompt?: Json | null
          shot_plan?: Json | null
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
          user_prompt?: string | null
          video_type: string
        }
        Update: {
          aspect_ratio?: string
          best_candidate_id?: string | null
          completed_at?: string | null
          constraints?: Json | null
          cost_credits?: number | null
          cost_usd?: number | null
          created_at?: string
          current_step?: string | null
          duration_seconds?: number
          error_message?: string | null
          fallback_used?: boolean | null
          fidelity_mode?: boolean | null
          hard_fidelity?: boolean | null
          id?: string
          model?: string | null
          n_variations?: number
          negative_prompt?: string | null
          preset_id?: string | null
          product_id?: string
          progress_percent?: number | null
          provider?: string | null
          qa_summary?: Json | null
          result_thumbnail_url?: string | null
          result_url?: string | null
          retry_count?: number | null
          rewritten_prompt?: Json | null
          shot_plan?: Json | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          user_prompt?: string | null
          video_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_video_jobs_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "creative_video_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_video_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_video_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_video_presets: {
        Row: {
          camera_component_id: string | null
          category_applicability: string[] | null
          created_at: string
          default_constraints: Json | null
          default_negatives: Json | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          lighting_component_id: string | null
          narrative_component_id: string | null
          preset_key: string
          scene_component_id: string | null
          shot_plan_10s: Json | null
          shot_plan_15s: Json | null
          shot_plan_6s: Json | null
          sort_order: number | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          camera_component_id?: string | null
          category_applicability?: string[] | null
          created_at?: string
          default_constraints?: Json | null
          default_negatives?: Json | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          lighting_component_id?: string | null
          narrative_component_id?: string | null
          preset_key: string
          scene_component_id?: string | null
          shot_plan_10s?: Json | null
          shot_plan_15s?: Json | null
          shot_plan_6s?: Json | null
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          camera_component_id?: string | null
          category_applicability?: string[] | null
          created_at?: string
          default_constraints?: Json | null
          default_negatives?: Json | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          lighting_component_id?: string | null
          narrative_component_id?: string | null
          preset_key?: string
          scene_component_id?: string | null
          shot_plan_10s?: Json | null
          shot_plan_15s?: Json | null
          shot_plan_6s?: Json | null
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_video_presets_camera_component_id_fkey"
            columns: ["camera_component_id"]
            isOneToOne: false
            referencedRelation: "creative_preset_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_video_presets_lighting_component_id_fkey"
            columns: ["lighting_component_id"]
            isOneToOne: false
            referencedRelation: "creative_preset_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_video_presets_narrative_component_id_fkey"
            columns: ["narrative_component_id"]
            isOneToOne: false
            referencedRelation: "creative_preset_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_video_presets_scene_component_id_fkey"
            columns: ["scene_component_id"]
            isOneToOne: false
            referencedRelation: "creative_preset_components"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          cost_usd: number | null
          created_at: string
          credits_delta: number
          description: string | null
          feature: string | null
          id: string
          idempotency_key: string | null
          job_id: string | null
          metadata: Json | null
          model: string | null
          provider: string | null
          sell_usd: number | null
          tenant_id: string
          transaction_type: string
          units_json: Json | null
          user_id: string | null
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          credits_delta: number
          description?: string | null
          feature?: string | null
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          metadata?: Json | null
          model?: string | null
          provider?: string | null
          sell_usd?: number | null
          tenant_id: string
          transaction_type: string
          units_json?: Json | null
          user_id?: string | null
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          credits_delta?: number
          description?: string | null
          feature?: string | null
          id?: string
          idempotency_key?: string | null
          job_id?: string | null
          metadata?: Json | null
          model?: string | null
          provider?: string | null
          sell_usd?: number | null
          tenant_id?: string
          transaction_type?: string
          units_json?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          bonus_credits: number | null
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price_cents: number
          sku: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          bonus_credits?: number | null
          created_at?: string
          credits: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price_cents: number
          sku: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          bonus_credits?: number | null
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price_cents?: number
          sku?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      credit_wallet: {
        Row: {
          balance_credits: number
          created_at: string
          id: string
          lifetime_consumed: number
          lifetime_purchased: number
          reserved_credits: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance_credits?: number
          created_at?: string
          id?: string
          lifetime_consumed?: number
          lifetime_purchased?: number
          reserved_credits?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance_credits?: number
          created_at?: string
          id?: string
          lifetime_consumed?: number
          lifetime_purchased?: number
          reserved_credits?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_wallet_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
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
          address_type: string | null
          city: string
          complement: string | null
          country: string
          created_at: string
          customer_id: string
          ibge_code: string | null
          id: string
          is_default: boolean | null
          label: string
          neighborhood: string
          number: string
          postal_code: string
          recipient_cpf: string | null
          recipient_name: string
          recipient_phone: string | null
          reference: string | null
          state: string
          street: string
          updated_at: string
        }
        Insert: {
          address_type?: string | null
          city: string
          complement?: string | null
          country?: string
          created_at?: string
          customer_id: string
          ibge_code?: string | null
          id?: string
          is_default?: boolean | null
          label?: string
          neighborhood: string
          number: string
          postal_code: string
          recipient_cpf?: string | null
          recipient_name: string
          recipient_phone?: string | null
          reference?: string | null
          state: string
          street: string
          updated_at?: string
        }
        Update: {
          address_type?: string | null
          city?: string
          complement?: string | null
          country?: string
          created_at?: string
          customer_id?: string
          ibge_code?: string | null
          id?: string
          is_default?: boolean | null
          label?: string
          neighborhood?: string
          number?: string
          postal_code?: string
          recipient_cpf?: string | null
          recipient_name?: string
          recipient_phone?: string | null
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
          accepts_email_marketing: boolean | null
          accepts_marketing: boolean | null
          accepts_sms_marketing: boolean | null
          accepts_whatsapp_marketing: boolean | null
          auth_user_id: string | null
          average_ticket: number | null
          birth_date: string | null
          bounced_at: string | null
          cnpj: string | null
          company_name: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          email: string
          email_verified: boolean | null
          first_order_at: string | null
          full_name: string
          gender: string | null
          id: string
          ie: string | null
          last_external_id: string | null
          last_order_at: string | null
          last_source_platform: string | null
          loyalty_points: number | null
          loyalty_tier: string | null
          notes: string | null
          person_type: string | null
          phone: string | null
          phone_verified: boolean | null
          rg: string | null
          state_registration_is_exempt: boolean | null
          status: string
          tenant_id: string
          total_orders: number | null
          total_spent: number | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          accepts_email_marketing?: boolean | null
          accepts_marketing?: boolean | null
          accepts_sms_marketing?: boolean | null
          accepts_whatsapp_marketing?: boolean | null
          auth_user_id?: string | null
          average_ticket?: number | null
          birth_date?: string | null
          bounced_at?: string | null
          cnpj?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          email_verified?: boolean | null
          first_order_at?: string | null
          full_name: string
          gender?: string | null
          id?: string
          ie?: string | null
          last_external_id?: string | null
          last_order_at?: string | null
          last_source_platform?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          rg?: string | null
          state_registration_is_exempt?: boolean | null
          status?: string
          tenant_id: string
          total_orders?: number | null
          total_spent?: number | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          accepts_email_marketing?: boolean | null
          accepts_marketing?: boolean | null
          accepts_sms_marketing?: boolean | null
          accepts_whatsapp_marketing?: boolean | null
          auth_user_id?: string | null
          average_ticket?: number | null
          birth_date?: string | null
          bounced_at?: string | null
          cnpj?: string | null
          company_name?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          email_verified?: boolean | null
          first_order_at?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          ie?: string | null
          last_external_id?: string | null
          last_order_at?: string | null
          last_source_platform?: string | null
          loyalty_points?: number | null
          loyalty_tier?: string | null
          notes?: string | null
          person_type?: string | null
          phone?: string | null
          phone_verified?: boolean | null
          rg?: string | null
          state_registration_is_exempt?: boolean | null
          status?: string
          tenant_id?: string
          total_orders?: number | null
          total_spent?: number | null
          unsubscribed_at?: string | null
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
          applies_to: string | null
          auto_apply_first_purchase: boolean
          category_ids: string[] | null
          code: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          min_subtotal: number | null
          name: string
          product_ids: string[] | null
          starts_at: string | null
          tenant_id: string
          type: string
          updated_at: string
          usage_limit_per_customer: number | null
          usage_limit_total: number | null
          value: number
        }
        Insert: {
          applies_to?: string | null
          auto_apply_first_purchase?: boolean
          category_ids?: string[] | null
          code?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal?: number | null
          name: string
          product_ids?: string[] | null
          starts_at?: string | null
          tenant_id: string
          type: string
          updated_at?: string
          usage_limit_per_customer?: number | null
          usage_limit_total?: number | null
          value?: number
        }
        Update: {
          applies_to?: string | null
          auto_apply_first_purchase?: boolean
          category_ids?: string[] | null
          code?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_subtotal?: number | null
          name?: string
          product_ids?: string[] | null
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
      email_automation_edges: {
        Row: {
          created_at: string
          flow_id: string
          id: string
          label: string | null
          source_handle: string | null
          source_node_id: string
          target_node_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          flow_id: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id: string
          target_node_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          flow_id?: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id?: string
          target_node_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "email_automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "email_automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "email_automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_edges_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_enrollments: {
        Row: {
          completed_at: string | null
          current_node_id: string | null
          enrolled_at: string
          flow_id: string
          id: string
          metadata: Json | null
          next_action_at: string | null
          status: string
          subscriber_id: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          current_node_id?: string | null
          enrolled_at?: string
          flow_id: string
          id?: string
          metadata?: Json | null
          next_action_at?: string | null
          status?: string
          subscriber_id: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          current_node_id?: string | null
          enrolled_at?: string
          flow_id?: string
          id?: string
          metadata?: Json | null
          next_action_at?: string | null
          status?: string
          subscriber_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_enrollments_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "email_automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_enrollments_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "email_automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_enrollments_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_flows: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          stats: Json | null
          status: string
          tenant_id: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          stats?: Json | null
          status?: string
          tenant_id: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          stats?: Json | null
          status?: string
          tenant_id?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_flows_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          enrollment_id: string | null
          flow_id: string
          id: string
          node_id: string | null
          result: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          enrollment_id?: string | null
          flow_id: string
          id?: string
          node_id?: string | null
          result?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          enrollment_id?: string | null
          flow_id?: string
          id?: string
          node_id?: string | null
          result?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_logs_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "email_automation_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_logs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "email_automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_logs_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "email_automation_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automation_nodes: {
        Row: {
          config: Json
          created_at: string
          flow_id: string
          id: string
          label: string | null
          node_type: string
          position_x: number
          position_y: number
          tenant_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          flow_id: string
          id?: string
          label?: string | null
          node_type: string
          position_x?: number
          position_y?: number
          tenant_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          label?: string | null
          node_type?: string
          position_x?: number
          position_y?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "email_automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automation_nodes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          data: Json | null
          event_type: string
          id: string
          subscriber_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          event_type: string
          id?: string
          subscriber_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          event_type?: string
          id?: string
          subscriber_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_events_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      email_marketing_campaign_steps: {
        Row: {
          campaign_id: string
          conditions: Json | null
          created_at: string
          delay_minutes: number
          id: string
          step_index: number
          template_id: string | null
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          conditions?: Json | null
          created_at?: string
          delay_minutes?: number
          id?: string
          step_index?: number
          template_id?: string | null
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          conditions?: Json | null
          created_at?: string
          delay_minutes?: number
          id?: string
          step_index?: number
          template_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_marketing_campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_marketing_campaign_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_marketing_campaign_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_marketing_campaigns: {
        Row: {
          created_at: string
          id: string
          list_id: string | null
          name: string
          segment: Json | null
          sent_count: number | null
          status: string
          template_id: string | null
          tenant_id: string
          trigger_config: Json | null
          trigger_type: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id?: string | null
          name: string
          segment?: Json | null
          sent_count?: number | null
          status?: string
          template_id?: string | null
          tenant_id: string
          trigger_config?: Json | null
          trigger_type?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string | null
          name?: string
          segment?: Json | null
          sent_count?: number | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          trigger_config?: Json | null
          trigger_type?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_marketing_campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_marketing_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_marketing_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_marketing_forms: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          list_id: string | null
          name: string
          slug: string
          status: string
          success_message: string | null
          tags_to_add: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          list_id?: string | null
          name: string
          slug: string
          status?: string
          success_message?: string | null
          tags_to_add?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          list_id?: string | null
          name?: string
          slug?: string
          status?: string
          success_message?: string | null
          tags_to_add?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_marketing_forms_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_marketing_forms_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_marketing_list_members: {
        Row: {
          created_at: string
          id: string
          list_id: string
          subscriber_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          subscriber_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          subscriber_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_marketing_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_marketing_list_members_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_marketing_list_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_marketing_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tag_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tag_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tag_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_marketing_lists_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_marketing_lists_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_marketing_subscribers: {
        Row: {
          birth_date: string | null
          created_at: string
          created_from: string | null
          customer_id: string | null
          email: string
          id: string
          metadata: Json | null
          name: string | null
          phone: string | null
          source: string | null
          status: string
          tags: string[] | null
          tenant_id: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          created_from?: string | null
          customer_id?: string | null
          email: string
          id?: string
          metadata?: Json | null
          name?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          tenant_id: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          created_from?: string | null
          customer_id?: string | null
          email?: string
          id?: string
          metadata?: Json | null
          name?: string | null
          phone?: string | null
          source?: string | null
          status?: string
          tags?: string[] | null
          tenant_id?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_marketing_subscribers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_marketing_subscribers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_marketing_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          id: string
          name: string
          subject: string
          tenant_id: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          id?: string
          name: string
          subject: string
          tenant_id: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          id?: string
          name?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_marketing_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      email_send_queue: {
        Row: {
          body_html: string
          body_text: string | null
          campaign_id: string | null
          created_at: string
          id: string
          last_error: string | null
          metadata: Json | null
          provider_message_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string
          subscriber_id: string | null
          tenant_id: string
          to_email: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject: string
          subscriber_id?: string | null
          tenant_id: string
          to_email: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          metadata?: Json | null
          provider_message_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string
          subscriber_id?: string | null
          tenant_id?: string
          to_email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_queue_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_send_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          id: string
          subscriber_id: string
          tenant_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          subscriber_id: string
          tenant_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          subscriber_id?: string
          tenant_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribe_tokens_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribe_tokens_tenant_id_fkey"
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
      external_entity_mappings: {
        Row: {
          created_at: string
          entity_type: string
          external_id: string
          external_parent_id: string | null
          id: string
          internal_id: string
          raw: Json | null
          source_platform: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_type: string
          external_id: string
          external_parent_id?: string | null
          id?: string
          internal_id: string
          raw?: Json | null
          source_platform: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          external_id?: string
          external_parent_id?: string | null
          id?: string
          internal_id?: string
          raw?: Json | null
          source_platform?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_entity_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          created_at: string | null
          created_by: string | null
          filename: string
          folder_id: string | null
          id: string
          is_folder: boolean | null
          is_system_folder: boolean | null
          metadata: Json | null
          mime_type: string | null
          original_name: string
          size_bytes: number | null
          storage_path: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          filename: string
          folder_id?: string | null
          id?: string
          is_folder?: boolean | null
          is_system_folder?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          original_name: string
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          filename?: string
          folder_id?: string | null
          id?: string
          is_folder?: boolean | null
          is_system_folder?: boolean | null
          metadata?: Json | null
          mime_type?: string | null
          original_name?: string
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_tenant_id_fkey"
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
      free_pix_validations: {
        Row: {
          amount_cents: number
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json | null
          paid_at: string | null
          payment_provider: string | null
          pix_code: string | null
          pix_qr_code: string | null
          provider_charge_id: string | null
          refund_requested_at: string | null
          refundable_until: string | null
          refunded_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_provider?: string | null
          pix_code?: string | null
          pix_qr_code?: string | null
          provider_charge_id?: string | null
          refund_requested_at?: string | null
          refundable_until?: string | null
          refunded_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          paid_at?: string | null
          payment_provider?: string | null
          pix_code?: string | null
          pix_qr_code?: string | null
          provider_charge_id?: string | null
          refund_requested_at?: string | null
          refundable_until?: string | null
          refunded_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_pix_validations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ad_ads: {
        Row: {
          ad_account_id: string
          ad_strength: string | null
          ad_type: string
          created_at: string
          descriptions: Json | null
          display_url: string | null
          final_urls: string[] | null
          google_ad_group_id: string
          google_ad_id: string
          headlines: Json | null
          id: string
          metadata: Json | null
          name: string | null
          path1: string | null
          path2: string | null
          policy_summary: Json | null
          status: string
          synced_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          ad_strength?: string | null
          ad_type: string
          created_at?: string
          descriptions?: Json | null
          display_url?: string | null
          final_urls?: string[] | null
          google_ad_group_id: string
          google_ad_id: string
          headlines?: Json | null
          id?: string
          metadata?: Json | null
          name?: string | null
          path1?: string | null
          path2?: string | null
          policy_summary?: Json | null
          status?: string
          synced_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          ad_strength?: string | null
          ad_type?: string
          created_at?: string
          descriptions?: Json | null
          display_url?: string | null
          final_urls?: string[] | null
          google_ad_group_id?: string
          google_ad_id?: string
          headlines?: Json | null
          id?: string
          metadata?: Json | null
          name?: string | null
          path1?: string | null
          path2?: string | null
          policy_summary?: Json | null
          status?: string
          synced_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_ads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ad_assets: {
        Row: {
          ad_account_id: string
          asset_name: string | null
          asset_type: string
          created_at: string
          field_type: string | null
          google_asset_id: string | null
          id: string
          image_url: string | null
          metadata: Json | null
          performance_label: string | null
          policy_summary: Json | null
          storage_path: string | null
          synced_at: string | null
          tenant_id: string
          text_content: string | null
          updated_at: string
          youtube_video_id: string | null
        }
        Insert: {
          ad_account_id: string
          asset_name?: string | null
          asset_type: string
          created_at?: string
          field_type?: string | null
          google_asset_id?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          performance_label?: string | null
          policy_summary?: Json | null
          storage_path?: string | null
          synced_at?: string | null
          tenant_id: string
          text_content?: string | null
          updated_at?: string
          youtube_video_id?: string | null
        }
        Update: {
          ad_account_id?: string
          asset_name?: string | null
          asset_type?: string
          created_at?: string
          field_type?: string | null
          google_asset_id?: string | null
          id?: string
          image_url?: string | null
          metadata?: Json | null
          performance_label?: string | null
          policy_summary?: Json | null
          storage_path?: string | null
          synced_at?: string | null
          tenant_id?: string
          text_content?: string | null
          updated_at?: string
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ad_audiences: {
        Row: {
          ad_account_id: string
          audience_type: string | null
          created_at: string
          description: string | null
          google_audience_id: string
          id: string
          membership_status: string | null
          metadata: Json | null
          name: string
          size_estimate: number | null
          synced_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          audience_type?: string | null
          created_at?: string
          description?: string | null
          google_audience_id: string
          id?: string
          membership_status?: string | null
          metadata?: Json | null
          name: string
          size_estimate?: number | null
          synced_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          audience_type?: string | null
          created_at?: string
          description?: string | null
          google_audience_id?: string
          id?: string
          membership_status?: string | null
          metadata?: Json | null
          name?: string
          size_estimate?: number | null
          synced_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_audiences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ad_campaigns: {
        Row: {
          ad_account_id: string
          bidding_strategy_type: string | null
          budget_amount_micros: number | null
          budget_type: string | null
          campaign_type: string | null
          created_at: string
          end_date: string | null
          google_campaign_id: string
          id: string
          metadata: Json | null
          name: string
          optimization_score: number | null
          start_date: string | null
          status: string | null
          synced_at: string | null
          target_cpa_micros: number | null
          target_roas: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          bidding_strategy_type?: string | null
          budget_amount_micros?: number | null
          budget_type?: string | null
          campaign_type?: string | null
          created_at?: string
          end_date?: string | null
          google_campaign_id: string
          id?: string
          metadata?: Json | null
          name: string
          optimization_score?: number | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
          target_cpa_micros?: number | null
          target_roas?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          bidding_strategy_type?: string | null
          budget_amount_micros?: number | null
          budget_type?: string | null
          campaign_type?: string | null
          created_at?: string
          end_date?: string | null
          google_campaign_id?: string
          id?: string
          metadata?: Json | null
          name?: string
          optimization_score?: number | null
          start_date?: string | null
          status?: string | null
          synced_at?: string | null
          target_cpa_micros?: number | null
          target_roas?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ad_groups: {
        Row: {
          ad_account_id: string
          ad_group_type: string | null
          cpc_bid_micros: number | null
          cpm_bid_micros: number | null
          created_at: string
          effective_status: string | null
          google_ad_group_id: string
          google_campaign_id: string
          id: string
          metadata: Json | null
          name: string
          status: string
          synced_at: string | null
          target_cpa_micros: number | null
          target_roas: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          ad_group_type?: string | null
          cpc_bid_micros?: number | null
          cpm_bid_micros?: number | null
          created_at?: string
          effective_status?: string | null
          google_ad_group_id: string
          google_campaign_id: string
          id?: string
          metadata?: Json | null
          name: string
          status?: string
          synced_at?: string | null
          target_cpa_micros?: number | null
          target_roas?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          ad_group_type?: string | null
          cpc_bid_micros?: number | null
          cpm_bid_micros?: number | null
          created_at?: string
          effective_status?: string | null
          google_ad_group_id?: string
          google_campaign_id?: string
          id?: string
          metadata?: Json | null
          name?: string
          status?: string
          synced_at?: string | null
          target_cpa_micros?: number | null
          target_roas?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ad_insights: {
        Row: {
          ad_account_id: string
          average_cpc_micros: number | null
          average_cpm_micros: number | null
          clicks: number | null
          conversions: number | null
          conversions_value: number | null
          cost_micros: number | null
          created_at: string
          ctr: number | null
          date: string
          google_campaign_id: string
          id: string
          impressions: number | null
          interaction_rate: number | null
          metadata: Json | null
          synced_at: string | null
          tenant_id: string
          video_views: number | null
          view_rate: number | null
        }
        Insert: {
          ad_account_id: string
          average_cpc_micros?: number | null
          average_cpm_micros?: number | null
          clicks?: number | null
          conversions?: number | null
          conversions_value?: number | null
          cost_micros?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          google_campaign_id: string
          id?: string
          impressions?: number | null
          interaction_rate?: number | null
          metadata?: Json | null
          synced_at?: string | null
          tenant_id: string
          video_views?: number | null
          view_rate?: number | null
        }
        Update: {
          ad_account_id?: string
          average_cpc_micros?: number | null
          average_cpm_micros?: number | null
          clicks?: number | null
          conversions?: number | null
          conversions_value?: number | null
          cost_micros?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          google_campaign_id?: string
          id?: string
          impressions?: number | null
          interaction_rate?: number | null
          metadata?: Json | null
          synced_at?: string | null
          tenant_id?: string
          video_views?: number | null
          view_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_insights_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ad_keywords: {
        Row: {
          ad_account_id: string
          cpc_bid_micros: number | null
          created_at: string
          google_ad_group_id: string
          google_criterion_id: string
          id: string
          keyword_text: string
          match_type: string
          metadata: Json | null
          quality_info: Json | null
          quality_score: number | null
          status: string
          synced_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          cpc_bid_micros?: number | null
          created_at?: string
          google_ad_group_id: string
          google_criterion_id: string
          id?: string
          keyword_text: string
          match_type: string
          metadata?: Json | null
          quality_info?: Json | null
          quality_score?: number | null
          status?: string
          synced_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          cpc_bid_micros?: number | null
          created_at?: string
          google_ad_group_id?: string
          google_criterion_id?: string
          id?: string
          keyword_text?: string
          match_type?: string
          metadata?: Json | null
          quality_info?: Json | null
          quality_score?: number | null
          status?: string
          synced_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ad_keywords_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_analytics_reports: {
        Row: {
          created_at: string
          date: string
          dimensions: Json | null
          id: string
          metrics: Json | null
          property_id: string
          report_type: string
          synced_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          date: string
          dimensions?: Json | null
          id?: string
          metrics?: Json | null
          property_id: string
          report_type?: string
          synced_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          date?: string
          dimensions?: Json | null
          id?: string
          metrics?: Json | null
          property_id?: string
          report_type?: string
          synced_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_analytics_reports_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_business_posts: {
        Row: {
          call_to_action_type: string | null
          call_to_action_url: string | null
          create_time: string | null
          created_at: string
          event_end: string | null
          event_start: string | null
          event_title: string | null
          id: string
          location_id: string
          media_url: string | null
          offer_coupon_code: string | null
          offer_redeem_url: string | null
          post_id: string | null
          search_url: string | null
          state: string | null
          summary: string | null
          tenant_id: string
          topic_type: string
          update_time: string | null
          updated_at: string
        }
        Insert: {
          call_to_action_type?: string | null
          call_to_action_url?: string | null
          create_time?: string | null
          created_at?: string
          event_end?: string | null
          event_start?: string | null
          event_title?: string | null
          id?: string
          location_id: string
          media_url?: string | null
          offer_coupon_code?: string | null
          offer_redeem_url?: string | null
          post_id?: string | null
          search_url?: string | null
          state?: string | null
          summary?: string | null
          tenant_id: string
          topic_type?: string
          update_time?: string | null
          updated_at?: string
        }
        Update: {
          call_to_action_type?: string | null
          call_to_action_url?: string | null
          create_time?: string | null
          created_at?: string
          event_end?: string | null
          event_start?: string | null
          event_title?: string | null
          id?: string
          location_id?: string
          media_url?: string | null
          offer_coupon_code?: string | null
          offer_redeem_url?: string | null
          post_id?: string | null
          search_url?: string | null
          state?: string | null
          summary?: string | null
          tenant_id?: string
          topic_type?: string
          update_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_business_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_business_reviews: {
        Row: {
          comment: string | null
          create_time: string | null
          created_at: string
          id: string
          location_id: string
          reply_updated_at: string | null
          review_id: string
          review_reply: string | null
          reviewer_name: string | null
          reviewer_photo_url: string | null
          star_rating: number | null
          tenant_id: string
          update_time: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          create_time?: string | null
          created_at?: string
          id?: string
          location_id: string
          reply_updated_at?: string | null
          review_id: string
          review_reply?: string | null
          reviewer_name?: string | null
          reviewer_photo_url?: string | null
          star_rating?: number | null
          tenant_id: string
          update_time?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          create_time?: string | null
          created_at?: string
          id?: string
          location_id?: string
          reply_updated_at?: string | null
          review_id?: string
          review_reply?: string | null
          reviewer_name?: string | null
          reviewer_photo_url?: string | null
          star_rating?: number | null
          tenant_id?: string
          update_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_business_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          access_token: string | null
          assets: Json | null
          avatar_url: string | null
          connected_by: string
          connection_status: string | null
          created_at: string
          display_name: string | null
          google_email: string | null
          google_user_id: string | null
          granted_scopes: string[] | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_sync_at: string | null
          metadata: Json | null
          refresh_token: string | null
          scope_packs: string[] | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          assets?: Json | null
          avatar_url?: string | null
          connected_by: string
          connection_status?: string | null
          created_at?: string
          display_name?: string | null
          google_email?: string | null
          google_user_id?: string | null
          granted_scopes?: string[] | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          scope_packs?: string[] | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          assets?: Json | null
          avatar_url?: string | null
          connected_by?: string
          connection_status?: string | null
          created_at?: string
          display_name?: string | null
          google_email?: string | null
          google_user_id?: string | null
          granted_scopes?: string[] | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          refresh_token?: string | null
          scope_packs?: string[] | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_merchant_products: {
        Row: {
          channel: string | null
          content_language: string | null
          created_at: string
          disapproval_reasons: Json | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          merchant_account_id: string
          merchant_product_id: string | null
          metadata: Json | null
          product_id: string
          sync_status: string
          synced_data_hash: string | null
          target_country: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel?: string | null
          content_language?: string | null
          created_at?: string
          disapproval_reasons?: Json | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          merchant_account_id: string
          merchant_product_id?: string | null
          metadata?: Json | null
          product_id: string
          sync_status?: string
          synced_data_hash?: string | null
          target_country?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string | null
          content_language?: string | null
          created_at?: string
          disapproval_reasons?: Json | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          merchant_account_id?: string
          merchant_product_id?: string | null
          metadata?: Json | null
          product_id?: string
          sync_status?: string
          synced_data_hash?: string | null
          target_country?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_merchant_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "google_merchant_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          return_path: string | null
          scope_packs: string[] | null
          state: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          return_path?: string | null
          scope_packs?: string[] | null
          state: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          return_path?: string | null
          scope_packs?: string[] | null
          state?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_oauth_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_search_console_data: {
        Row: {
          clicks: number
          country: string | null
          created_at: string
          ctr: number
          date: string
          device: string | null
          id: string
          impressions: number
          page: string | null
          position: number
          query: string | null
          report_type: string
          site_url: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          clicks?: number
          country?: string | null
          created_at?: string
          ctr?: number
          date: string
          device?: string | null
          id?: string
          impressions?: number
          page?: string | null
          position?: number
          query?: string | null
          report_type?: string
          site_url: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          clicks?: number
          country?: string | null
          created_at?: string
          ctr?: number
          date?: string
          device?: string | null
          id?: string
          impressions?: number
          page?: string | null
          position?: number
          query?: string | null
          report_type?: string
          site_url?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_search_console_data_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      google_tag_manager_containers: {
        Row: {
          account_id: string
          account_name: string | null
          container_id: string
          container_name: string
          container_public_id: string | null
          created_at: string
          domain_name: string[] | null
          fingerprint: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          metadata: Json | null
          tag_manager_url: string | null
          tenant_id: string
          updated_at: string
          usage_context: string[] | null
        }
        Insert: {
          account_id: string
          account_name?: string | null
          container_id: string
          container_name: string
          container_public_id?: string | null
          created_at?: string
          domain_name?: string[] | null
          fingerprint?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          metadata?: Json | null
          tag_manager_url?: string | null
          tenant_id: string
          updated_at?: string
          usage_context?: string[] | null
        }
        Update: {
          account_id?: string
          account_name?: string | null
          container_id?: string
          container_name?: string
          container_public_id?: string | null
          created_at?: string
          domain_name?: string[] | null
          fingerprint?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          metadata?: Json | null
          tag_manager_url?: string | null
          tenant_id?: string
          updated_at?: string
          usage_context?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "google_tag_manager_containers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
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
      influencer_interactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          influencer_id: string
          occurred_at: string
          summary: string | null
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          influencer_id: string
          occurred_at?: string
          summary?: string | null
          tenant_id: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          influencer_id?: string
          occurred_at?: string
          summary?: string | null
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_interactions_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencer_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_leads: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          follower_range: string | null
          handle: string | null
          id: string
          last_contact_at: string | null
          location: string | null
          name: string
          niche: string | null
          notes: string | null
          platform: string
          profile_url: string | null
          status: string
          tags: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          follower_range?: string | null
          handle?: string | null
          id?: string
          last_contact_at?: string | null
          location?: string | null
          name: string
          niche?: string | null
          notes?: string | null
          platform?: string
          profile_url?: string | null
          status?: string
          tags?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          follower_range?: string | null
          handle?: string | null
          id?: string
          last_contact_at?: string | null
          location?: string | null
          name?: string
          niche?: string | null
          notes?: string | null
          platform?: string
          profile_url?: string | null
          status?: string
          tags?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencer_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          chunk_tokens: number | null
          created_at: string | null
          doc_id: string
          embedding: string | null
          id: string
          is_active: boolean | null
          tenant_id: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          chunk_tokens?: number | null
          created_at?: string | null
          doc_id: string
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          chunk_tokens?: number | null
          created_at?: string | null
          doc_id?: string
          embedding?: string | null
          id?: string
          is_active?: boolean | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_chunks_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "knowledge_base_docs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_docs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_id: string | null
          content: string
          created_at: string | null
          doc_type: string
          id: string
          priority: number | null
          source: string | null
          source_id: string | null
          status: string | null
          tags: string[] | null
          tenant_id: string
          title: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
          version: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string | null
          content: string
          created_at?: string | null
          doc_type: string
          id?: string
          priority?: number | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id: string
          title: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string | null
          content?: string
          created_at?: string | null
          doc_type?: string
          id?: string
          priority?: number | null
          source?: string | null
          source_id?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_docs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      late_connections: {
        Row: {
          connected_accounts: Json | null
          connected_at: string | null
          created_at: string
          id: string
          last_error: string | null
          late_profile_id: string | null
          late_profile_name: string | null
          scopes: string[] | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          connected_accounts?: Json | null
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          late_profile_id?: string | null
          late_profile_name?: string | null
          scopes?: string[] | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          connected_accounts?: Json | null
          connected_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          late_profile_id?: string | null
          late_profile_name?: string | null
          scopes?: string[] | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      late_onboarding_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          metadata: Json | null
          redirect_url: string | null
          state_token: string
          tenant_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json | null
          redirect_url?: string | null
          state_token: string
          tenant_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          metadata?: Json | null
          redirect_url?: string | null
          state_token?: string
          tenant_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "late_onboarding_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      late_scheduled_posts: {
        Row: {
          calendar_item_id: string
          created_at: string
          external_post_id: string | null
          external_post_ids: Json | null
          id: string
          last_error: string | null
          provider: string
          published_at: string | null
          raw_response: Json | null
          scheduled_for: string | null
          status: string
          target_platforms: string[]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          calendar_item_id: string
          created_at?: string
          external_post_id?: string | null
          external_post_ids?: Json | null
          id?: string
          last_error?: string | null
          provider?: string
          published_at?: string | null
          raw_response?: Json | null
          scheduled_for?: string | null
          status?: string
          target_platforms?: string[]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          calendar_item_id?: string
          created_at?: string
          external_post_id?: string | null
          external_post_ids?: Json | null
          id?: string
          last_error?: string | null
          provider?: string
          published_at?: string | null
          raw_response?: Json | null
          scheduled_for?: string | null
          status?: string
          target_platforms?: string[]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_scheduled_posts_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "media_calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_scheduled_posts_tenant_id_fkey"
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
          meta_additional_pixel_ids: string[] | null
          meta_capi_enabled: boolean
          meta_enabled: boolean
          meta_last_error: string | null
          meta_last_test_at: string | null
          meta_pixel_id: string | null
          meta_status: string | null
          tenant_id: string
          tiktok_access_token: string | null
          tiktok_advertiser_id: string | null
          tiktok_advertiser_name: string | null
          tiktok_connected_at: string | null
          tiktok_connected_by: string | null
          tiktok_enabled: boolean
          tiktok_events_api_enabled: boolean
          tiktok_last_error: string | null
          tiktok_last_test_at: string | null
          tiktok_pixel_id: string | null
          tiktok_refresh_token: string | null
          tiktok_status: string | null
          tiktok_token_expires_at: string | null
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
          meta_additional_pixel_ids?: string[] | null
          meta_capi_enabled?: boolean
          meta_enabled?: boolean
          meta_last_error?: string | null
          meta_last_test_at?: string | null
          meta_pixel_id?: string | null
          meta_status?: string | null
          tenant_id: string
          tiktok_access_token?: string | null
          tiktok_advertiser_id?: string | null
          tiktok_advertiser_name?: string | null
          tiktok_connected_at?: string | null
          tiktok_connected_by?: string | null
          tiktok_enabled?: boolean
          tiktok_events_api_enabled?: boolean
          tiktok_last_error?: string | null
          tiktok_last_test_at?: string | null
          tiktok_pixel_id?: string | null
          tiktok_refresh_token?: string | null
          tiktok_status?: string | null
          tiktok_token_expires_at?: string | null
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
          meta_additional_pixel_ids?: string[] | null
          meta_capi_enabled?: boolean
          meta_enabled?: boolean
          meta_last_error?: string | null
          meta_last_test_at?: string | null
          meta_pixel_id?: string | null
          meta_status?: string | null
          tenant_id?: string
          tiktok_access_token?: string | null
          tiktok_advertiser_id?: string | null
          tiktok_advertiser_name?: string | null
          tiktok_connected_at?: string | null
          tiktok_connected_by?: string | null
          tiktok_enabled?: boolean
          tiktok_events_api_enabled?: boolean
          tiktok_last_error?: string | null
          tiktok_last_test_at?: string | null
          tiktok_pixel_id?: string | null
          tiktok_refresh_token?: string | null
          tiktok_status?: string | null
          tiktok_token_expires_at?: string | null
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
      marketplace_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          external_user_id: string
          external_username: string | null
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          marketplace: string
          metadata: Json | null
          refresh_token: string | null
          scopes: string[] | null
          tenant_id: string
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          external_user_id: string
          external_username?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          marketplace?: string
          metadata?: Json | null
          refresh_token?: string | null
          scopes?: string[] | null
          tenant_id: string
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          external_user_id?: string
          external_username?: string | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          marketplace?: string
          metadata?: Json | null
          refresh_token?: string | null
          scopes?: string[] | null
          tenant_id?: string
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_messages: {
        Row: {
          answer_text: string | null
          answered_at: string | null
          buyer_id: string | null
          buyer_nickname: string | null
          connection_id: string | null
          created_at: string
          external_item_id: string | null
          external_message_id: string
          external_order_id: string | null
          external_thread_id: string | null
          id: string
          item_thumbnail: string | null
          item_title: string | null
          marketplace: string
          message_type: string
          metadata: Json | null
          question_text: string | null
          received_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          answer_text?: string | null
          answered_at?: string | null
          buyer_id?: string | null
          buyer_nickname?: string | null
          connection_id?: string | null
          created_at?: string
          external_item_id?: string | null
          external_message_id: string
          external_order_id?: string | null
          external_thread_id?: string | null
          id?: string
          item_thumbnail?: string | null
          item_title?: string | null
          marketplace?: string
          message_type: string
          metadata?: Json | null
          question_text?: string | null
          received_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          answer_text?: string | null
          answered_at?: string | null
          buyer_id?: string | null
          buyer_nickname?: string | null
          connection_id?: string | null
          created_at?: string
          external_item_id?: string | null
          external_message_id?: string
          external_order_id?: string | null
          external_thread_id?: string | null
          id?: string
          item_thumbnail?: string | null
          item_title?: string | null
          marketplace?: string
          message_type?: string
          metadata?: Json | null
          question_text?: string | null
          received_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_messages_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sync_logs: {
        Row: {
          completed_at: string | null
          connection_id: string
          created_at: string
          details: Json | null
          error_message: string | null
          id: string
          items_created: number | null
          items_failed: number | null
          items_processed: number | null
          items_updated: number | null
          started_at: string
          status: string
          sync_type: string
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          connection_id: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_processed?: number | null
          items_updated?: number | null
          started_at?: string
          status?: string
          sync_type: string
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          details?: Json | null
          error_message?: string | null
          id?: string
          items_created?: number | null
          items_failed?: number | null
          items_processed?: number | null
          items_updated?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "marketplace_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_sync_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_asset_generations: {
        Row: {
          brand_context_snapshot: Json | null
          calendar_item_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          model: string
          prompt_final: string
          provider: string
          settings: Json | null
          status: string
          tenant_id: string
          variant_count: number | null
        }
        Insert: {
          brand_context_snapshot?: Json | null
          calendar_item_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          model?: string
          prompt_final: string
          provider?: string
          settings?: Json | null
          status?: string
          tenant_id: string
          variant_count?: number | null
        }
        Update: {
          brand_context_snapshot?: Json | null
          calendar_item_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          model?: string
          prompt_final?: string
          provider?: string
          settings?: Json | null
          status?: string
          tenant_id?: string
          variant_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_asset_generations_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "media_calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_asset_generations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_asset_variants: {
        Row: {
          approved_at: string | null
          created_at: string | null
          feedback: string | null
          file_size: number | null
          generation_id: string
          height: number | null
          id: string
          mime_type: string | null
          public_url: string | null
          rejected_at: string | null
          rejected_reason: string | null
          storage_path: string | null
          thumb_url: string | null
          variant_index: number
          width: number | null
        }
        Insert: {
          approved_at?: string | null
          created_at?: string | null
          feedback?: string | null
          file_size?: number | null
          generation_id: string
          height?: number | null
          id?: string
          mime_type?: string | null
          public_url?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          storage_path?: string | null
          thumb_url?: string | null
          variant_index?: number
          width?: number | null
        }
        Update: {
          approved_at?: string | null
          created_at?: string | null
          feedback?: string | null
          file_size?: number | null
          generation_id?: string
          height?: number | null
          id?: string
          mime_type?: string | null
          public_url?: string | null
          rejected_at?: string | null
          rejected_reason?: string | null
          storage_path?: string | null
          thumb_url?: string | null
          variant_index?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_asset_variants_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "media_asset_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_calendar_items: {
        Row: {
          asset_metadata: Json | null
          asset_thumbnail_url: string | null
          asset_url: string | null
          blog_post_id: string | null
          campaign_id: string
          content_type: Database["public"]["Enums"]["media_content_type"]
          copy: string | null
          created_at: string
          cta: string | null
          edited_at: string | null
          edited_by: string | null
          generation_prompt: string | null
          hashtags: string[] | null
          id: string
          metadata: Json | null
          publish_results: Json | null
          published_at: string | null
          published_blog_at: string | null
          reference_urls: string[] | null
          scheduled_date: string
          scheduled_time: string | null
          status: Database["public"]["Enums"]["media_item_status"]
          target_channel: string | null
          target_platforms: string[] | null
          tenant_id: string
          title: string | null
          updated_at: string
          version: number | null
        }
        Insert: {
          asset_metadata?: Json | null
          asset_thumbnail_url?: string | null
          asset_url?: string | null
          blog_post_id?: string | null
          campaign_id: string
          content_type?: Database["public"]["Enums"]["media_content_type"]
          copy?: string | null
          created_at?: string
          cta?: string | null
          edited_at?: string | null
          edited_by?: string | null
          generation_prompt?: string | null
          hashtags?: string[] | null
          id?: string
          metadata?: Json | null
          publish_results?: Json | null
          published_at?: string | null
          published_blog_at?: string | null
          reference_urls?: string[] | null
          scheduled_date: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["media_item_status"]
          target_channel?: string | null
          target_platforms?: string[] | null
          tenant_id: string
          title?: string | null
          updated_at?: string
          version?: number | null
        }
        Update: {
          asset_metadata?: Json | null
          asset_thumbnail_url?: string | null
          asset_url?: string | null
          blog_post_id?: string | null
          campaign_id?: string
          content_type?: Database["public"]["Enums"]["media_content_type"]
          copy?: string | null
          created_at?: string
          cta?: string | null
          edited_at?: string | null
          edited_by?: string | null
          generation_prompt?: string | null
          hashtags?: string[] | null
          id?: string
          metadata?: Json | null
          publish_results?: Json | null
          published_at?: string | null
          published_blog_at?: string | null
          reference_urls?: string[] | null
          scheduled_date?: string
          scheduled_time?: string | null
          status?: Database["public"]["Enums"]["media_item_status"]
          target_channel?: string | null
          target_platforms?: string[] | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_calendar_items_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_calendar_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "media_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_calendar_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_campaigns: {
        Row: {
          ai_generated_context: Json | null
          approved_count: number | null
          auto_publish: boolean | null
          business_context: string | null
          created_at: string
          created_by: string | null
          days_of_week: number[] | null
          default_time: string | null
          description: string | null
          end_date: string
          excluded_dates: string[] | null
          id: string
          items_count: number | null
          metadata: Json | null
          months: number[] | null
          name: string
          prompt: string
          published_count: number | null
          start_date: string
          status: Database["public"]["Enums"]["media_campaign_status"]
          target_channel: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ai_generated_context?: Json | null
          approved_count?: number | null
          auto_publish?: boolean | null
          business_context?: string | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[] | null
          default_time?: string | null
          description?: string | null
          end_date: string
          excluded_dates?: string[] | null
          id?: string
          items_count?: number | null
          metadata?: Json | null
          months?: number[] | null
          name: string
          prompt: string
          published_count?: number | null
          start_date: string
          status?: Database["public"]["Enums"]["media_campaign_status"]
          target_channel?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ai_generated_context?: Json | null
          approved_count?: number | null
          auto_publish?: boolean | null
          business_context?: string | null
          created_at?: string
          created_by?: string | null
          days_of_week?: number[] | null
          default_time?: string | null
          description?: string | null
          end_date?: string
          excluded_dates?: string[] | null
          id?: string
          items_count?: number | null
          metadata?: Json | null
          months?: number[] | null
          name?: string
          prompt?: string
          published_count?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["media_campaign_status"]
          target_channel?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_category_profiles: {
        Row: {
          context_tokens: string[] | null
          created_at: string | null
          display_name: string
          fallback_enabled: boolean | null
          forbidden_actions: string[] | null
          id: string
          label_ocr_weight: number | null
          metadata: Json | null
          niche: string
          product_fidelity_weight: number | null
          qa_pass_threshold: number | null
          quality_weight: number | null
          temporal_stability_weight: number | null
          updated_at: string | null
        }
        Insert: {
          context_tokens?: string[] | null
          created_at?: string | null
          display_name: string
          fallback_enabled?: boolean | null
          forbidden_actions?: string[] | null
          id?: string
          label_ocr_weight?: number | null
          metadata?: Json | null
          niche: string
          product_fidelity_weight?: number | null
          qa_pass_threshold?: number | null
          quality_weight?: number | null
          temporal_stability_weight?: number | null
          updated_at?: string | null
        }
        Update: {
          context_tokens?: string[] | null
          created_at?: string | null
          display_name?: string
          fallback_enabled?: boolean | null
          forbidden_actions?: string[] | null
          id?: string
          label_ocr_weight?: number | null
          metadata?: Json | null
          niche?: string
          product_fidelity_weight?: number | null
          qa_pass_threshold?: number | null
          quality_weight?: number | null
          temporal_stability_weight?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
      media_preset_components: {
        Row: {
          compatible_niches: string[] | null
          component_type: string
          created_at: string | null
          id: string
          is_default: boolean | null
          metadata: Json | null
          name: string
          prompt_fragment: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          compatible_niches?: string[] | null
          component_type: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          name: string
          prompt_fragment: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          compatible_niches?: string[] | null
          component_type?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          metadata?: Json | null
          name?: string
          prompt_fragment?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      media_video_candidates: {
        Row: {
          candidate_index: number
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          final_score: number | null
          id: string
          is_best: boolean | null
          job_id: string
          label_ocr_score: number | null
          metadata: Json | null
          provider_request_id: string | null
          provider_response: Json | null
          qa_details: Json | null
          qa_passed: boolean | null
          quality_score: number | null
          similarity_score: number | null
          started_at: string | null
          status: string | null
          temporal_stability_score: number | null
          tenant_id: string
          thumbnail_url: string | null
          video_url: string | null
        }
        Insert: {
          candidate_index: number
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          final_score?: number | null
          id?: string
          is_best?: boolean | null
          job_id: string
          label_ocr_score?: number | null
          metadata?: Json | null
          provider_request_id?: string | null
          provider_response?: Json | null
          qa_details?: Json | null
          qa_passed?: boolean | null
          quality_score?: number | null
          similarity_score?: number | null
          started_at?: string | null
          status?: string | null
          temporal_stability_score?: number | null
          tenant_id: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Update: {
          candidate_index?: number
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          final_score?: number | null
          id?: string
          is_best?: boolean | null
          job_id?: string
          label_ocr_score?: number | null
          metadata?: Json | null
          provider_request_id?: string | null
          provider_response?: Json | null
          qa_details?: Json | null
          qa_passed?: boolean | null
          quality_score?: number | null
          similarity_score?: number | null
          started_at?: string | null
          status?: string | null
          temporal_stability_score?: number | null
          tenant_id?: string
          thumbnail_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_video_candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "media_video_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_video_candidates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_video_jobs: {
        Row: {
          best_candidate_id: string | null
          calendar_item_id: string | null
          campaign_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          current_stage: number | null
          duration_seconds: number | null
          error_message: string | null
          fallback_used: boolean | null
          id: string
          max_retries: number | null
          metadata: Json | null
          model: string | null
          niche: string | null
          original_prompt: string
          output_thumbnail_url: string | null
          output_url: string | null
          preset_id: string | null
          product_cutout_url: string | null
          product_id: string | null
          product_image_url: string | null
          product_mask_url: string | null
          provider: string | null
          qa_passed: boolean | null
          qa_scores: Json | null
          qa_threshold: number | null
          retry_count: number | null
          rewritten_prompt: string | null
          shot_plan: Json | null
          stage_results: Json | null
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
          variation_count: number | null
        }
        Insert: {
          best_candidate_id?: string | null
          calendar_item_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stage?: number | null
          duration_seconds?: number | null
          error_message?: string | null
          fallback_used?: boolean | null
          id?: string
          max_retries?: number | null
          metadata?: Json | null
          model?: string | null
          niche?: string | null
          original_prompt: string
          output_thumbnail_url?: string | null
          output_url?: string | null
          preset_id?: string | null
          product_cutout_url?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_mask_url?: string | null
          provider?: string | null
          qa_passed?: boolean | null
          qa_scores?: Json | null
          qa_threshold?: number | null
          retry_count?: number | null
          rewritten_prompt?: string | null
          shot_plan?: Json | null
          stage_results?: Json | null
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
          variation_count?: number | null
        }
        Update: {
          best_candidate_id?: string | null
          calendar_item_id?: string | null
          campaign_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          current_stage?: number | null
          duration_seconds?: number | null
          error_message?: string | null
          fallback_used?: boolean | null
          id?: string
          max_retries?: number | null
          metadata?: Json | null
          model?: string | null
          niche?: string | null
          original_prompt?: string
          output_thumbnail_url?: string | null
          output_url?: string | null
          preset_id?: string | null
          product_cutout_url?: string | null
          product_id?: string | null
          product_image_url?: string | null
          product_mask_url?: string | null
          provider?: string | null
          qa_passed?: boolean | null
          qa_scores?: Json | null
          qa_threshold?: number | null
          retry_count?: number | null
          rewritten_prompt?: string | null
          shot_plan?: Json | null
          stage_results?: Json | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
          variation_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_video_jobs_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "media_calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_video_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "media_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_video_jobs_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "media_video_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_video_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_video_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_video_presets: {
        Row: {
          audio_component_id: string | null
          camera_component_id: string | null
          created_at: string | null
          description: string | null
          duration_seconds: number
          id: string
          is_active: boolean | null
          is_default: boolean | null
          lighting_component_id: string | null
          metadata: Json | null
          name: string
          narrative_component_id: string | null
          scene_component_id: string | null
          slug: string
          target_niche: string | null
          variation_count: number | null
        }
        Insert: {
          audio_component_id?: string | null
          camera_component_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          lighting_component_id?: string | null
          metadata?: Json | null
          name: string
          narrative_component_id?: string | null
          scene_component_id?: string | null
          slug: string
          target_niche?: string | null
          variation_count?: number | null
        }
        Update: {
          audio_component_id?: string | null
          camera_component_id?: string | null
          created_at?: string | null
          description?: string | null
          duration_seconds?: number
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          lighting_component_id?: string | null
          metadata?: Json | null
          name?: string
          narrative_component_id?: string | null
          scene_component_id?: string | null
          slug?: string
          target_niche?: string | null
          variation_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_video_presets_audio_component_id_fkey"
            columns: ["audio_component_id"]
            isOneToOne: false
            referencedRelation: "media_preset_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_video_presets_camera_component_id_fkey"
            columns: ["camera_component_id"]
            isOneToOne: false
            referencedRelation: "media_preset_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_video_presets_lighting_component_id_fkey"
            columns: ["lighting_component_id"]
            isOneToOne: false
            referencedRelation: "media_preset_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_video_presets_narrative_component_id_fkey"
            columns: ["narrative_component_id"]
            isOneToOne: false
            referencedRelation: "media_preset_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_video_presets_scene_component_id_fkey"
            columns: ["scene_component_id"]
            isOneToOne: false
            referencedRelation: "media_preset_components"
            referencedColumns: ["id"]
          },
        ]
      }
      meli_listings: {
        Row: {
          attributes: Json | null
          available_quantity: number
          category_id: string | null
          condition: string
          created_at: string
          currency_id: string
          description: string | null
          error_message: string | null
          id: string
          images: Json | null
          listing_type: string
          meli_item_id: string | null
          meli_response: Json | null
          price: number
          product_id: string
          published_at: string | null
          shipping: Json | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attributes?: Json | null
          available_quantity?: number
          category_id?: string | null
          condition?: string
          created_at?: string
          currency_id?: string
          description?: string | null
          error_message?: string | null
          id?: string
          images?: Json | null
          listing_type?: string
          meli_item_id?: string | null
          meli_response?: Json | null
          price: number
          product_id: string
          published_at?: string | null
          shipping?: Json | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          attributes?: Json | null
          available_quantity?: number
          category_id?: string | null
          condition?: string
          created_at?: string
          currency_id?: string
          description?: string | null
          error_message?: string | null
          id?: string
          images?: Json | null
          listing_type?: string
          meli_item_id?: string | null
          meli_response?: Json | null
          price?: number
          product_id?: string
          published_at?: string | null
          shipping?: Json | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meli_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meli_listings_tenant_id_fkey"
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
      meta_ad_ads: {
        Row: {
          ad_account_id: string
          adset_id: string | null
          created_at: string
          creative_id: string | null
          effective_status: string | null
          id: string
          meta_ad_id: string
          meta_adset_id: string
          meta_campaign_id: string
          name: string
          status: string
          synced_at: string
          tenant_id: string
          tracking_specs: Json | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          adset_id?: string | null
          created_at?: string
          creative_id?: string | null
          effective_status?: string | null
          id?: string
          meta_ad_id: string
          meta_adset_id: string
          meta_campaign_id: string
          name: string
          status?: string
          synced_at?: string
          tenant_id: string
          tracking_specs?: Json | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          adset_id?: string | null
          created_at?: string
          creative_id?: string | null
          effective_status?: string | null
          id?: string
          meta_ad_id?: string
          meta_adset_id?: string
          meta_campaign_id?: string
          name?: string
          status?: string
          synced_at?: string
          tenant_id?: string
          tracking_specs?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_ads_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_adsets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_ads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_adsets: {
        Row: {
          ad_account_id: string
          bid_amount_cents: number | null
          billing_event: string | null
          campaign_id: string | null
          created_at: string
          daily_budget_cents: number | null
          effective_status: string | null
          end_time: string | null
          id: string
          lifetime_budget_cents: number | null
          meta_adset_id: string
          meta_campaign_id: string
          metadata: Json | null
          name: string
          optimization_goal: string | null
          start_time: string | null
          status: string
          synced_at: string | null
          targeting: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          bid_amount_cents?: number | null
          billing_event?: string | null
          campaign_id?: string | null
          created_at?: string
          daily_budget_cents?: number | null
          effective_status?: string | null
          end_time?: string | null
          id?: string
          lifetime_budget_cents?: number | null
          meta_adset_id: string
          meta_campaign_id: string
          metadata?: Json | null
          name: string
          optimization_goal?: string | null
          start_time?: string | null
          status?: string
          synced_at?: string | null
          targeting?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          bid_amount_cents?: number | null
          billing_event?: string | null
          campaign_id?: string | null
          created_at?: string
          daily_budget_cents?: number | null
          effective_status?: string | null
          end_time?: string | null
          id?: string
          lifetime_budget_cents?: number | null
          meta_adset_id?: string
          meta_campaign_id?: string
          metadata?: Json | null
          name?: string
          optimization_goal?: string | null
          start_time?: string | null
          status?: string
          synced_at?: string | null
          targeting?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_adsets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_adsets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_audiences: {
        Row: {
          ad_account_id: string
          approximate_count: number | null
          audience_type: string
          created_at: string
          description: string | null
          id: string
          lookalike_spec: Json | null
          meta_audience_id: string | null
          metadata: Json | null
          name: string
          rule: Json | null
          subtype: string | null
          synced_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          approximate_count?: number | null
          audience_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lookalike_spec?: Json | null
          meta_audience_id?: string | null
          metadata?: Json | null
          name: string
          rule?: Json | null
          subtype?: string | null
          synced_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          approximate_count?: number | null
          audience_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lookalike_spec?: Json | null
          meta_audience_id?: string | null
          metadata?: Json | null
          name?: string
          rule?: Json | null
          subtype?: string | null
          synced_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_audiences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_campaigns: {
        Row: {
          ad_account_id: string
          bid_strategy: string | null
          buying_type: string | null
          created_at: string
          daily_budget_cents: number | null
          effective_status: string | null
          id: string
          lifetime_budget_cents: number | null
          meta_campaign_id: string
          metadata: Json | null
          name: string
          objective: string | null
          special_ad_categories: string[] | null
          start_time: string | null
          status: string
          stop_time: string | null
          synced_at: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          bid_strategy?: string | null
          buying_type?: string | null
          created_at?: string
          daily_budget_cents?: number | null
          effective_status?: string | null
          id?: string
          lifetime_budget_cents?: number | null
          meta_campaign_id: string
          metadata?: Json | null
          name: string
          objective?: string | null
          special_ad_categories?: string[] | null
          start_time?: string | null
          status?: string
          stop_time?: string | null
          synced_at?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          bid_strategy?: string | null
          buying_type?: string | null
          created_at?: string
          daily_budget_cents?: number | null
          effective_status?: string | null
          id?: string
          lifetime_budget_cents?: number | null
          meta_campaign_id?: string
          metadata?: Json | null
          name?: string
          objective?: string | null
          special_ad_categories?: string[] | null
          start_time?: string | null
          status?: string
          stop_time?: string | null
          synced_at?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_creatives: {
        Row: {
          ad_account_id: string
          body: string | null
          call_to_action_type: string | null
          created_at: string
          id: string
          image_url: string | null
          link_url: string | null
          meta_creative_id: string | null
          metadata: Json | null
          name: string
          object_story_spec: Json | null
          synced_at: string | null
          tenant_id: string
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          ad_account_id: string
          body?: string | null
          call_to_action_type?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          meta_creative_id?: string | null
          metadata?: Json | null
          name: string
          object_story_spec?: Json | null
          synced_at?: string | null
          tenant_id: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          ad_account_id?: string
          body?: string | null
          call_to_action_type?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          link_url?: string | null
          meta_creative_id?: string | null
          metadata?: Json | null
          name?: string
          object_story_spec?: Json | null
          synced_at?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_creatives_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_insights: {
        Row: {
          actions: Json | null
          campaign_id: string | null
          clicks: number | null
          conversion_value_cents: number | null
          conversions: number | null
          cost_per_conversion_cents: number | null
          cpc_cents: number | null
          cpm_cents: number | null
          created_at: string
          ctr: number | null
          date_start: string
          date_stop: string
          frequency: number | null
          id: string
          impressions: number | null
          meta_campaign_id: string
          metadata: Json | null
          reach: number | null
          roas: number | null
          spend_cents: number | null
          synced_at: string | null
          tenant_id: string
        }
        Insert: {
          actions?: Json | null
          campaign_id?: string | null
          clicks?: number | null
          conversion_value_cents?: number | null
          conversions?: number | null
          cost_per_conversion_cents?: number | null
          cpc_cents?: number | null
          cpm_cents?: number | null
          created_at?: string
          ctr?: number | null
          date_start: string
          date_stop: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          meta_campaign_id: string
          metadata?: Json | null
          reach?: number | null
          roas?: number | null
          spend_cents?: number | null
          synced_at?: string | null
          tenant_id: string
        }
        Update: {
          actions?: Json | null
          campaign_id?: string | null
          clicks?: number | null
          conversion_value_cents?: number | null
          conversions?: number | null
          cost_per_conversion_cents?: number | null
          cpc_cents?: number | null
          cpm_cents?: number | null
          created_at?: string
          ctr?: number | null
          date_start?: string
          date_stop?: string
          frequency?: number | null
          id?: string
          impressions?: number | null
          meta_campaign_id?: string
          metadata?: Json | null
          reach?: number | null
          roas?: number | null
          spend_cents?: number | null
          synced_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_ad_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "meta_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_ad_insights_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_catalog_items: {
        Row: {
          catalog_id: string
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          meta_product_id: string | null
          metadata: Json | null
          product_id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          catalog_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          meta_product_id?: string | null
          metadata?: Json | null
          product_id: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          catalog_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          meta_product_id?: string | null
          metadata?: Json | null
          product_id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_catalog_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_catalog_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_live_streams: {
        Row: {
          created_at: string
          description: string | null
          ended_at: string | null
          id: string
          live_video_id: string | null
          metadata: Json | null
          page_id: string
          planned_start_time: string | null
          secure_stream_url: string | null
          started_at: string | null
          status: string
          stream_url: string | null
          tenant_id: string
          title: string | null
          updated_at: string
          viewer_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          live_video_id?: string | null
          metadata?: Json | null
          page_id: string
          planned_start_time?: string | null
          secure_stream_url?: string | null
          started_at?: string | null
          status?: string
          stream_url?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string
          viewer_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          ended_at?: string | null
          id?: string
          live_video_id?: string | null
          metadata?: Json | null
          page_id?: string
          planned_start_time?: string | null
          secure_stream_url?: string | null
          started_at?: string | null
          status?: string
          stream_url?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string
          viewer_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meta_live_streams_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          return_path: string | null
          scope_packs: string[]
          state_hash: string
          tenant_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          return_path?: string | null
          scope_packs?: string[]
          state_hash: string
          tenant_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          return_path?: string | null
          scope_packs?: string[]
          state_hash?: string
          tenant_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_oauth_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_whatsapp_onboarding_states: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          state_token: string
          tenant_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          state_token: string
          tenant_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          state_token?: string
          tenant_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_whatsapp_onboarding_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      module_tutorials: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_active: boolean
          module_key: string
          thumbnail_url: string | null
          title: string
          updated_at: string
          video_url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_key: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          video_url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_active?: boolean
          module_key?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          video_url?: string
        }
        Relationships: []
      }
      newsletter_popup_configs: {
        Row: {
          background_color: string | null
          birth_date_required: boolean | null
          button_bg_color: string | null
          button_text: string | null
          button_text_color: string | null
          created_at: string
          exclude_pages: string[] | null
          icon_image_url: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          layout: string
          list_id: string | null
          name: string
          name_required: boolean | null
          phone_required: boolean | null
          show_birth_date: boolean | null
          show_name: boolean | null
          show_on_pages: string[] | null
          show_once_per_session: boolean | null
          show_phone: boolean | null
          subtitle: string | null
          success_message: string | null
          tenant_id: string
          text_color: string | null
          title: string
          trigger_delay_seconds: number | null
          trigger_scroll_percent: number | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          background_color?: string | null
          birth_date_required?: boolean | null
          button_bg_color?: string | null
          button_text?: string | null
          button_text_color?: string | null
          created_at?: string
          exclude_pages?: string[] | null
          icon_image_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          layout?: string
          list_id?: string | null
          name: string
          name_required?: boolean | null
          phone_required?: boolean | null
          show_birth_date?: boolean | null
          show_name?: boolean | null
          show_on_pages?: string[] | null
          show_once_per_session?: boolean | null
          show_phone?: boolean | null
          subtitle?: string | null
          success_message?: string | null
          tenant_id: string
          text_color?: string | null
          title?: string
          trigger_delay_seconds?: number | null
          trigger_scroll_percent?: number | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          background_color?: string | null
          birth_date_required?: boolean | null
          button_bg_color?: string | null
          button_text?: string | null
          button_text_color?: string | null
          created_at?: string
          exclude_pages?: string[] | null
          icon_image_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          layout?: string
          list_id?: string | null
          name?: string
          name_required?: boolean | null
          phone_required?: boolean | null
          show_birth_date?: boolean | null
          show_name?: boolean | null
          show_on_pages?: string[] | null
          show_once_per_session?: boolean | null
          show_phone?: boolean | null
          subtitle?: string | null
          success_message?: string | null
          tenant_id?: string
          text_color?: string | null
          title?: string
          trigger_delay_seconds?: number | null
          trigger_scroll_percent?: number | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_popup_configs_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_popup_configs_tenant_id_fkey"
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
          barcode: string | null
          cost_price: number | null
          created_at: string
          discount_amount: number
          id: string
          image_file_id: string | null
          ncm: string | null
          order_id: string
          product_id: string | null
          product_image_url: string | null
          product_name: string
          product_slug: string | null
          quantity: number
          sku: string
          tax_amount: number | null
          tenant_id: string | null
          total_price: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
          weight: number | null
        }
        Insert: {
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          discount_amount?: number
          id?: string
          image_file_id?: string | null
          ncm?: string | null
          order_id: string
          product_id?: string | null
          product_image_url?: string | null
          product_name: string
          product_slug?: string | null
          quantity?: number
          sku: string
          tax_amount?: number | null
          tenant_id?: string | null
          total_price: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
          weight?: number | null
        }
        Update: {
          barcode?: string | null
          cost_price?: number | null
          created_at?: string
          discount_amount?: number
          id?: string
          image_file_id?: string | null
          ncm?: string | null
          order_id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string
          product_slug?: string | null
          quantity?: number
          sku?: string
          tax_amount?: number | null
          tenant_id?: string | null
          total_price?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_image_file_id_fkey"
            columns: ["image_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "order_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
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
          currency: string | null
          customer_cnpj: string | null
          customer_cpf: string | null
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
          fx_rate: number | null
          gateway_payload: Json | null
          id: string
          installment_value: number | null
          installments: number | null
          internal_notes: string | null
          marketplace_data: Json | null
          marketplace_order_id: string | null
          marketplace_source: string | null
          order_number: string
          paid_at: string | null
          payment_gateway: string | null
          payment_gateway_id: string | null
          payment_link_expires_at: string | null
          payment_link_url: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipped_at: string | null
          shipping_carrier: string | null
          shipping_city: string | null
          shipping_complement: string | null
          shipping_country: string | null
          shipping_estimated_days: number | null
          shipping_method_code: string | null
          shipping_method_name: string | null
          shipping_neighborhood: string | null
          shipping_number: string | null
          shipping_postal_code: string | null
          shipping_service_code: string | null
          shipping_service_name: string | null
          shipping_state: string | null
          shipping_status: Database["public"]["Enums"]["shipping_status"]
          shipping_street: string | null
          shipping_total: number
          source_hash: string | null
          source_order_number: string | null
          source_platform: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          tax_total: number
          tenant_id: string
          total: number
          tracking_code: string | null
          tracking_url: string | null
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
          currency?: string | null
          customer_cnpj?: string | null
          customer_cpf?: string | null
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
          fx_rate?: number | null
          gateway_payload?: Json | null
          id?: string
          installment_value?: number | null
          installments?: number | null
          internal_notes?: string | null
          marketplace_data?: Json | null
          marketplace_order_id?: string | null
          marketplace_source?: string | null
          order_number: string
          paid_at?: string | null
          payment_gateway?: string | null
          payment_gateway_id?: string | null
          payment_link_expires_at?: string | null
          payment_link_url?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipped_at?: string | null
          shipping_carrier?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_country?: string | null
          shipping_estimated_days?: number | null
          shipping_method_code?: string | null
          shipping_method_name?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_postal_code?: string | null
          shipping_service_code?: string | null
          shipping_service_name?: string | null
          shipping_state?: string | null
          shipping_status?: Database["public"]["Enums"]["shipping_status"]
          shipping_street?: string | null
          shipping_total?: number
          source_hash?: string | null
          source_order_number?: string | null
          source_platform?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          tenant_id: string
          total?: number
          tracking_code?: string | null
          tracking_url?: string | null
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
          currency?: string | null
          customer_cnpj?: string | null
          customer_cpf?: string | null
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
          fx_rate?: number | null
          gateway_payload?: Json | null
          id?: string
          installment_value?: number | null
          installments?: number | null
          internal_notes?: string | null
          marketplace_data?: Json | null
          marketplace_order_id?: string | null
          marketplace_source?: string | null
          order_number?: string
          paid_at?: string | null
          payment_gateway?: string | null
          payment_gateway_id?: string | null
          payment_link_expires_at?: string | null
          payment_link_url?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipped_at?: string | null
          shipping_carrier?: string | null
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_country?: string | null
          shipping_estimated_days?: number | null
          shipping_method_code?: string | null
          shipping_method_name?: string | null
          shipping_neighborhood?: string | null
          shipping_number?: string | null
          shipping_postal_code?: string | null
          shipping_service_code?: string | null
          shipping_service_name?: string | null
          shipping_state?: string | null
          shipping_status?: Database["public"]["Enums"]["shipping_status"]
          shipping_street?: string | null
          shipping_total?: number
          source_hash?: string | null
          source_order_number?: string | null
          source_platform?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          tax_total?: number
          tenant_id?: string
          total?: number
          tracking_code?: string | null
          tracking_url?: string | null
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
      plan_limits: {
        Row: {
          ai_images_per_month: number | null
          ai_videos_per_month: number | null
          assistant_interactions_per_month: number | null
          created_at: string
          creative_avatar_per_month: number | null
          creative_product_per_month: number | null
          creative_shorts_per_month: number | null
          creative_tech_per_month: number | null
          creative_ugc_ai_per_month: number | null
          creative_ugc_per_month: number | null
          extra_email_price_cents: number | null
          extra_support_price_cents: number | null
          extra_whatsapp_price_cents: number | null
          id: string
          import_uses_per_month: number | null
          included_email_notifications: number | null
          included_support_interactions: number | null
          included_whatsapp_notifications: number | null
          max_users: number | null
          orders_per_month: number | null
          plan_key: string
          sales_fee_bps: number | null
          seo_generations_per_month: number | null
          storage_bytes: number | null
          traffic_ads_accounts: number | null
          traffic_campaigns_per_month: number | null
          updated_at: string
        }
        Insert: {
          ai_images_per_month?: number | null
          ai_videos_per_month?: number | null
          assistant_interactions_per_month?: number | null
          created_at?: string
          creative_avatar_per_month?: number | null
          creative_product_per_month?: number | null
          creative_shorts_per_month?: number | null
          creative_tech_per_month?: number | null
          creative_ugc_ai_per_month?: number | null
          creative_ugc_per_month?: number | null
          extra_email_price_cents?: number | null
          extra_support_price_cents?: number | null
          extra_whatsapp_price_cents?: number | null
          id?: string
          import_uses_per_month?: number | null
          included_email_notifications?: number | null
          included_support_interactions?: number | null
          included_whatsapp_notifications?: number | null
          max_users?: number | null
          orders_per_month?: number | null
          plan_key: string
          sales_fee_bps?: number | null
          seo_generations_per_month?: number | null
          storage_bytes?: number | null
          traffic_ads_accounts?: number | null
          traffic_campaigns_per_month?: number | null
          updated_at?: string
        }
        Update: {
          ai_images_per_month?: number | null
          ai_videos_per_month?: number | null
          assistant_interactions_per_month?: number | null
          created_at?: string
          creative_avatar_per_month?: number | null
          creative_product_per_month?: number | null
          creative_shorts_per_month?: number | null
          creative_tech_per_month?: number | null
          creative_ugc_ai_per_month?: number | null
          creative_ugc_per_month?: number | null
          extra_email_price_cents?: number | null
          extra_support_price_cents?: number | null
          extra_whatsapp_price_cents?: number | null
          id?: string
          import_uses_per_month?: number | null
          included_email_notifications?: number | null
          included_support_interactions?: number | null
          included_whatsapp_notifications?: number | null
          max_users?: number | null
          orders_per_month?: number | null
          plan_key?: string
          sales_fee_bps?: number | null
          seo_generations_per_month?: number | null
          storage_bytes?: number | null
          traffic_ads_accounts?: number | null
          traffic_campaigns_per_month?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_limits_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: true
            referencedRelation: "billing_plans"
            referencedColumns: ["plan_key"]
          },
        ]
      }
      plan_module_access: {
        Row: {
          access_level: string
          allowed_features: Json | null
          blocked_features: Json | null
          created_at: string
          id: string
          module_key: string
          notes: string | null
          plan_key: string
        }
        Insert: {
          access_level?: string
          allowed_features?: Json | null
          blocked_features?: Json | null
          created_at?: string
          id?: string
          module_key: string
          notes?: string | null
          plan_key: string
        }
        Update: {
          access_level?: string
          allowed_features?: Json | null
          blocked_features?: Json | null
          created_at?: string
          id?: string
          module_key?: string
          notes?: string | null
          plan_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_module_access_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["plan_key"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json | null
          fee_bps: number
          is_active: boolean
          is_custom: boolean
          monthly_fee_cents: number
          name: string
          order_limit: number | null
          plan_key: string
          sort_order: number
          support_level: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json | null
          fee_bps?: number
          is_active?: boolean
          is_custom?: boolean
          monthly_fee_cents?: number
          name: string
          order_limit?: number | null
          plan_key: string
          sort_order?: number
          support_level?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json | null
          fee_bps?: number
          is_active?: boolean
          is_custom?: boolean
          monthly_fee_cents?: number
          name?: string
          order_limit?: number | null
          plan_key?: string
          sort_order?: number
          support_level?: string
          updated_at?: string
        }
        Relationships: []
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
      platform_announcements: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          link_text: string | null
          link_url: string | null
          message: string
          starts_at: string | null
          title: string
          updated_at: string
          variant: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_text?: string | null
          link_url?: string | null
          message: string
          starts_at?: string | null
          title: string
          updated_at?: string
          variant?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_text?: string | null
          link_url?: string | null
          message?: string
          starts_at?: string | null
          title?: string
          updated_at?: string
          variant?: string
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
      product_badge_assignments: {
        Row: {
          badge_id: string
          created_at: string
          id: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          badge_id: string
          created_at?: string
          id?: string
          product_id: string
          tenant_id: string
        }
        Update: {
          badge_id?: string
          created_at?: string
          id?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_badge_assignments_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "product_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_badge_assignments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_badge_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_badges: {
        Row: {
          background_color: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: string
          shape: string
          sort_order: number
          tenant_id: string
          text_color: string
          updated_at: string
        }
        Insert: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: string
          shape?: string
          sort_order?: number
          tenant_id: string
          text_color?: string
          updated_at?: string
        }
        Update: {
          background_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: string
          shape?: string
          sort_order?: number
          tenant_id?: string
          text_color?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_badges_tenant_id_fkey"
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
      product_category_profiles: {
        Row: {
          category_key: string
          constraints: Json | null
          created_at: string
          description: string | null
          display_name: string
          hard_fidelity_default: boolean | null
          id: string
          negative_rules: Json | null
          qa_label_weight: number | null
          qa_pass_threshold: number | null
          qa_quality_weight: number | null
          qa_ruleset: Json | null
          qa_similarity_weight: number | null
          recommended_preset_ids: string[] | null
          updated_at: string
        }
        Insert: {
          category_key: string
          constraints?: Json | null
          created_at?: string
          description?: string | null
          display_name: string
          hard_fidelity_default?: boolean | null
          id?: string
          negative_rules?: Json | null
          qa_label_weight?: number | null
          qa_pass_threshold?: number | null
          qa_quality_weight?: number | null
          qa_ruleset?: Json | null
          qa_similarity_weight?: number | null
          recommended_preset_ids?: string[] | null
          updated_at?: string
        }
        Update: {
          category_key?: string
          constraints?: Json | null
          created_at?: string
          description?: string | null
          display_name?: string
          hard_fidelity_default?: boolean | null
          id?: string
          negative_rules?: Json | null
          qa_label_weight?: number | null
          qa_pass_threshold?: number | null
          qa_quality_weight?: number | null
          qa_ruleset?: Json | null
          qa_similarity_weight?: number | null
          recommended_preset_ids?: string[] | null
          updated_at?: string
        }
        Relationships: []
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
          file_id: string | null
          id: string
          is_primary: boolean | null
          product_id: string
          sort_order: number | null
          tenant_id: string | null
          url: string
          variant_id: string | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          file_id?: string | null
          id?: string
          is_primary?: boolean | null
          product_id: string
          sort_order?: number | null
          tenant_id?: string | null
          url: string
          variant_id?: string | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          file_id?: string | null
          id?: string
          is_primary?: boolean | null
          product_id?: string
          sort_order?: number | null
          tenant_id?: string | null
          url?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      product_reference_assets: {
        Row: {
          brand_tokens: string[] | null
          category_override_key: string | null
          cutout_generated_at: string | null
          cutout_url: string | null
          detected_category_key: string | null
          id: string
          label_expected_text: string | null
          mask_url: string | null
          product_id: string
          reference_stills: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          brand_tokens?: string[] | null
          category_override_key?: string | null
          cutout_generated_at?: string | null
          cutout_url?: string | null
          detected_category_key?: string | null
          id?: string
          label_expected_text?: string | null
          mask_url?: string | null
          product_id: string
          reference_stills?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          brand_tokens?: string[] | null
          category_override_key?: string | null
          cutout_generated_at?: string | null
          cutout_url?: string | null
          detected_category_key?: string | null
          id?: string
          label_expected_text?: string | null
          mask_url?: string | null
          product_id?: string
          reference_stills?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reference_assets_category_override_key_fkey"
            columns: ["category_override_key"]
            isOneToOne: false
            referencedRelation: "product_category_profiles"
            referencedColumns: ["category_key"]
          },
          {
            foreignKeyName: "product_reference_assets_detected_category_key_fkey"
            columns: ["detected_category_key"]
            isOneToOne: false
            referencedRelation: "product_category_profiles"
            referencedColumns: ["category_key"]
          },
          {
            foreignKeyName: "product_reference_assets_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reference_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
          media_urls: string[] | null
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
          media_urls?: string[] | null
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
          media_urls?: string[] | null
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
      product_variant_type_options: {
        Row: {
          created_at: string
          id: string
          sort_order: number | null
          tenant_id: string
          value: string
          variant_type_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sort_order?: number | null
          tenant_id: string
          value: string
          variant_type_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sort_order?: number | null
          tenant_id?: string
          value?: string
          variant_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_type_options_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variant_type_options_variant_type_id_fkey"
            columns: ["variant_type_id"]
            isOneToOne: false
            referencedRelation: "product_variant_types"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant_types: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_types_tenant_id_fkey"
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
          depth: number | null
          gtin: string | null
          height: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          option1_name: string | null
          option1_value: string | null
          option2_name: string | null
          option2_value: string | null
          option3_name: string | null
          option3_value: string | null
          position: number | null
          price: number | null
          product_id: string
          promotion_end_date: string | null
          promotion_start_date: string | null
          requires_shipping: boolean | null
          sku: string
          stock_quantity: number
          taxable: boolean | null
          updated_at: string
          weight: number | null
          width: number | null
        }
        Insert: {
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          depth?: number | null
          gtin?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          option1_name?: string | null
          option1_value?: string | null
          option2_name?: string | null
          option2_value?: string | null
          option3_name?: string | null
          option3_value?: string | null
          position?: number | null
          price?: number | null
          product_id: string
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          requires_shipping?: boolean | null
          sku: string
          stock_quantity?: number
          taxable?: boolean | null
          updated_at?: string
          weight?: number | null
          width?: number | null
        }
        Update: {
          barcode?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          depth?: number | null
          gtin?: string | null
          height?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          option1_name?: string | null
          option1_value?: string | null
          option2_name?: string | null
          option2_value?: string | null
          option3_name?: string | null
          option3_value?: string | null
          position?: number | null
          price?: number | null
          product_id?: string
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          requires_shipping?: boolean | null
          sku?: string
          stock_quantity?: number
          taxable?: boolean | null
          updated_at?: string
          weight?: number | null
          width?: number | null
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
          brand: string | null
          cest: string | null
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          deleted_at: string | null
          depth: number | null
          description: string | null
          external_reference: string | null
          gtin: string | null
          has_variants: boolean | null
          height: number | null
          id: string
          is_featured: boolean | null
          low_stock_threshold: number | null
          manage_stock: boolean | null
          meta_keywords: string | null
          name: string
          ncm: string | null
          origin_code: string | null
          price: number
          product_format: string | null
          product_type: string | null
          promotion_end_date: string | null
          promotion_start_date: string | null
          published_at: string | null
          regulatory_info: Json | null
          requires_shipping: boolean | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string
          slug: string
          status: string
          stock_quantity: number
          stock_type: string | null
          tags: string[] | null
          tax_code: string | null
          taxable: boolean | null
          tenant_id: string
          uom: string | null
          updated_at: string
          vendor: string | null
          warranty_duration: string | null
          warranty_type: string | null
          weight: number | null
          width: number | null
        }
        Insert: {
          allow_backorder?: boolean | null
          barcode?: string | null
          brand?: string | null
          cest?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          depth?: number | null
          description?: string | null
          external_reference?: string | null
          gtin?: string | null
          has_variants?: boolean | null
          height?: number | null
          id?: string
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          manage_stock?: boolean | null
          meta_keywords?: string | null
          name: string
          ncm?: string | null
          origin_code?: string | null
          price: number
          product_format?: string | null
          product_type?: string | null
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          published_at?: string | null
          regulatory_info?: Json | null
          requires_shipping?: boolean | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku: string
          slug: string
          status?: string
          stock_quantity?: number
          stock_type?: string | null
          tags?: string[] | null
          tax_code?: string | null
          taxable?: boolean | null
          tenant_id: string
          uom?: string | null
          updated_at?: string
          vendor?: string | null
          warranty_duration?: string | null
          warranty_type?: string | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          allow_backorder?: boolean | null
          barcode?: string | null
          brand?: string | null
          cest?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          deleted_at?: string | null
          depth?: number | null
          description?: string | null
          external_reference?: string | null
          gtin?: string | null
          has_variants?: boolean | null
          height?: number | null
          id?: string
          is_featured?: boolean | null
          low_stock_threshold?: number | null
          manage_stock?: boolean | null
          meta_keywords?: string | null
          name?: string
          ncm?: string | null
          origin_code?: string | null
          price?: number
          product_format?: string | null
          product_type?: string | null
          promotion_end_date?: string | null
          promotion_start_date?: string | null
          published_at?: string | null
          regulatory_info?: Json | null
          requires_shipping?: boolean | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string
          slug?: string
          status?: string
          stock_quantity?: number
          stock_type?: string | null
          tags?: string[] | null
          tax_code?: string | null
          taxable?: boolean | null
          tenant_id?: string
          uom?: string | null
          updated_at?: string
          vendor?: string | null
          warranty_duration?: string | null
          warranty_type?: string | null
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
      quiz_questions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean | null
          mapping: Json | null
          media: Json | null
          options: Json | null
          order_index: number
          question: string
          quiz_id: string
          step_type: string
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          mapping?: Json | null
          media?: Json | null
          options?: Json | null
          order_index?: number
          question: string
          quiz_id: string
          step_type?: string
          tenant_id: string
          type: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean | null
          mapping?: Json | null
          media?: Json | null
          options?: Json | null
          order_index?: number
          question?: string
          quiz_id?: string
          step_type?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_responses: {
        Row: {
          answers: Json
          id: string
          metadata: Json | null
          quiz_id: string
          submitted_at: string
          subscriber_id: string | null
          tenant_id: string
        }
        Insert: {
          answers?: Json
          id?: string
          metadata?: Json | null
          quiz_id: string
          submitted_at?: string
          subscriber_id?: string | null
          tenant_id: string
        }
        Update: {
          answers?: Json
          id?: string
          metadata?: Json | null
          quiz_id?: string
          submitted_at?: string
          subscriber_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_responses_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_subscribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_responses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          intro_text: string | null
          list_id: string | null
          name: string
          outro_text: string | null
          settings: Json | null
          slug: string
          status: string
          tag_id: string | null
          tags_to_add: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          intro_text?: string | null
          list_id?: string | null
          name: string
          outro_text?: string | null
          settings?: Json | null
          slug: string
          status?: string
          tag_id?: string | null
          tags_to_add?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          intro_text?: string | null
          list_id?: string | null
          name?: string
          outro_text?: string | null
          settings?: Json | null
          slug?: string
          status?: string
          tag_id?: string | null
          tags_to_add?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_marketing_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_tenant_id_fkey"
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
      review_tokens: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_id: string | null
          expires_at: string
          id: string
          order_id: string
          tenant_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          expires_at?: string
          id?: string
          order_id: string
          tenant_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_id?: string | null
          expires_at?: string
          id?: string
          order_id?: string
          tenant_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_tokens_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
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
      shipping_custom_rules: {
        Row: {
          cep_end: string
          cep_start: string
          created_at: string
          delivery_days_max: number | null
          delivery_days_min: number | null
          id: string
          is_enabled: boolean
          min_order_cents: number | null
          name: string
          price_cents: number
          region_type: string
          sort_order: number
          tenant_id: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          cep_end: string
          cep_start: string
          created_at?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          is_enabled?: boolean
          min_order_cents?: number | null
          name: string
          price_cents?: number
          region_type: string
          sort_order?: number
          tenant_id: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cep_end?: string
          cep_start?: string
          created_at?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          is_enabled?: boolean
          min_order_cents?: number | null
          name?: string
          price_cents?: number
          region_type?: string
          sort_order?: number
          tenant_id?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_custom_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_free_rules: {
        Row: {
          cep_end: string
          cep_start: string
          created_at: string
          delivery_days_max: number | null
          delivery_days_min: number | null
          id: string
          is_enabled: boolean
          min_order_cents: number | null
          name: string
          region_type: string
          sort_order: number
          tenant_id: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          cep_end: string
          cep_start: string
          created_at?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          is_enabled?: boolean
          min_order_cents?: number | null
          name: string
          region_type: string
          sort_order?: number
          tenant_id: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cep_end?: string
          cep_start?: string
          created_at?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          is_enabled?: boolean
          min_order_cents?: number | null
          name?: string
          region_type?: string
          sort_order?: number
          tenant_id?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_free_rules_tenant_id_fkey"
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
      social_connections: {
        Row: {
          access_token: string | null
          connected_by: string | null
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          metadata: Json | null
          profile_data: Json | null
          provider: Database["public"]["Enums"]["social_provider"]
          provider_account_id: string | null
          provider_account_name: string | null
          provider_page_id: string | null
          refresh_token: string | null
          scopes: string[] | null
          status: Database["public"]["Enums"]["social_connection_status"]
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          profile_data?: Json | null
          provider: Database["public"]["Enums"]["social_provider"]
          provider_account_id?: string | null
          provider_account_name?: string | null
          provider_page_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["social_connection_status"]
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          connected_by?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          profile_data?: Json | null
          provider?: Database["public"]["Enums"]["social_provider"]
          provider_account_id?: string | null
          provider_account_name?: string | null
          provider_page_id?: string | null
          refresh_token?: string | null
          scopes?: string[] | null
          status?: Database["public"]["Enums"]["social_connection_status"]
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          api_response: Json | null
          calendar_item_id: string | null
          caption: string | null
          created_at: string
          created_by: string | null
          error_message: string | null
          hashtags: string[] | null
          id: string
          instagram_account_id: string | null
          link_url: string | null
          media_urls: string[] | null
          meta_container_id: string | null
          meta_post_id: string | null
          page_id: string
          page_name: string | null
          platform: string
          post_type: string
          published_at: string | null
          scheduled_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          api_response?: Json | null
          calendar_item_id?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          hashtags?: string[] | null
          id?: string
          instagram_account_id?: string | null
          link_url?: string | null
          media_urls?: string[] | null
          meta_container_id?: string | null
          meta_post_id?: string | null
          page_id: string
          page_name?: string | null
          platform: string
          post_type: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          api_response?: Json | null
          calendar_item_id?: string | null
          caption?: string | null
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          hashtags?: string[] | null
          id?: string
          instagram_account_id?: string | null
          link_url?: string | null
          media_urls?: string[] | null
          meta_container_id?: string | null
          meta_post_id?: string | null
          page_id?: string
          page_name?: string | null
          platform?: string
          post_type?: string
          published_at?: string | null
          scheduled_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "media_calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_tenant_id_fkey"
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
          auto_related_products: boolean | null
          benefit_config: Json | null
          business_cnpj: string | null
          business_cpf: string | null
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
          favicon_file_id: string | null
          favicon_files: Json | null
          favicon_url: string | null
          footer_style: string | null
          google_analytics_id: string | null
          header_style: string | null
          id: string
          is_published: boolean | null
          logo_file_id: string | null
          logo_url: string | null
          offers_config: Json | null
          primary_color: string | null
          published_template_id: string | null
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
          auto_related_products?: boolean | null
          benefit_config?: Json | null
          business_cnpj?: string | null
          business_cpf?: string | null
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
          favicon_file_id?: string | null
          favicon_files?: Json | null
          favicon_url?: string | null
          footer_style?: string | null
          google_analytics_id?: string | null
          header_style?: string | null
          id?: string
          is_published?: boolean | null
          logo_file_id?: string | null
          logo_url?: string | null
          offers_config?: Json | null
          primary_color?: string | null
          published_template_id?: string | null
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
          auto_related_products?: boolean | null
          benefit_config?: Json | null
          business_cnpj?: string | null
          business_cpf?: string | null
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
          favicon_file_id?: string | null
          favicon_files?: Json | null
          favicon_url?: string | null
          footer_style?: string | null
          google_analytics_id?: string | null
          header_style?: string | null
          id?: string
          is_published?: boolean | null
          logo_file_id?: string | null
          logo_url?: string | null
          offers_config?: Json | null
          primary_color?: string | null
          published_template_id?: string | null
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
            foreignKeyName: "store_settings_favicon_file_id_fkey"
            columns: ["favicon_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_settings_logo_file_id_fkey"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_settings_published_template_id_fkey"
            columns: ["published_template_id"]
            isOneToOne: false
            referencedRelation: "storefront_template_sets"
            referencedColumns: ["id"]
          },
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
          draft_checkout_footer_config: Json | null
          draft_checkout_header_config: Json | null
          draft_footer_config: Json | null
          draft_header_config: Json | null
          footer_config: Json
          footer_enabled: boolean
          header_config: Json
          header_enabled: boolean
          id: string
          published_checkout_footer_config: Json | null
          published_checkout_header_config: Json | null
          published_footer_config: Json | null
          published_header_config: Json | null
          show_footer_1: boolean
          show_footer_2: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          checkout_footer_config?: Json
          checkout_header_config?: Json
          created_at?: string
          draft_checkout_footer_config?: Json | null
          draft_checkout_header_config?: Json | null
          draft_footer_config?: Json | null
          draft_header_config?: Json | null
          footer_config?: Json
          footer_enabled?: boolean
          header_config?: Json
          header_enabled?: boolean
          id?: string
          published_checkout_footer_config?: Json | null
          published_checkout_header_config?: Json | null
          published_footer_config?: Json | null
          published_header_config?: Json | null
          show_footer_1?: boolean
          show_footer_2?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          checkout_footer_config?: Json
          checkout_header_config?: Json
          created_at?: string
          draft_checkout_footer_config?: Json | null
          draft_checkout_header_config?: Json | null
          draft_footer_config?: Json | null
          draft_header_config?: Json | null
          footer_config?: Json
          footer_enabled?: boolean
          header_config?: Json
          header_enabled?: boolean
          id?: string
          published_checkout_footer_config?: Json | null
          published_checkout_header_config?: Json | null
          published_footer_config?: Json | null
          published_header_config?: Json | null
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
      storefront_template_sets: {
        Row: {
          base_preset: string
          created_at: string
          draft_content: Json | null
          id: string
          is_archived: boolean | null
          is_published: boolean | null
          last_edited_at: string
          name: string
          published_content: Json | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          base_preset?: string
          created_at?: string
          draft_content?: Json | null
          id?: string
          is_archived?: boolean | null
          is_published?: boolean | null
          last_edited_at?: string
          name: string
          published_content?: Json | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          base_preset?: string
          created_at?: string
          draft_content?: Json | null
          id?: string
          is_archived?: boolean | null
          is_published?: boolean | null
          last_edited_at?: string
          name?: string
          published_content?: Json | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_template_sets_tenant_id_fkey"
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
      supplier_lead_interactions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          occurred_at: string
          summary: string | null
          supplier_id: string
          tenant_id: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at?: string
          summary?: string | null
          supplier_id: string
          tenant_id: string
          type?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          occurred_at?: string
          summary?: string | null
          supplier_id?: string
          tenant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_lead_interactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "supplier_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_lead_interactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_leads: {
        Row: {
          category: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          id: string
          last_contact_at: string | null
          lead_time_days: number | null
          location: string | null
          moq: string | null
          name: string
          notes: string | null
          price_notes: string | null
          status: string
          tags: Json | null
          tenant_id: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          category?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          last_contact_at?: string | null
          lead_time_days?: number | null
          location?: string | null
          moq?: string | null
          name: string
          notes?: string | null
          price_notes?: string | null
          status?: string
          tags?: Json | null
          tenant_id: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          category?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          last_contact_at?: string | null
          lead_time_days?: number | null
          location?: string | null
          moq?: string | null
          name?: string
          notes?: string | null
          price_notes?: string | null
          status?: string
          tags?: Json | null
          tenant_id?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
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
          is_active: boolean
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
          is_active?: boolean
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
          is_active?: boolean
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
      support_ticket_attachments: {
        Row: {
          created_at: string
          file_id: string | null
          id: string
          message_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          file_id?: string | null
          id?: string
          message_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          file_id?: string | null
          id?: string
          message_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_ticket_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_attachments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_type: string
          sender_user_id: string
          tenant_id: string
          ticket_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_type: string
          sender_user_id: string
          tenant_id: string
          ticket_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_type?: string
          sender_user_id?: string
          tenant_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          created_by: string
          id: string
          last_message_at: string | null
          priority: string
          status: string
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string | null
          priority?: string
          status?: string
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string | null
          priority?: string
          status?: string
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
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
      tenant_addons: {
        Row: {
          addon_key: string
          created_at: string
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          price_cents: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          addon_key: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          price_cents?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          addon_key?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          price_cents?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_addons_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ai_subscriptions: {
        Row: {
          created_at: string
          credits_remaining: number
          expires_at: string | null
          id: string
          package_id: string
          started_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits_remaining?: number
          expires_at?: string | null
          id?: string
          package_id: string
          started_at?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits_remaining?: number
          expires_at?: string | null
          id?: string
          package_id?: string
          started_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ai_subscriptions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ai_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_ai_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ai_usage: {
        Row: {
          created_at: string
          credits_used: number
          feature: string
          id: string
          metadata: Json | null
          subscription_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          feature: string
          id?: string
          metadata?: Json | null
          subscription_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          feature?: string
          id?: string
          metadata?: Json | null
          subscription_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ai_usage_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "tenant_ai_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_ai_usage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_brand_context: {
        Row: {
          auto_generated_at: string | null
          banned_claims: string[] | null
          brand_summary: string | null
          created_at: string | null
          do_not_do: string[] | null
          id: string
          manually_edited_at: string | null
          packshot_url: string | null
          products_focus: Json | null
          tenant_id: string
          tone_of_voice: string | null
          updated_at: string | null
          visual_style_guidelines: string | null
        }
        Insert: {
          auto_generated_at?: string | null
          banned_claims?: string[] | null
          brand_summary?: string | null
          created_at?: string | null
          do_not_do?: string[] | null
          id?: string
          manually_edited_at?: string | null
          packshot_url?: string | null
          products_focus?: Json | null
          tenant_id: string
          tone_of_voice?: string | null
          updated_at?: string | null
          visual_style_guidelines?: string | null
        }
        Update: {
          auto_generated_at?: string | null
          banned_claims?: string[] | null
          brand_summary?: string | null
          created_at?: string | null
          do_not_do?: string[] | null
          id?: string
          manually_edited_at?: string | null
          packshot_url?: string | null
          products_focus?: Json | null
          tenant_id?: string
          tone_of_voice?: string | null
          updated_at?: string | null
          visual_style_guidelines?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_brand_context_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
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
      tenant_feature_overrides: {
        Row: {
          created_at: string
          feature_key: string
          id: string
          is_enabled: boolean
          note: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feature_key: string
          id?: string
          is_enabled: boolean
          note?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feature_key?: string
          id?: string
          is_enabled?: boolean
          note?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_feature_overrides_tenant_id_fkey"
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
      tenant_invoices: {
        Row: {
          addons_cents: number
          ai_fee_cents: number
          base_fee_cents: number
          created_at: string
          discount_cents: number
          due_date: string | null
          id: string
          line_items: Json | null
          metadata: Json | null
          paid_at: string | null
          payment_method: string | null
          payment_provider_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          total_cents: number
          updated_at: string
          variable_fee_cents: number
          year_month: string
        }
        Insert: {
          addons_cents?: number
          ai_fee_cents?: number
          base_fee_cents?: number
          created_at?: string
          discount_cents?: number
          due_date?: string | null
          id?: string
          line_items?: Json | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          payment_provider_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          total_cents?: number
          updated_at?: string
          variable_fee_cents?: number
          year_month: string
        }
        Update: {
          addons_cents?: number
          ai_fee_cents?: number
          base_fee_cents?: number
          created_at?: string
          discount_cents?: number
          due_date?: string | null
          id?: string
          line_items?: Json | null
          metadata?: Json | null
          paid_at?: string | null
          payment_method?: string | null
          payment_provider_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id?: string
          total_cents?: number
          updated_at?: string
          variable_fee_cents?: number
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_monthly_usage: {
        Row: {
          ai_audio_duration_seconds: number | null
          ai_audio_transcription_count: number | null
          ai_embedding_tokens: number | null
          ai_handoff_count: number | null
          ai_image_analysis_count: number | null
          ai_messages_count: number | null
          ai_usage_cents: number
          created_at: string
          email_notifications_count: number | null
          extra_email_cents: number | null
          extra_support_cents: number | null
          extra_whatsapp_cents: number | null
          gmv_cents: number
          id: string
          limit_blocked_at: string | null
          limit_warning_shown_at: string | null
          metadata: Json | null
          orders_count: number
          over_limit: boolean
          support_interactions_count: number | null
          tenant_id: string
          updated_at: string
          whatsapp_notifications_count: number | null
          year_month: string
        }
        Insert: {
          ai_audio_duration_seconds?: number | null
          ai_audio_transcription_count?: number | null
          ai_embedding_tokens?: number | null
          ai_handoff_count?: number | null
          ai_image_analysis_count?: number | null
          ai_messages_count?: number | null
          ai_usage_cents?: number
          created_at?: string
          email_notifications_count?: number | null
          extra_email_cents?: number | null
          extra_support_cents?: number | null
          extra_whatsapp_cents?: number | null
          gmv_cents?: number
          id?: string
          limit_blocked_at?: string | null
          limit_warning_shown_at?: string | null
          metadata?: Json | null
          orders_count?: number
          over_limit?: boolean
          support_interactions_count?: number | null
          tenant_id: string
          updated_at?: string
          whatsapp_notifications_count?: number | null
          year_month: string
        }
        Update: {
          ai_audio_duration_seconds?: number | null
          ai_audio_transcription_count?: number | null
          ai_embedding_tokens?: number | null
          ai_handoff_count?: number | null
          ai_image_analysis_count?: number | null
          ai_messages_count?: number | null
          ai_usage_cents?: number
          created_at?: string
          email_notifications_count?: number | null
          extra_email_cents?: number | null
          extra_support_cents?: number | null
          extra_whatsapp_cents?: number | null
          gmv_cents?: number
          id?: string
          limit_blocked_at?: string | null
          limit_warning_shown_at?: string | null
          metadata?: Json | null
          orders_count?: number
          over_limit?: boolean
          support_interactions_count?: number | null
          tenant_id?: string
          updated_at?: string
          whatsapp_notifications_count?: number | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_monthly_usage_tenant_id_fkey"
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
      tenant_subscriptions: {
        Row: {
          activated_at: string | null
          billing_cycle: string | null
          cancelled_at: string | null
          card_brand: string | null
          card_last_four: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          mp_customer_id: string | null
          mp_payment_method: Json | null
          mp_preapproval_id: string | null
          payment_method_type: string | null
          payment_provider: string | null
          plan_key: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          suspended_at: string | null
          tenant_id: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          activated_at?: string | null
          billing_cycle?: string | null
          cancelled_at?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          mp_customer_id?: string | null
          mp_payment_method?: Json | null
          mp_preapproval_id?: string | null
          payment_method_type?: string | null
          payment_provider?: string | null
          plan_key: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended_at?: string | null
          tenant_id: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          activated_at?: string | null
          billing_cycle?: string | null
          cancelled_at?: string | null
          card_brand?: string | null
          card_last_four?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          mp_customer_id?: string | null
          mp_payment_method?: Json | null
          mp_preapproval_id?: string | null
          payment_method_type?: string | null
          payment_provider?: string | null
          plan_key?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          suspended_at?: string | null
          tenant_id?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_key_fkey"
            columns: ["plan_key"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["plan_key"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          permissions: Json | null
          revoked_at: string | null
          tenant_id: string
          token: string
          updated_at: string | null
          user_type: Database["public"]["Enums"]["tenant_user_type"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          permissions?: Json | null
          revoked_at?: string | null
          tenant_id: string
          token: string
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["tenant_user_type"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          permissions?: Json | null
          revoked_at?: string | null
          tenant_id?: string
          token?: string
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["tenant_user_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tenant_user_invitations_tenant_id_fkey"
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
          is_special: boolean
          logo_url: string | null
          name: string
          next_order_number: number
          plan: Database["public"]["Enums"]["tenant_plan"]
          settings: Json | null
          slug: string
          type: Database["public"]["Enums"]["tenant_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_special?: boolean
          logo_url?: string | null
          name: string
          next_order_number?: number
          plan?: Database["public"]["Enums"]["tenant_plan"]
          settings?: Json | null
          slug: string
          type?: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_special?: boolean
          logo_url?: string | null
          name?: string
          next_order_number?: number
          plan?: Database["public"]["Enums"]["tenant_plan"]
          settings?: Json | null
          slug?: string
          type?: Database["public"]["Enums"]["tenant_type"]
          updated_at?: string
        }
        Relationships: []
      }
      tiktok_ad_campaigns: {
        Row: {
          advertiser_id: string
          bid_type: string | null
          budget_cents: number | null
          budget_mode: string | null
          campaign_type: string | null
          created_at: string | null
          end_time: string | null
          id: string
          metadata: Json | null
          name: string
          objective_type: string | null
          optimize_goal: string | null
          special_industries: string[] | null
          start_time: string | null
          status: string
          synced_at: string | null
          tenant_id: string
          tiktok_campaign_id: string
          updated_at: string | null
        }
        Insert: {
          advertiser_id: string
          bid_type?: string | null
          budget_cents?: number | null
          budget_mode?: string | null
          campaign_type?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          metadata?: Json | null
          name: string
          objective_type?: string | null
          optimize_goal?: string | null
          special_industries?: string[] | null
          start_time?: string | null
          status?: string
          synced_at?: string | null
          tenant_id: string
          tiktok_campaign_id: string
          updated_at?: string | null
        }
        Update: {
          advertiser_id?: string
          bid_type?: string | null
          budget_cents?: number | null
          budget_mode?: string | null
          campaign_type?: string | null
          created_at?: string | null
          end_time?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          objective_type?: string | null
          optimize_goal?: string | null
          special_industries?: string[] | null
          start_time?: string | null
          status?: string
          synced_at?: string | null
          tenant_id?: string
          tiktok_campaign_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_ad_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_ad_insights: {
        Row: {
          advertiser_id: string
          campaign_id: string | null
          clicks: number | null
          comments: number | null
          conversion_value_cents: number | null
          conversions: number | null
          cpc_cents: number | null
          cpm_cents: number | null
          created_at: string | null
          ctr: number | null
          date_start: string
          date_stop: string
          follows: number | null
          frequency: number | null
          id: string
          impressions: number | null
          likes: number | null
          metadata: Json | null
          reach: number | null
          roas: number | null
          shares: number | null
          spend_cents: number | null
          synced_at: string | null
          tenant_id: string
          tiktok_campaign_id: string
          video_views: number | null
          video_watched_2s: number | null
          video_watched_6s: number | null
        }
        Insert: {
          advertiser_id: string
          campaign_id?: string | null
          clicks?: number | null
          comments?: number | null
          conversion_value_cents?: number | null
          conversions?: number | null
          cpc_cents?: number | null
          cpm_cents?: number | null
          created_at?: string | null
          ctr?: number | null
          date_start: string
          date_stop: string
          follows?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metadata?: Json | null
          reach?: number | null
          roas?: number | null
          shares?: number | null
          spend_cents?: number | null
          synced_at?: string | null
          tenant_id: string
          tiktok_campaign_id: string
          video_views?: number | null
          video_watched_2s?: number | null
          video_watched_6s?: number | null
        }
        Update: {
          advertiser_id?: string
          campaign_id?: string | null
          clicks?: number | null
          comments?: number | null
          conversion_value_cents?: number | null
          conversions?: number | null
          cpc_cents?: number | null
          cpm_cents?: number | null
          created_at?: string | null
          ctr?: number | null
          date_start?: string
          date_stop?: string
          follows?: number | null
          frequency?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          metadata?: Json | null
          reach?: number | null
          roas?: number | null
          shares?: number | null
          spend_cents?: number | null
          synced_at?: string | null
          tenant_id?: string
          tiktok_campaign_id?: string
          video_views?: number | null
          video_watched_2s?: number | null
          video_watched_6s?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_ad_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "tiktok_ad_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_ad_insights_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_ads_connections: {
        Row: {
          access_token: string | null
          advertiser_id: string | null
          advertiser_name: string | null
          assets: Json | null
          connected_at: string | null
          connected_by: string | null
          connection_status: string | null
          created_at: string | null
          granted_scopes: string[] | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_sync_at: string | null
          refresh_token: string | null
          scope_packs: string[] | null
          tenant_id: string
          tiktok_user_id: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token?: string | null
          advertiser_id?: string | null
          advertiser_name?: string | null
          assets?: Json | null
          connected_at?: string | null
          connected_by?: string | null
          connection_status?: string | null
          created_at?: string | null
          granted_scopes?: string[] | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          scope_packs?: string[] | null
          tenant_id: string
          tiktok_user_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string | null
          advertiser_id?: string | null
          advertiser_name?: string | null
          assets?: Json | null
          connected_at?: string | null
          connected_by?: string | null
          connection_status?: string | null
          created_at?: string | null
          granted_scopes?: string[] | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token?: string | null
          scope_packs?: string[] | null
          tenant_id?: string
          tiktok_user_id?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_ads_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_content_analytics: {
        Row: {
          audience_territories: Json | null
          average_time_watched: number | null
          comments: number | null
          created_at: string
          date: string
          full_video_watched_rate: number | null
          id: string
          impression_sources: Json | null
          likes: number | null
          metadata: Json | null
          open_id: string | null
          reach: number | null
          shares: number | null
          synced_at: string | null
          tenant_id: string
          tiktok_video_id: string
          total_time_watched: number | null
          video_id: string | null
          views: number | null
        }
        Insert: {
          audience_territories?: Json | null
          average_time_watched?: number | null
          comments?: number | null
          created_at?: string
          date: string
          full_video_watched_rate?: number | null
          id?: string
          impression_sources?: Json | null
          likes?: number | null
          metadata?: Json | null
          open_id?: string | null
          reach?: number | null
          shares?: number | null
          synced_at?: string | null
          tenant_id: string
          tiktok_video_id: string
          total_time_watched?: number | null
          video_id?: string | null
          views?: number | null
        }
        Update: {
          audience_territories?: Json | null
          average_time_watched?: number | null
          comments?: number | null
          created_at?: string
          date?: string
          full_video_watched_rate?: number | null
          id?: string
          impression_sources?: Json | null
          likes?: number | null
          metadata?: Json | null
          open_id?: string | null
          reach?: number | null
          shares?: number | null
          synced_at?: string | null
          tenant_id?: string
          tiktok_video_id?: string
          total_time_watched?: number | null
          video_id?: string | null
          views?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_content_analytics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_content_analytics_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "tiktok_content_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_content_connections: {
        Row: {
          access_token: string | null
          assets: Json | null
          avatar_url: string | null
          connected_at: string | null
          connected_by: string
          connection_status: string | null
          created_at: string
          display_name: string | null
          granted_scopes: string[] | null
          id: string
          is_active: boolean | null
          last_error: string | null
          open_id: string | null
          refresh_expires_at: string | null
          refresh_token: string | null
          scope_packs: string[] | null
          tenant_id: string
          token_expires_at: string | null
          union_id: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          assets?: Json | null
          avatar_url?: string | null
          connected_at?: string | null
          connected_by: string
          connection_status?: string | null
          created_at?: string
          display_name?: string | null
          granted_scopes?: string[] | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          open_id?: string | null
          refresh_expires_at?: string | null
          refresh_token?: string | null
          scope_packs?: string[] | null
          tenant_id: string
          token_expires_at?: string | null
          union_id?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          assets?: Json | null
          avatar_url?: string | null
          connected_at?: string | null
          connected_by?: string
          connection_status?: string | null
          created_at?: string
          display_name?: string | null
          granted_scopes?: string[] | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          open_id?: string | null
          refresh_expires_at?: string | null
          refresh_token?: string | null
          scope_packs?: string[] | null
          tenant_id?: string
          token_expires_at?: string | null
          union_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_content_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_content_videos: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          error_message: string | null
          height: number | null
          id: string
          metadata: Json | null
          open_id: string | null
          privacy_level: string | null
          publish_id: string | null
          published_at: string | null
          scheduled_at: string | null
          share_url: string | null
          status: string
          tenant_id: string
          tiktok_video_id: string | null
          title: string
          updated_at: string
          upload_status: string | null
          video_url: string | null
          width: number | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          open_id?: string | null
          privacy_level?: string | null
          publish_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          share_url?: string | null
          status?: string
          tenant_id: string
          tiktok_video_id?: string | null
          title: string
          updated_at?: string
          upload_status?: string | null
          video_url?: string | null
          width?: number | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          open_id?: string | null
          privacy_level?: string | null
          publish_id?: string | null
          published_at?: string | null
          scheduled_at?: string | null
          share_url?: string | null
          status?: string
          tenant_id?: string
          tiktok_video_id?: string | null
          title?: string
          updated_at?: string
          upload_status?: string | null
          video_url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_content_videos_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          product: string | null
          return_path: string | null
          scope_packs: string[] | null
          state_hash: string
          tenant_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          product?: string | null
          return_path?: string | null
          scope_packs?: string[] | null
          state_hash: string
          tenant_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          product?: string | null
          return_path?: string | null
          scope_packs?: string[] | null
          state_hash?: string
          tenant_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_oauth_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_shop_connections: {
        Row: {
          access_token: string | null
          assets: Json | null
          connected_at: string | null
          connected_by: string | null
          connection_status: string
          created_at: string
          granted_scopes: string[] | null
          id: string
          is_active: boolean
          last_error: string | null
          refresh_token: string | null
          scope_packs: string[] | null
          seller_id: string | null
          shop_id: string | null
          shop_name: string | null
          shop_region: string | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          assets?: Json | null
          connected_at?: string | null
          connected_by?: string | null
          connection_status?: string
          created_at?: string
          granted_scopes?: string[] | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          refresh_token?: string | null
          scope_packs?: string[] | null
          seller_id?: string | null
          shop_id?: string | null
          shop_name?: string | null
          shop_region?: string | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          assets?: Json | null
          connected_at?: string | null
          connected_by?: string | null
          connection_status?: string
          created_at?: string
          granted_scopes?: string[] | null
          id?: string
          is_active?: boolean
          last_error?: string | null
          refresh_token?: string | null
          scope_packs?: string[] | null
          seller_id?: string | null
          shop_id?: string | null
          shop_name?: string | null
          shop_region?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_shop_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_shop_fulfillments: {
        Row: {
          carrier_code: string | null
          carrier_name: string | null
          created_at: string
          fulfillment_data: Json | null
          id: string
          last_error: string | null
          pickup_slot: Json | null
          shipment_id: string | null
          shipping_provider_id: string | null
          status: string
          submitted_at: string | null
          tenant_id: string
          tiktok_fulfillment_status: string | null
          tiktok_order_id: string
          tiktok_package_id: string | null
          tiktok_shop_order_id: string | null
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          carrier_code?: string | null
          carrier_name?: string | null
          created_at?: string
          fulfillment_data?: Json | null
          id?: string
          last_error?: string | null
          pickup_slot?: Json | null
          shipment_id?: string | null
          shipping_provider_id?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id: string
          tiktok_fulfillment_status?: string | null
          tiktok_order_id: string
          tiktok_package_id?: string | null
          tiktok_shop_order_id?: string | null
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          carrier_code?: string | null
          carrier_name?: string | null
          created_at?: string
          fulfillment_data?: Json | null
          id?: string
          last_error?: string | null
          pickup_slot?: Json | null
          shipment_id?: string | null
          shipping_provider_id?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          tiktok_fulfillment_status?: string | null
          tiktok_order_id?: string
          tiktok_package_id?: string | null
          tiktok_shop_order_id?: string | null
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_shop_fulfillments_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_shop_fulfillments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_shop_fulfillments_tiktok_shop_order_id_fkey"
            columns: ["tiktok_shop_order_id"]
            isOneToOne: false
            referencedRelation: "tiktok_shop_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_shop_orders: {
        Row: {
          buyer_email: string | null
          buyer_name: string | null
          buyer_phone: string | null
          created_at: string
          currency: string | null
          id: string
          items: Json | null
          last_error: string | null
          order_data: Json | null
          order_id: string | null
          order_total_cents: number | null
          shipping_address: Json | null
          status: string
          synced_at: string | null
          tenant_id: string
          tiktok_order_id: string
          tiktok_status: string | null
          updated_at: string
        }
        Insert: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          items?: Json | null
          last_error?: string | null
          order_data?: Json | null
          order_id?: string | null
          order_total_cents?: number | null
          shipping_address?: Json | null
          status?: string
          synced_at?: string | null
          tenant_id: string
          tiktok_order_id: string
          tiktok_status?: string | null
          updated_at?: string
        }
        Update: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_phone?: string | null
          created_at?: string
          currency?: string | null
          id?: string
          items?: Json | null
          last_error?: string | null
          order_data?: Json | null
          order_id?: string | null
          order_total_cents?: number | null
          shipping_address?: Json | null
          status?: string
          synced_at?: string | null
          tenant_id?: string
          tiktok_order_id?: string
          tiktok_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_shop_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_shop_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_shop_products: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          metadata: Json | null
          product_id: string
          status: string
          sync_action: string
          tenant_id: string
          tiktok_category_id: string | null
          tiktok_product_id: string | null
          tiktok_sku_id: string | null
          tiktok_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json | null
          product_id: string
          status?: string
          sync_action?: string
          tenant_id: string
          tiktok_category_id?: string | null
          tiktok_product_id?: string | null
          tiktok_sku_id?: string | null
          tiktok_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          metadata?: Json | null
          product_id?: string
          status?: string
          sync_action?: string
          tenant_id?: string
          tiktok_category_id?: string | null
          tiktok_product_id?: string | null
          tiktok_sku_id?: string | null
          tiktok_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_shop_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_shop_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tiktok_shop_returns: {
        Row: {
          buyer_comments: string | null
          created_at: string
          currency: string
          id: string
          items: Json | null
          last_error: string | null
          order_id: string | null
          reason: string | null
          refund_amount_cents: number | null
          requested_at: string | null
          resolved_at: string | null
          return_carrier: string | null
          return_data: Json | null
          return_shipping_status: string | null
          return_tracking_code: string | null
          return_type: string
          seller_comments: string | null
          status: string
          synced_at: string | null
          tenant_id: string
          tiktok_order_id: string
          tiktok_return_id: string | null
          tiktok_shop_order_id: string | null
          tiktok_status: string | null
          updated_at: string
        }
        Insert: {
          buyer_comments?: string | null
          created_at?: string
          currency?: string
          id?: string
          items?: Json | null
          last_error?: string | null
          order_id?: string | null
          reason?: string | null
          refund_amount_cents?: number | null
          requested_at?: string | null
          resolved_at?: string | null
          return_carrier?: string | null
          return_data?: Json | null
          return_shipping_status?: string | null
          return_tracking_code?: string | null
          return_type?: string
          seller_comments?: string | null
          status?: string
          synced_at?: string | null
          tenant_id: string
          tiktok_order_id: string
          tiktok_return_id?: string | null
          tiktok_shop_order_id?: string | null
          tiktok_status?: string | null
          updated_at?: string
        }
        Update: {
          buyer_comments?: string | null
          created_at?: string
          currency?: string
          id?: string
          items?: Json | null
          last_error?: string | null
          order_id?: string | null
          reason?: string | null
          refund_amount_cents?: number | null
          requested_at?: string | null
          resolved_at?: string | null
          return_carrier?: string | null
          return_data?: Json | null
          return_shipping_status?: string | null
          return_tracking_code?: string | null
          return_type?: string
          seller_comments?: string | null
          status?: string
          synced_at?: string | null
          tenant_id?: string
          tiktok_order_id?: string
          tiktok_return_id?: string | null
          tiktok_shop_order_id?: string | null
          tiktok_status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tiktok_shop_returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_shop_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiktok_shop_returns_tiktok_shop_order_id_fkey"
            columns: ["tiktok_shop_order_id"]
            isOneToOne: false
            referencedRelation: "tiktok_shop_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          permissions: Json | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          updated_at: string | null
          user_id: string
          user_type: Database["public"]["Enums"]["tenant_user_type"] | null
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          permissions?: Json | null
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          updated_at?: string | null
          user_id: string
          user_type?: Database["public"]["Enums"]["tenant_user_type"] | null
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          permissions?: Json | null
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          updated_at?: string | null
          user_id?: string
          user_type?: Database["public"]["Enums"]["tenant_user_type"] | null
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
      voice_presets: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          language: string | null
          name: string
          ref_audio_url: string | null
          ref_text: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name: string
          ref_audio_url?: string | null
          ref_text?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          name?: string
          ref_audio_url?: string | null
          ref_text?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
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
          access_token: string | null
          business_id: string | null
          client_token: string | null
          connection_status: string | null
          created_at: string
          display_phone_number: string | null
          id: string
          instance_id: string | null
          instance_token: string | null
          is_enabled: boolean | null
          last_connected_at: string | null
          last_disconnected_at: string | null
          last_error: string | null
          phone_number: string | null
          phone_number_id: string | null
          provider: string
          qr_code: string | null
          qr_expires_at: string | null
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
          verified_name: string | null
          waba_id: string | null
          webhook_url: string | null
        }
        Insert: {
          access_token?: string | null
          business_id?: string | null
          client_token?: string | null
          connection_status?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          is_enabled?: boolean | null
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          last_error?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          qr_code?: string | null
          qr_expires_at?: string | null
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          access_token?: string | null
          business_id?: string | null
          client_token?: string | null
          connection_status?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          instance_id?: string | null
          instance_token?: string | null
          is_enabled?: boolean | null
          last_connected_at?: string | null
          last_disconnected_at?: string | null
          last_error?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          provider?: string
          qr_code?: string | null
          qr_expires_at?: string | null
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          waba_id?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbound_messages: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          external_message_id: string | null
          from_phone: string
          id: string
          media_url: string | null
          message_content: string | null
          message_type: string | null
          processed_at: string | null
          processed_by: string | null
          provider: string
          raw_payload: Json | null
          tenant_id: string
          timestamp: string
          to_phone: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          external_message_id?: string | null
          from_phone: string
          id?: string
          media_url?: string | null
          message_content?: string | null
          message_type?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider?: string
          raw_payload?: Json | null
          tenant_id: string
          timestamp: string
          to_phone?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          external_message_id?: string | null
          from_phone?: string
          id?: string
          media_url?: string | null
          message_content?: string | null
          message_type?: string | null
          processed_at?: string | null
          processed_by?: string | null
          provider?: string
          raw_payload?: Json | null
          tenant_id?: string
          timestamp?: string
          to_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
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
      youtube_analytics: {
        Row: {
          average_view_duration_seconds: number | null
          average_view_percentage: number | null
          comments: number | null
          ctr: number | null
          demographics: Json | null
          dislikes: number | null
          fetched_at: string
          id: string
          likes: number | null
          period_end: string
          period_start: string
          shares: number | null
          tenant_id: string
          traffic_sources: Json | null
          video_id: string
          views: number | null
          watch_time_minutes: number | null
        }
        Insert: {
          average_view_duration_seconds?: number | null
          average_view_percentage?: number | null
          comments?: number | null
          ctr?: number | null
          demographics?: Json | null
          dislikes?: number | null
          fetched_at?: string
          id?: string
          likes?: number | null
          period_end: string
          period_start: string
          shares?: number | null
          tenant_id: string
          traffic_sources?: Json | null
          video_id: string
          views?: number | null
          watch_time_minutes?: number | null
        }
        Update: {
          average_view_duration_seconds?: number | null
          average_view_percentage?: number | null
          comments?: number | null
          ctr?: number | null
          demographics?: Json | null
          dislikes?: number | null
          fetched_at?: string
          id?: string
          likes?: number | null
          period_end?: string
          period_start?: string
          shares?: number | null
          tenant_id?: string
          traffic_sources?: Json | null
          video_id?: string
          views?: number | null
          watch_time_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_analytics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_connections: {
        Row: {
          access_token: string
          channel_custom_url: string | null
          channel_id: string
          channel_thumbnail_url: string | null
          channel_title: string | null
          connected_by: string | null
          connection_status: string
          created_at: string
          id: string
          is_active: boolean
          last_error: string | null
          last_sync_at: string | null
          metadata: Json | null
          oauth_error_code: string | null
          oauth_error_details: Json | null
          profile_data: Json | null
          quota_reset_at: string | null
          quota_used_today: number | null
          refresh_token: string
          scopes: string[] | null
          subscriber_count: number | null
          tenant_id: string
          token_expires_at: string
          token_type: string | null
          updated_at: string
          video_count: number | null
        }
        Insert: {
          access_token: string
          channel_custom_url?: string | null
          channel_id: string
          channel_thumbnail_url?: string | null
          channel_title?: string | null
          connected_by?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          oauth_error_code?: string | null
          oauth_error_details?: Json | null
          profile_data?: Json | null
          quota_reset_at?: string | null
          quota_used_today?: number | null
          refresh_token: string
          scopes?: string[] | null
          subscriber_count?: number | null
          tenant_id: string
          token_expires_at: string
          token_type?: string | null
          updated_at?: string
          video_count?: number | null
        }
        Update: {
          access_token?: string
          channel_custom_url?: string | null
          channel_id?: string
          channel_thumbnail_url?: string | null
          channel_title?: string | null
          connected_by?: string | null
          connection_status?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          metadata?: Json | null
          oauth_error_code?: string | null
          oauth_error_details?: Json | null
          profile_data?: Json | null
          quota_reset_at?: string | null
          quota_used_today?: number | null
          refresh_token?: string
          scopes?: string[] | null
          subscriber_count?: number | null
          tenant_id?: string
          token_expires_at?: string
          token_type?: string | null
          updated_at?: string
          video_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          redirect_url: string | null
          scopes: string[] | null
          state: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          redirect_url?: string | null
          scopes?: string[] | null
          state: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          redirect_url?: string | null
          scopes?: string[] | null
          state?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_oauth_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_uploads: {
        Row: {
          actual_publish_at: string | null
          calendar_item_id: string | null
          category_id: string | null
          completed_at: string | null
          connection_id: string
          created_at: string
          credits_consumed: number | null
          credits_reserved: number | null
          description: string | null
          error_message: string | null
          file_mime_type: string | null
          file_path: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          idempotency_key: string | null
          metadata: Json | null
          privacy_status: string
          publish_at: string | null
          publish_status: string | null
          retry_count: number | null
          scheduled_publish_at_utc: string | null
          started_at: string | null
          status: string
          tags: string[] | null
          tenant_id: string
          thumbnail_uploaded: boolean | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          upload_progress: number | null
          youtube_thumbnail_url: string | null
          youtube_video_id: string | null
          youtube_video_url: string | null
        }
        Insert: {
          actual_publish_at?: string | null
          calendar_item_id?: string | null
          category_id?: string | null
          completed_at?: string | null
          connection_id: string
          created_at?: string
          credits_consumed?: number | null
          credits_reserved?: number | null
          description?: string | null
          error_message?: string | null
          file_mime_type?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          privacy_status?: string
          publish_at?: string | null
          publish_status?: string | null
          retry_count?: number | null
          scheduled_publish_at_utc?: string | null
          started_at?: string | null
          status?: string
          tags?: string[] | null
          tenant_id: string
          thumbnail_uploaded?: boolean | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          upload_progress?: number | null
          youtube_thumbnail_url?: string | null
          youtube_video_id?: string | null
          youtube_video_url?: string | null
        }
        Update: {
          actual_publish_at?: string | null
          calendar_item_id?: string | null
          category_id?: string | null
          completed_at?: string | null
          connection_id?: string
          created_at?: string
          credits_consumed?: number | null
          credits_reserved?: number | null
          description?: string | null
          error_message?: string | null
          file_mime_type?: string | null
          file_path?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json | null
          privacy_status?: string
          publish_at?: string | null
          publish_status?: string | null
          retry_count?: number | null
          scheduled_publish_at_utc?: string | null
          started_at?: string | null
          status?: string
          tags?: string[] | null
          tenant_id?: string
          thumbnail_uploaded?: boolean | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          upload_progress?: number | null
          youtube_thumbnail_url?: string | null
          youtube_video_id?: string | null
          youtube_video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youtube_uploads_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "media_calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_uploads_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "youtube_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youtube_uploads_tenant_id_fkey"
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
      accept_invitation: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      add_credits: {
        Args: {
          p_bonus: number
          p_credits: number
          p_description?: string
          p_idempotency_key: string
          p_tenant_id: string
        }
        Returns: number
      }
      calculate_youtube_upload_credits: {
        Args: {
          p_file_size_bytes: number
          p_include_captions?: boolean
          p_include_thumbnail?: boolean
        }
        Returns: number
      }
      check_credit_balance: {
        Args: { p_credits_needed: number; p_tenant_id: string }
        Returns: {
          credits_missing: number
          current_balance: number
          has_balance: boolean
        }[]
      }
      check_module_access: {
        Args: { p_module_key: string; p_tenant_id: string }
        Returns: Json
      }
      check_tenant_order_limit: {
        Args: { p_tenant_id: string }
        Returns: {
          current_count: number
          hard_enforcement_enabled: boolean
          is_over_limit: boolean
          order_limit: number
          plan_key: string
        }[]
      }
      cleanup_expired_google_oauth_states: { Args: never; Returns: undefined }
      cleanup_expired_meta_oauth_states: { Args: never; Returns: undefined }
      cleanup_expired_tiktok_oauth_states: { Args: never; Returns: undefined }
      cleanup_expired_youtube_oauth_states: { Args: never; Returns: undefined }
      consume_credits: {
        Args: {
          p_cost_usd: number
          p_credits: number
          p_feature: string
          p_from_reserve?: boolean
          p_idempotency_key: string
          p_job_id?: string
          p_model: string
          p_provider: string
          p_tenant_id: string
          p_units_json: Json
          p_user_id: string
        }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
        }[]
      }
      create_tenant_for_user: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          created_at: string
          id: string
          is_special: boolean
          logo_url: string | null
          name: string
          next_order_number: number
          plan: Database["public"]["Enums"]["tenant_plan"]
          settings: Json | null
          slug: string
          type: Database["public"]["Enums"]["tenant_type"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "tenants"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_billing_checkout_token: {
        Args: { p_session_id: string }
        Returns: string
      }
      generate_order_number: { Args: { p_tenant_id: string }; Returns: string }
      generate_review_token: {
        Args: {
          p_customer_email?: string
          p_customer_id?: string
          p_order_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      generate_tenant_invoice: {
        Args: { p_tenant_id: string; p_year_month: string }
        Returns: string
      }
      generate_unsubscribe_token: {
        Args: { p_subscriber_id: string; p_tenant_id: string }
        Returns: string
      }
      get_ai_memories: {
        Args: {
          p_ai_agent: string
          p_limit?: number
          p_tenant_id: string
          p_user_id: string
        }
        Returns: {
          category: string
          content: string
          created_at: string
          id: string
          importance: number
          scope: string
        }[]
      }
      get_auth_user_email: { Args: never; Returns: string }
      get_current_tenant_id: { Args: { _user_id: string }; Returns: string }
      get_current_year_month: { Args: never; Returns: string }
      get_discount_usage: { Args: { p_discount_id: string }; Returns: number }
      get_discount_usage_by_customer: {
        Args: { p_discount_id: string; p_email: string }
        Returns: number
      }
      get_ibge_municipio_codigo: {
        Args: { p_cidade: string; p_uf: string }
        Returns: string
      }
      get_list_contacts_by_tag: {
        Args: { p_list_id: string }
        Returns: {
          customer_id: string
          email: string
          full_name: string
          phone: string
        }[]
      }
      get_list_member_count: { Args: { p_list_id: string }; Returns: number }
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
      get_recent_conversation_summaries: {
        Args: {
          p_ai_agent: string
          p_limit?: number
          p_tenant_id: string
          p_user_id: string
        }
        Returns: {
          created_at: string
          key_decisions: Json
          key_topics: string[]
          summary: string
        }[]
      }
      get_tenant_module_access: { Args: { p_tenant_id: string }; Returns: Json }
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
      increment_ai_metrics: {
        Args: {
          p_audio_count?: number
          p_audio_seconds?: number
          p_embedding_tokens?: number
          p_handoffs?: number
          p_images?: number
          p_messages?: number
          p_no_evidence?: number
          p_tenant_id: string
        }
        Returns: undefined
      }
      increment_blog_view_count: {
        Args: { post_id: string }
        Returns: undefined
      }
      increment_creative_usage: {
        Args: { p_cost_cents: number; p_tenant_id: string }
        Returns: undefined
      }
      increment_tenant_order_usage: {
        Args: { p_order_total_cents: number; p_tenant_id: string }
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
      is_owner_of_member_tenant: {
        Args: { p_member_id: string; p_owner_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_platform_admin_by_auth: { Args: never; Returns: boolean }
      is_tenant_owner: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      is_youtube_available_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      migrate_existing_templates_to_sets: { Args: never; Returns: undefined }
      normalize_email: { Args: { p_email: string }; Returns: string }
      record_ai_usage: {
        Args: { p_tenant_id: string; p_usage_cents: number }
        Returns: undefined
      }
      record_notification_usage: {
        Args: { p_channel: string; p_count?: number; p_tenant_id: string }
        Returns: Json
      }
      reserve_credits: {
        Args: {
          p_credits: number
          p_idempotency_key: string
          p_job_id?: string
          p_tenant_id: string
        }
        Returns: {
          error_message: string
          new_balance: number
          success: boolean
        }[]
      }
      search_knowledge_base: {
        Args: {
          p_query_embedding: string
          p_tenant_id: string
          p_threshold?: number
          p_top_k?: number
        }
        Returns: {
          chunk_id: string
          chunk_text: string
          doc_id: string
          doc_priority: number
          doc_title: string
          doc_type: string
          similarity: number
        }[]
      }
      sync_list_subscribers_from_tag: {
        Args: { p_list_id: string }
        Returns: Json
      }
      sync_subscriber_to_customer_with_tag: {
        Args: {
          p_birth_date?: string
          p_email: string
          p_list_id?: string
          p_name?: string
          p_phone?: string
          p_source?: string
          p_tenant_id: string
        }
        Returns: {
          customer_id: string
          is_new_customer: boolean
          is_new_subscriber: boolean
          subscriber_id: string
        }[]
      }
      update_customer_order_stats: {
        Args: { p_tenant_id: string }
        Returns: {
          total_customers: number
          updated_count: number
        }[]
      }
      update_import_job_batch: {
        Args: {
          p_batch_failed: number
          p_batch_imported: number
          p_batch_processed: number
          p_batch_skipped: number
          p_errors?: Json
          p_job_id: string
        }
        Returns: undefined
      }
      update_import_job_module:
        | {
            Args: {
              p_current: number
              p_errors?: Json
              p_failed?: number
              p_imported?: number
              p_job_id: string
              p_module: string
              p_skipped?: number
              p_total: number
              p_updated?: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_current: number
              p_failed: number
              p_imported: number
              p_job_id: string
              p_module: string
              p_skipped: number
              p_total: number
              p_updated: number
            }
            Returns: undefined
          }
      user_belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_tenant_access: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      validate_billing_checkout_token: {
        Args: { p_token: string }
        Returns: string
      }
      validate_invitation_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          invitation_id: string
          permissions: Json
          tenant_id: string
          tenant_name: string
          user_type: Database["public"]["Enums"]["tenant_user_type"]
        }[]
      }
      validate_review_token: {
        Args: { p_token: string }
        Returns: {
          customer_email: string
          customer_id: string
          is_valid: boolean
          order_id: string
          store_url: string
          tenant_id: string
          token_id: string
        }[]
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
      b2b_consent_status: "pending" | "opted_in" | "opted_out" | "unknown"
      b2b_job_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "cancelled"
      b2b_source_type: "cnpj_api" | "poi_api" | "enrichment_provider" | "manual"
      conversation_status:
        | "new"
        | "open"
        | "waiting_customer"
        | "waiting_agent"
        | "bot"
        | "resolved"
        | "spam"
      creative_job_status: "queued" | "running" | "succeeded" | "failed"
      creative_type:
        | "ugc_client_video"
        | "ugc_ai_video"
        | "short_video"
        | "tech_product_video"
        | "product_image"
        | "avatar_mascot"
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
      invoice_status: "draft" | "open" | "paid" | "failed" | "cancelled"
      mailbox_status: "pending_dns" | "active" | "error" | "disabled"
      media_campaign_status:
        | "draft"
        | "planning"
        | "generating"
        | "ready"
        | "active"
        | "paused"
        | "completed"
        | "archived"
      media_content_type:
        | "image"
        | "video"
        | "carousel"
        | "story"
        | "reel"
        | "text"
      media_item_status:
        | "draft"
        | "suggested"
        | "review"
        | "approved"
        | "generating_asset"
        | "asset_review"
        | "scheduled"
        | "publishing"
        | "published"
        | "failed"
        | "skipped"
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
      social_connection_status:
        | "disconnected"
        | "connecting"
        | "connected"
        | "error"
        | "expired"
      social_provider:
        | "instagram"
        | "facebook"
        | "tiktok"
        | "youtube"
        | "linkedin"
        | "twitter"
        | "pinterest"
      subscription_status:
        | "pending_payment_method"
        | "active"
        | "suspended"
        | "cancelled"
      support_channel_type:
        | "whatsapp"
        | "email"
        | "facebook_messenger"
        | "instagram_dm"
        | "mercadolivre"
        | "shopee"
        | "chat"
      tenant_plan: "start" | "growth" | "scale" | "enterprise" | "unlimited"
      tenant_type: "platform" | "customer"
      tenant_user_type:
        | "owner"
        | "manager"
        | "editor"
        | "attendant"
        | "assistant"
        | "viewer"
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
      b2b_consent_status: ["pending", "opted_in", "opted_out", "unknown"],
      b2b_job_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "cancelled",
      ],
      b2b_source_type: ["cnpj_api", "poi_api", "enrichment_provider", "manual"],
      conversation_status: [
        "new",
        "open",
        "waiting_customer",
        "waiting_agent",
        "bot",
        "resolved",
        "spam",
      ],
      creative_job_status: ["queued", "running", "succeeded", "failed"],
      creative_type: [
        "ugc_client_video",
        "ugc_ai_video",
        "short_video",
        "tech_product_video",
        "product_image",
        "avatar_mascot",
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
      invoice_status: ["draft", "open", "paid", "failed", "cancelled"],
      mailbox_status: ["pending_dns", "active", "error", "disabled"],
      media_campaign_status: [
        "draft",
        "planning",
        "generating",
        "ready",
        "active",
        "paused",
        "completed",
        "archived",
      ],
      media_content_type: [
        "image",
        "video",
        "carousel",
        "story",
        "reel",
        "text",
      ],
      media_item_status: [
        "draft",
        "suggested",
        "review",
        "approved",
        "generating_asset",
        "asset_review",
        "scheduled",
        "publishing",
        "published",
        "failed",
        "skipped",
      ],
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
      social_connection_status: [
        "disconnected",
        "connecting",
        "connected",
        "error",
        "expired",
      ],
      social_provider: [
        "instagram",
        "facebook",
        "tiktok",
        "youtube",
        "linkedin",
        "twitter",
        "pinterest",
      ],
      subscription_status: [
        "pending_payment_method",
        "active",
        "suspended",
        "cancelled",
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
      tenant_plan: ["start", "growth", "scale", "enterprise", "unlimited"],
      tenant_type: ["platform", "customer"],
      tenant_user_type: [
        "owner",
        "manager",
        "editor",
        "attendant",
        "assistant",
        "viewer",
      ],
    },
  },
} as const
