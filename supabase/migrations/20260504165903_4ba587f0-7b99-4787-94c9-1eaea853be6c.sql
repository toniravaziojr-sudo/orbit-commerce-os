-- Tabela de custos externos da plataforma
CREATE TABLE IF NOT EXISTS public.platform_external_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('email','infra','ai','fiscal','cloud','payments','other')),
  description TEXT,
  vendor_url TEXT,
  monthly_cost_usd NUMERIC(12,2),
  monthly_cost_brl NUMERIC(12,2),
  current_balance NUMERIC(14,4),
  balance_unit TEXT,
  balance_threshold_pct NUMERIC(5,2) DEFAULT 20,
  renewal_date DATE,
  sync_mode TEXT NOT NULL DEFAULT 'manual' CHECK (sync_mode IN ('auto','manual')),
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_error TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pec_active_renewal ON public.platform_external_costs (is_active, renewal_date);
CREATE INDEX IF NOT EXISTS idx_pec_category ON public.platform_external_costs (category);

ALTER TABLE public.platform_external_costs ENABLE ROW LEVEL SECURITY;

-- Apenas platform admins
CREATE POLICY "platform_admin_select_external_costs"
ON public.platform_external_costs FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "platform_admin_insert_external_costs"
ON public.platform_external_costs FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_admin());

CREATE POLICY "platform_admin_update_external_costs"
ON public.platform_external_costs FOR UPDATE
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE POLICY "platform_admin_delete_external_costs"
ON public.platform_external_costs FOR DELETE
TO authenticated
USING (public.is_platform_admin());

-- Trigger updated_at
CREATE TRIGGER trg_pec_updated_at
BEFORE UPDATE ON public.platform_external_costs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed inicial (modo manual; sync_mode auto será ativado quando edge implementar API)
INSERT INTO public.platform_external_costs
  (service_key, display_name, category, description, vendor_url, sync_mode, is_active, notes)
VALUES
  ('sendgrid','SendGrid','email','Provedor de e-mail transacional/marketing (obrigatório)','https://sendgrid.com','auto', true, NULL),
  ('cloudflare','Cloudflare','infra','DNS, SSL, Workers, cache e domínios','https://dash.cloudflare.com','auto', true, NULL),
  ('fal_ai','Fal.AI','ai','Geração de imagens e vídeos','https://fal.ai','auto', true, NULL),
  ('openai','OpenAI','ai','GPT-5 / fallback de imagens','https://platform.openai.com', 'auto', true, NULL),
  ('gemini','Google Gemini (API nativa)','ai','Gemini Flash/Pro nativo (TPR, tools, sales)','https://aistudio.google.com','auto', true, NULL),
  ('nuvem_fiscal','Nuvem Fiscal','fiscal','Emissor fiscal (substituirá Focus NFe)','https://nuvemfiscal.com.br','manual', true, 'Adapter de emissão pendente — onda 2'),
  ('focus_nfe','Focus NFe','fiscal','Emissor fiscal atualmente em produção','https://focusnfe.com.br','manual', true, 'Marcar para substituir por Nuvem Fiscal'),
  ('google_cloud','Google Cloud','cloud','OAuth, Ads API, YouTube, Calendar, Sheets etc','https://console.cloud.google.com','manual', true, 'Conta de billing centralizada para serviços Google'),
  ('lovable','Lovable (Cloud + AI Gateway)','cloud','Plataforma de desenvolvimento, Cloud, AI Gateway','https://lovable.dev','manual', true, NULL),
  ('firecrawl','Firecrawl','ai','Scraper para AI Page Import (via connector Lovable)','https://firecrawl.dev','manual', true, 'Avaliar mover para integração externa direta')
ON CONFLICT (service_key) DO NOTHING;