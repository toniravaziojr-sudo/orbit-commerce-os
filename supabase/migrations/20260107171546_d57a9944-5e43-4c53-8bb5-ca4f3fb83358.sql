-- Late Integration Tables

-- 1) Onboarding states for OAuth CSRF protection
CREATE TABLE public.late_onboarding_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  state_token text NOT NULL UNIQUE,
  redirect_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at timestamptz
);

CREATE INDEX idx_late_onboarding_states_token ON public.late_onboarding_states(state_token);
CREATE INDEX idx_late_onboarding_states_tenant ON public.late_onboarding_states(tenant_id);

-- 2) Late connections per tenant
CREATE TABLE public.late_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error', 'expired')),
  late_profile_id text,
  late_profile_name text,
  connected_accounts jsonb DEFAULT '[]'::jsonb,
  scopes text[],
  last_error text,
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_late_connections_tenant ON public.late_connections(tenant_id);
CREATE INDEX idx_late_connections_status ON public.late_connections(status);

-- 3) Scheduled posts via Late
CREATE TABLE public.late_scheduled_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  calendar_item_id uuid NOT NULL REFERENCES public.media_calendar_items(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'late',
  target_platforms text[] NOT NULL DEFAULT '{}',
  external_post_id text,
  external_post_ids jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'publishing', 'published', 'failed', 'cancelled')),
  scheduled_for timestamptz,
  published_at timestamptz,
  raw_response jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_late_scheduled_posts_tenant ON public.late_scheduled_posts(tenant_id);
CREATE INDEX idx_late_scheduled_posts_item ON public.late_scheduled_posts(calendar_item_id);
CREATE INDEX idx_late_scheduled_posts_status ON public.late_scheduled_posts(status);
CREATE UNIQUE INDEX idx_late_scheduled_posts_unique_item ON public.late_scheduled_posts(calendar_item_id, provider);

-- Trigger for updated_at
CREATE TRIGGER update_late_connections_updated_at
  BEFORE UPDATE ON public.late_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_late_scheduled_posts_updated_at
  BEFORE UPDATE ON public.late_scheduled_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- late_onboarding_states
ALTER TABLE public.late_onboarding_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage their onboarding states"
  ON public.late_onboarding_states FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = late_onboarding_states.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Platform admins can read all onboarding states"
  ON public.late_onboarding_states FOR SELECT
  USING (public.is_platform_admin());

-- late_connections
ALTER TABLE public.late_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage their Late connection"
  ON public.late_connections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = late_connections.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Platform admins can read all Late connections"
  ON public.late_connections FOR SELECT
  USING (public.is_platform_admin());

-- late_scheduled_posts
ALTER TABLE public.late_scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view their scheduled posts"
  ON public.late_scheduled_posts FOR SELECT
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can manage their scheduled posts"
  ON public.late_scheduled_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.tenant_id = late_scheduled_posts.tenant_id
        AND ur.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Platform admins can read all scheduled posts"
  ON public.late_scheduled_posts FOR SELECT
  USING (public.is_platform_admin());