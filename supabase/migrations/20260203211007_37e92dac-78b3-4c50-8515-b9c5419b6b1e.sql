-- ============================================
-- Gestor de Mídias IA — Pipeline de Vídeo v2.0
-- Tabelas separadas do módulo Criativos
-- ============================================

-- ============================================
-- 1. Perfis de Categoria para Mídias
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_category_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  niche TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  product_fidelity_weight NUMERIC DEFAULT 0.40,
  label_ocr_weight NUMERIC DEFAULT 0.30,
  quality_weight NUMERIC DEFAULT 0.30,
  temporal_stability_weight NUMERIC DEFAULT 0.00,
  qa_pass_threshold NUMERIC DEFAULT 0.70,
  fallback_enabled BOOLEAN DEFAULT true,
  context_tokens TEXT[] DEFAULT ARRAY[]::TEXT[],
  forbidden_actions TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default media category profiles
INSERT INTO public.media_category_profiles (niche, display_name, product_fidelity_weight, label_ocr_weight, quality_weight, temporal_stability_weight, context_tokens, forbidden_actions) VALUES
  ('social_lifestyle', 'Lifestyle / Redes Sociais', 0.35, 0.25, 0.30, 0.10, ARRAY['lifestyle', 'pessoas', 'ambiente real'], ARRAY['deformar produto']),
  ('social_product', 'Foco no Produto', 0.45, 0.30, 0.25, 0.00, ARRAY['close-up', 'detalhes', 'textura'], ARRAY['cortar rótulo']),
  ('social_storytelling', 'Storytelling', 0.30, 0.20, 0.35, 0.15, ARRAY['narrativa', 'emoção', 'jornada'], ARRAY['rush', 'cortes bruscos']),
  ('youtube_review', 'Review / Tutorial', 0.40, 0.30, 0.20, 0.10, ARRAY['demonstração', 'hands-on', 'tutorial'], ARRAY['esconder marca']),
  ('youtube_unboxing', 'Unboxing', 0.50, 0.30, 0.15, 0.05, ARRAY['embalagem', 'revelação', 'surpresa'], ARRAY['pular embalagem'])
ON CONFLICT (niche) DO NOTHING;

