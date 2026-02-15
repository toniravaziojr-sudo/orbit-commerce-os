
-- =============================================
-- GESTOR DE TRÁFEGO IA — FASE 1: BANCO DE DADOS
-- 3 tabelas: configs, actions, sessions
-- =============================================

-- 1. ads_autopilot_configs
CREATE TABLE public.ads_autopilot_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'global', 'meta', 'google', 'tiktok'
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  budget_mode TEXT NOT NULL DEFAULT 'monthly', -- 'daily' / 'monthly'
  budget_cents INTEGER NOT NULL DEFAULT 0,
  allocation_mode TEXT NOT NULL DEFAULT 'auto', -- 'auto' / 'manual'
  max_share_pct INTEGER NOT NULL DEFAULT 80,
  min_share_pct INTEGER NOT NULL DEFAULT 0,
  objective TEXT NOT NULL DEFAULT 'sales', -- 'sales', 'traffic', 'leads'
  user_instructions TEXT,
  ai_model TEXT NOT NULL DEFAULT 'openai/gpt-5.2',
  safety_rules JSONB NOT NULL DEFAULT '{
    "gross_margin_pct": 50,
    "max_cpa_cents": null,
    "min_roas": 2.0,
    "max_budget_change_pct_day": 10,
    "max_actions_per_session": 10,
    "allowed_actions": ["pause_campaign", "adjust_budget", "report_insight", "allocate_budget"]
  }'::jsonb,
  lock_session_id UUID,
  lock_expires_at TIMESTAMPTZ,
  last_analysis_at TIMESTAMPTZ,
  total_actions_executed INTEGER NOT NULL DEFAULT 0,
  total_credits_consumed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, channel)
);

ALTER TABLE public.ads_autopilot_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant autopilot configs"
  ON public.ads_autopilot_configs FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant autopilot configs"
  ON public.ads_autopilot_configs FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant autopilot configs"
  ON public.ads_autopilot_configs FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can delete own tenant autopilot configs"
  ON public.ads_autopilot_configs FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

CREATE TRIGGER update_ads_autopilot_configs_updated_at
  BEFORE UPDATE ON public.ads_autopilot_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. ads_autopilot_sessions
CREATE TABLE public.ads_autopilot_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- 'global', 'meta', 'google', 'tiktok'
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'scheduled', 'reactive'
  context_snapshot JSONB,
  ai_response_raw TEXT,
  actions_planned INTEGER NOT NULL DEFAULT 0,
  actions_executed INTEGER NOT NULL DEFAULT 0,
  actions_rejected INTEGER NOT NULL DEFAULT 0,
  insights_generated JSONB,
  integration_status JSONB,
  cost_credits INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_autopilot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant autopilot sessions"
  ON public.ads_autopilot_sessions FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant autopilot sessions"
  ON public.ads_autopilot_sessions FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE INDEX idx_autopilot_sessions_tenant_channel ON public.ads_autopilot_sessions(tenant_id, channel);
CREATE INDEX idx_autopilot_sessions_created ON public.ads_autopilot_sessions(created_at DESC);

-- 3. ads_autopilot_actions
CREATE TABLE public.ads_autopilot_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.ads_autopilot_sessions(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  action_type TEXT NOT NULL, -- 'pause_campaign', 'adjust_budget', 'create_campaign', 'generate_creative', 'allocate_budget', 'report_insight'
  action_data JSONB,
  reasoning TEXT,
  expected_impact TEXT,
  confidence TEXT, -- 'high', 'medium', 'low'
  metric_trigger TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'validated', 'executed', 'failed', 'rejected'
  rejection_reason TEXT,
  rollback_data JSONB,
  action_hash TEXT UNIQUE,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ads_autopilot_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tenant autopilot actions"
  ON public.ads_autopilot_actions FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can insert own tenant autopilot actions"
  ON public.ads_autopilot_actions FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Users can update own tenant autopilot actions"
  ON public.ads_autopilot_actions FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE INDEX idx_autopilot_actions_tenant_channel ON public.ads_autopilot_actions(tenant_id, channel);
CREATE INDEX idx_autopilot_actions_session ON public.ads_autopilot_actions(session_id);
CREATE INDEX idx_autopilot_actions_status ON public.ads_autopilot_actions(status);
CREATE INDEX idx_autopilot_actions_created ON public.ads_autopilot_actions(created_at DESC);
