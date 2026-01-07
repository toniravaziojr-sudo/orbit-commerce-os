-- =====================================================
-- FASE 1: BUCKETS DE STORAGE
-- =====================================================

-- Bucket PRIVADO para assets em geração/revisão
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('media-assets', 'media-assets', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Bucket PÚBLICO para assets publicados finais
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('published-assets', 'published-assets', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- RLS policies para media-assets (bucket privado)
CREATE POLICY "Tenant users can view own media assets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'media-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant users can insert media assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant users can delete own media assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'media-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id::text = (storage.foldername(name))[1]
  )
);

-- RLS policies para published-assets (público para leitura)
CREATE POLICY "Anyone can view published assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'published-assets');

CREATE POLICY "Tenant users can insert published assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'published-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Tenant users can delete own published assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'published-assets' AND
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.tenant_id::text = (storage.foldername(name))[1]
  )
);

-- =====================================================
-- FASE 2: TABELAS DE DADOS
-- =====================================================

-- Contexto de marca persistente por tenant
CREATE TABLE public.tenant_brand_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_summary TEXT,
  tone_of_voice TEXT,
  products_focus JSONB,
  visual_style_guidelines TEXT,
  banned_claims TEXT[],
  do_not_do TEXT[],
  packshot_url TEXT,
  auto_generated_at TIMESTAMPTZ,
  manually_edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Registro de gerações de assets
CREATE TABLE public.media_asset_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  calendar_item_id UUID NOT NULL REFERENCES public.media_calendar_items(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-image-1',
  prompt_final TEXT NOT NULL,
  brand_context_snapshot JSONB,
  settings JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  variant_count INTEGER DEFAULT 4,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Variantes geradas
CREATE TABLE public.media_asset_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID NOT NULL REFERENCES public.media_asset_generations(id) ON DELETE CASCADE,
  variant_index INTEGER NOT NULL DEFAULT 1,
  storage_path TEXT,
  public_url TEXT,
  thumb_url TEXT,
  width INTEGER,
  height INTEGER,
  mime_type TEXT DEFAULT 'image/png',
  file_size INTEGER,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejected_reason TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Preços de modelos (parametrizado)
CREATE TABLE public.ai_model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  cost_per_image DECIMAL(10,6),
  cost_per_1k_tokens DECIMAL(10,6),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider, model, effective_from)
);

-- Seed inicial de preços
INSERT INTO public.ai_model_pricing (provider, model, cost_per_image) VALUES
  ('openai', 'gpt-image-1', 0.040),
  ('openai', 'gpt-image-1-hd', 0.080),
  ('openai', 'dall-e-3', 0.040),
  ('openai', 'dall-e-3-hd', 0.080);

-- =====================================================
-- FASE 3: RLS POLICIES
-- =====================================================

ALTER TABLE public.tenant_brand_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_asset_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_asset_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;

-- tenant_brand_context policies
CREATE POLICY "Users can view own tenant brand context"
ON public.tenant_brand_context FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage tenant brand context"
ON public.tenant_brand_context FOR ALL
USING (
  public.has_role(auth.uid(), tenant_id, 'owner') OR
  public.has_role(auth.uid(), tenant_id, 'admin')
);

-- media_asset_generations policies
CREATE POLICY "Users can view own tenant generations"
ON public.media_asset_generations FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can create generations for own tenant"
ON public.media_asset_generations FOR INSERT
WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update own tenant generations"
ON public.media_asset_generations FOR UPDATE
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- media_asset_variants policies
CREATE POLICY "Users can view variants of own tenant"
ON public.media_asset_variants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.media_asset_generations g
    WHERE g.id = generation_id
    AND public.user_belongs_to_tenant(auth.uid(), g.tenant_id)
  )
);

CREATE POLICY "Users can update variants of own tenant"
ON public.media_asset_variants FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.media_asset_generations g
    WHERE g.id = generation_id
    AND public.user_belongs_to_tenant(auth.uid(), g.tenant_id)
  )
);

-- ai_model_pricing policies (read-only para todos, write para platform admins)
CREATE POLICY "Anyone can view pricing"
ON public.ai_model_pricing FOR SELECT
USING (true);

CREATE POLICY "Platform admins can manage pricing"
ON public.ai_model_pricing FOR ALL
USING (public.is_platform_admin());

-- =====================================================
-- FASE 4: TRIGGERS E ÍNDICES
-- =====================================================

-- Trigger para updated_at em tenant_brand_context
CREATE TRIGGER update_tenant_brand_context_updated_at
  BEFORE UPDATE ON public.tenant_brand_context
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_media_asset_generations_tenant ON public.media_asset_generations(tenant_id);
CREATE INDEX idx_media_asset_generations_status ON public.media_asset_generations(status);
CREATE INDEX idx_media_asset_generations_calendar_item ON public.media_asset_generations(calendar_item_id);
CREATE INDEX idx_media_asset_variants_generation ON public.media_asset_variants(generation_id);

-- =====================================================
-- FASE 5: REALTIME
-- =====================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.media_asset_generations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.media_asset_variants;