-- ============================================
-- 2. Componentes de Preset Modulares para Mídias
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_preset_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_type TEXT NOT NULL CHECK (component_type IN ('scene', 'lighting', 'camera', 'narrative', 'audio')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  prompt_fragment TEXT NOT NULL,
  compatible_niches TEXT[] DEFAULT ARRAY['social_lifestyle', 'social_product', 'social_storytelling', 'youtube_review', 'youtube_unboxing'],
  sort_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default media preset components
INSERT INTO public.media_preset_components (component_type, name, slug, prompt_fragment, is_default, sort_order) VALUES
  -- Scene components
  ('scene', 'Estúdio Clean', 'studio_clean', 'professional studio backdrop, soft shadows, minimal props', true, 1),
  ('scene', 'Ambiente Lifestyle', 'lifestyle_room', 'cozy lifestyle setting, natural environment, lifestyle context', false, 2),
  ('scene', 'Outdoor Natural', 'outdoor_natural', 'outdoor setting, natural daylight, organic environment', false, 3),
  ('scene', 'Mesa de Trabalho', 'desk_setup', 'modern desk setup, organized workspace, professional environment', false, 4),
  
  -- Lighting components
  ('lighting', 'Iluminação Suave', 'soft_light', 'soft diffused lighting, minimal harsh shadows', true, 1),
  ('lighting', 'Iluminação Dramática', 'dramatic_light', 'dramatic side lighting, strong contrast, cinematic mood', false, 2),
  ('lighting', 'Luz Natural', 'natural_light', 'natural window light, warm golden hour tones', false, 3),
  
  -- Camera components
  ('camera', 'Hero Shot Estático', 'hero_static', 'static hero shot, centered composition, product prominence', true, 1),
  ('camera', 'Órbita Suave', 'orbit_smooth', 'slow orbit around product, 360 view, smooth motion', false, 2),
  ('camera', 'Close-up Detalhes', 'closeup_details', 'macro close-up shots, texture emphasis, detail exploration', false, 3),
  ('camera', 'Dolly In', 'dolly_in', 'slow dolly in movement, building focus, reveal effect', false, 4),
  
  -- Narrative components  
  ('narrative', 'Demonstração Produto', 'demo_product', 'product demonstration, features showcase, benefit focus', true, 1),
  ('narrative', 'Estilo de Vida', 'lifestyle_use', 'lifestyle usage context, relatable scenarios, emotional connection', false, 2),
  ('narrative', 'Unboxing', 'unboxing_reveal', 'unboxing experience, anticipation build, reveal moment', false, 3),
  
  -- Audio components (for future use)
  ('audio', 'Sem Áudio', 'no_audio', 'no audio, muted, silent video', true, 1),
  ('audio', 'Música Ambiente', 'ambient_music', 'ambient background music, subtle, non-distracting', false, 2)
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 3. Presets de Vídeo Compostos para Mídias
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_video_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  duration_seconds INT NOT NULL DEFAULT 6 CHECK (duration_seconds IN (6, 10, 15, 30)),
  scene_component_id UUID REFERENCES public.media_preset_components(id),
  lighting_component_id UUID REFERENCES public.media_preset_components(id),
  camera_component_id UUID REFERENCES public.media_preset_components(id),
  narrative_component_id UUID REFERENCES public.media_preset_components(id),
  audio_component_id UUID REFERENCES public.media_preset_components(id),
  target_niche TEXT DEFAULT 'social_product',
  variation_count INT DEFAULT 4,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. Jobs de Geração de Vídeo para Mídias
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  calendar_item_id UUID REFERENCES public.media_calendar_items(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.media_campaigns(id) ON DELETE SET NULL,
  
  -- Product reference
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_image_url TEXT,
  product_cutout_url TEXT,
  product_mask_url TEXT,
  
  -- User inputs
  original_prompt TEXT NOT NULL,
  rewritten_prompt TEXT,
  shot_plan JSONB,
  
  -- Preset configuration
  preset_id UUID REFERENCES public.media_video_presets(id),
  niche TEXT DEFAULT 'social_product',
  duration_seconds INT DEFAULT 6,
  variation_count INT DEFAULT 4,
  
  -- Pipeline state
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'preprocess', 'rewrite', 'generate_candidates', 
    'qa_select', 'retry', 'fallback', 'completed', 'failed'
  )),
  current_stage INT DEFAULT 0,
  stage_results JSONB DEFAULT '{}'::JSONB,
  
  -- Provider info
  provider TEXT DEFAULT 'openai',
  model TEXT DEFAULT 'sora',
  
  -- QA results
  best_candidate_id UUID,
  qa_scores JSONB DEFAULT '{}'::JSONB,
  qa_passed BOOLEAN,
  qa_threshold NUMERIC DEFAULT 0.70,
  
  -- Output
  output_url TEXT,
  output_thumbnail_url TEXT,
  fallback_used BOOLEAN DEFAULT false,
  
  -- Error handling
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 1,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. Candidatos de Vídeo para Mídias
-- ============================================
CREATE TABLE IF NOT EXISTS public.media_video_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.media_video_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Candidate info
  candidate_index INT NOT NULL,
  provider_request_id TEXT,
  provider_response JSONB,
  
  -- Output
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds NUMERIC,
  
  -- QA Scores
  similarity_score NUMERIC,
  label_ocr_score NUMERIC,
  quality_score NUMERIC,
  temporal_stability_score NUMERIC,
  final_score NUMERIC,
  qa_passed BOOLEAN,
  qa_details JSONB,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'selected', 'rejected')),
  is_best BOOLEAN DEFAULT false,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_media_video_jobs_tenant ON public.media_video_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_video_jobs_status ON public.media_video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_media_video_jobs_calendar_item ON public.media_video_jobs(calendar_item_id);
CREATE INDEX IF NOT EXISTS idx_media_video_candidates_job ON public.media_video_candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_media_video_candidates_status ON public.media_video_candidates(status);

-- ============================================
-- 7. RLS Policies
-- ============================================

-- Enable RLS
ALTER TABLE public.media_category_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_preset_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_video_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_video_candidates ENABLE ROW LEVEL SECURITY;

-- Category profiles (public read)
CREATE POLICY "media_category_profiles_select_all" ON public.media_category_profiles FOR SELECT USING (true);

-- Preset components (public read)
CREATE POLICY "media_preset_components_select_all" ON public.media_preset_components FOR SELECT USING (true);

-- Video presets (public read)
CREATE POLICY "media_video_presets_select_all" ON public.media_video_presets FOR SELECT USING (true);

-- Video jobs (tenant isolated)
CREATE POLICY "media_video_jobs_select_own" ON public.media_video_jobs FOR SELECT 
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "media_video_jobs_insert_own" ON public.media_video_jobs FOR INSERT 
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "media_video_jobs_update_own" ON public.media_video_jobs FOR UPDATE 
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "media_video_jobs_delete_own" ON public.media_video_jobs FOR DELETE 
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- Video candidates (tenant isolated)
CREATE POLICY "media_video_candidates_select_own" ON public.media_video_candidates FOR SELECT 
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "media_video_candidates_insert_own" ON public.media_video_candidates FOR INSERT 
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "media_video_candidates_update_own" ON public.media_video_candidates FOR UPDATE 
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "media_video_candidates_delete_own" ON public.media_video_candidates FOR DELETE 
  USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- ============================================
-- 8. Trigger para updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.media_video_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER media_video_jobs_updated_at_trigger
  BEFORE UPDATE ON public.media_video_jobs
  FOR EACH ROW EXECUTE FUNCTION public.media_video_jobs_updated_at();