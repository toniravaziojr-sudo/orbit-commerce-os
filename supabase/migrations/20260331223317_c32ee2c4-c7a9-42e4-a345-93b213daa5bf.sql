
CREATE TABLE public.threads_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  threads_user_id TEXT,
  username TEXT,
  display_name TEXT,
  profile_picture_url TEXT,
  access_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  connected_by UUID REFERENCES auth.users(id),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT threads_connections_tenant_unique UNIQUE (tenant_id)
);

ALTER TABLE public.threads_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tenant threads connection"
  ON public.threads_connections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.tenant_id = threads_connections.tenant_id
    )
  );

CREATE POLICY "Admins can manage their tenant threads connection"
  ON public.threads_connections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.tenant_id = threads_connections.tenant_id
      AND user_roles.role IN ('owner', 'admin')
    )
  );
