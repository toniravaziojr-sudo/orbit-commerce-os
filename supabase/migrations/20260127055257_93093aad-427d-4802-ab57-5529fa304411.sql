-- ===========================================
-- AI PACKAGES MODULE - Database Structure
-- ===========================================

-- Table: ai_packages (Platform managed)
-- Stores the available AI credit packages
CREATE TABLE public.ai_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_packages ENABLE ROW LEVEL SECURITY;

-- Public read access (anyone can see active packages)
CREATE POLICY "Anyone can view active packages"
ON public.ai_packages FOR SELECT
USING (is_active = true);

-- Platform admins can manage all packages
CREATE POLICY "Platform admins can manage packages"
ON public.ai_packages FOR ALL
USING (public.is_platform_admin_by_auth());

-- Table: tenant_ai_subscriptions
-- Stores tenant subscriptions to AI packages
CREATE TABLE public.tenant_ai_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.ai_packages(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_ai_subscriptions ENABLE ROW LEVEL SECURITY;

-- Tenants can view their own subscriptions
CREATE POLICY "Tenants can view own subscriptions"
ON public.tenant_ai_subscriptions FOR SELECT
USING (public.user_has_tenant_access(tenant_id));

-- Tenants can insert their own subscriptions
CREATE POLICY "Tenants can create own subscriptions"
ON public.tenant_ai_subscriptions FOR INSERT
WITH CHECK (public.user_has_tenant_access(tenant_id));

-- Tenants can update their own subscriptions
CREATE POLICY "Tenants can update own subscriptions"
ON public.tenant_ai_subscriptions FOR UPDATE
USING (public.user_has_tenant_access(tenant_id));

-- Platform admins can manage all subscriptions
CREATE POLICY "Platform admins can manage subscriptions"
ON public.tenant_ai_subscriptions FOR ALL
USING (public.is_platform_admin_by_auth());

-- Table: tenant_ai_usage
-- Tracks AI credit consumption per tenant
CREATE TABLE public.tenant_ai_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.tenant_ai_subscriptions(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tenant_ai_usage ENABLE ROW LEVEL SECURITY;

-- Tenants can view their own usage
CREATE POLICY "Tenants can view own usage"
ON public.tenant_ai_usage FOR SELECT
USING (public.user_has_tenant_access(tenant_id));

-- Tenants can insert their own usage (via edge functions)
CREATE POLICY "Tenants can record own usage"
ON public.tenant_ai_usage FOR INSERT
WITH CHECK (public.user_has_tenant_access(tenant_id));

-- Platform admins can view all usage
CREATE POLICY "Platform admins can view all usage"
ON public.tenant_ai_usage FOR SELECT
USING (public.is_platform_admin_by_auth());

-- Indexes for performance
CREATE INDEX idx_ai_packages_active ON public.ai_packages(is_active, sort_order);
CREATE INDEX idx_tenant_ai_subscriptions_tenant ON public.tenant_ai_subscriptions(tenant_id, status);
CREATE INDEX idx_tenant_ai_subscriptions_package ON public.tenant_ai_subscriptions(package_id);
CREATE INDEX idx_tenant_ai_usage_tenant ON public.tenant_ai_usage(tenant_id, created_at DESC);
CREATE INDEX idx_tenant_ai_usage_subscription ON public.tenant_ai_usage(subscription_id);

-- Triggers for updated_at
CREATE TRIGGER update_ai_packages_updated_at
BEFORE UPDATE ON public.ai_packages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_ai_subscriptions_updated_at
BEFORE UPDATE ON public.tenant_ai_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();