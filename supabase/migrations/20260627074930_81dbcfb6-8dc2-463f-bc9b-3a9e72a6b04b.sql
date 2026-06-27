
CREATE TABLE public.identity_prehydration_tokens (
  token text PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subscriber_id uuid REFERENCES public.email_marketing_subscribers(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  identity_bundle jsonb NOT NULL,
  source text NOT NULL DEFAULT 'email_click',
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_iph_tokens_expires_at ON public.identity_prehydration_tokens(expires_at);
CREATE INDEX idx_iph_tokens_tenant ON public.identity_prehydration_tokens(tenant_id);

GRANT ALL ON public.identity_prehydration_tokens TO service_role;

ALTER TABLE public.identity_prehydration_tokens ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy para anon/authenticated: tabela é acessada apenas via service_role
-- pelas edges email-track (insert) e storefront-html (select+update).

-- Limpeza diária via pg_cron (tokens com TTL 5 min, mas mantemos por 1 dia para auditoria)
SELECT cron.schedule(
  'cleanup-identity-prehydration-tokens',
  '17 3 * * *',
  $$ DELETE FROM public.identity_prehydration_tokens WHERE expires_at < now() - interval '1 day' $$
);
