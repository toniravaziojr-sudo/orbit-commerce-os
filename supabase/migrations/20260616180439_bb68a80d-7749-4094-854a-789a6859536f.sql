
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ai_product_type text,
  ADD COLUMN IF NOT EXISTS ai_main_function text;

COMMENT ON COLUMN public.products.ai_product_type IS 'Texto livre. Tipo de produto descrito pelo lojista (ex: Shampoo, Suplemento).';
COMMENT ON COLUMN public.products.ai_main_function IS 'Texto livre. Função principal do produto. Usado pela IA junto com ai_product_type.';

CREATE TABLE IF NOT EXISTS public.platform_commercial_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('meta','google','tiktok')),
  inferred_category text NOT NULL,
  allowed_claims text,
  prohibited_claims text,
  sensitive_notes text,
  required_disclaimers text,
  source_url text,
  version integer NOT NULL DEFAULT 1,
  last_verified_at timestamptz NOT NULL DEFAULT now(),
  last_change_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','review_needed','deprecated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, inferred_category)
);

GRANT SELECT ON public.platform_commercial_guidelines TO authenticated;
GRANT ALL ON public.platform_commercial_guidelines TO service_role;

ALTER TABLE public.platform_commercial_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read guidelines"
  ON public.platform_commercial_guidelines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admins manage guidelines"
  ON public.platform_commercial_guidelines FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.email = public.get_auth_user_email()
      AND pa.is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.email = public.get_auth_user_email()
      AND pa.is_active = true
  ));

CREATE TRIGGER trg_platform_guidelines_updated_at
  BEFORE UPDATE ON public.platform_commercial_guidelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_platform_guidelines_platform ON public.platform_commercial_guidelines(platform);
CREATE INDEX IF NOT EXISTS idx_platform_guidelines_status ON public.platform_commercial_guidelines(status);
