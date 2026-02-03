-- =====================================================
-- MIGRAÇÃO: Pipeline de Vídeo IA v2.0 (substituindo fal.ai)
-- Módulo: Gestão de Criativos → Vídeos
-- =====================================================

-- 1) Tabela de perfis de categoria de produto (para QA adaptativo multi-nicho)
CREATE TABLE IF NOT EXISTS public.product_category_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  -- Regras de fidelidade por nicho
  hard_fidelity_default BOOLEAN DEFAULT true,
  qa_similarity_weight DECIMAL(3,2) DEFAULT 0.40,
  qa_label_weight DECIMAL(3,2) DEFAULT 0.30,
  qa_quality_weight DECIMAL(3,2) DEFAULT 0.30,
  qa_pass_threshold DECIMAL(3,2) DEFAULT 0.70,
  -- Regras específicas do nicho
  negative_rules JSONB DEFAULT '[]'::jsonb,
  constraints JSONB DEFAULT '[]'::jsonb,
  recommended_preset_ids TEXT[] DEFAULT '{}',
  -- Configurações de QA
  qa_ruleset JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Componentes modulares de presets (Cena, Iluminação, Câmera, Narrativa)
CREATE TABLE IF NOT EXISTS public.creative_preset_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  component_type TEXT NOT NULL CHECK (component_type IN ('scene', 'lighting', 'camera', 'narrative', 'compliance')),
  component_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(component_type, component_key)
);

-- 3) Presets de vídeo compostos (combinam componentes)
CREATE TABLE IF NOT EXISTS public.creative_video_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  preset_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  -- Quais categorias podem usar este preset
  category_applicability TEXT[] DEFAULT '{}',
  -- IDs dos componentes que formam este preset
  scene_component_id UUID REFERENCES public.creative_preset_components(id),
  lighting_component_id UUID REFERENCES public.creative_preset_components(id),
  camera_component_id UUID REFERENCES public.creative_preset_components(id),
  narrative_component_id UUID REFERENCES public.creative_preset_components(id),
  -- Shot plans por duração
  shot_plan_6s JSONB,
  shot_plan_10s JSONB,
  shot_plan_15s JSONB,
  -- Constraints e negatives padrão
  default_constraints JSONB DEFAULT '[]'::jsonb,
  default_negatives JSONB DEFAULT '[]'::jsonb,
  -- Ordenação e status
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Assets de referência do produto (cutout, máscara, brand tokens)
CREATE TABLE IF NOT EXISTS public.product_reference_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- Assets visuais
  cutout_url TEXT,
  mask_url TEXT,
  reference_stills JSONB DEFAULT '[]'::jsonb,
  -- Identificação de marca/rótulo
  brand_tokens TEXT[] DEFAULT '{}',
  label_expected_text TEXT,
  -- Categoria detectada (com override)
  detected_category_key TEXT REFERENCES public.product_category_profiles(category_key),
  category_override_key TEXT REFERENCES public.product_category_profiles(category_key),
  -- Cache metadata
  cutout_generated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, product_id)
);

-- 5) Jobs de geração de vídeo
CREATE TABLE IF NOT EXISTS public.creative_video_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  -- Tipo de vídeo
  video_type TEXT NOT NULL CHECK (video_type IN ('product_video', 'ugc_ai_video')),
  -- Configurações
  preset_id UUID REFERENCES public.creative_video_presets(id),
  aspect_ratio TEXT NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '1:1', '16:9')),
  duration_seconds INTEGER NOT NULL DEFAULT 10 CHECK (duration_seconds IN (6, 10, 15)),
  n_variations INTEGER NOT NULL DEFAULT 4 CHECK (n_variations BETWEEN 1 AND 4),
  fidelity_mode BOOLEAN DEFAULT true,
  hard_fidelity BOOLEAN DEFAULT false,
  user_prompt TEXT,
  -- Prompt processado
  rewritten_prompt JSONB,
  shot_plan JSONB,
  constraints JSONB,
  negative_prompt TEXT,
  -- Status e progresso
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'preprocess', 'rewrite', 'generate_candidates', 'qa_select', 'retry', 'fallback', 'done', 'failed')),
  progress_percent INTEGER DEFAULT 0,
  current_step TEXT,
  -- Provider e modelo
  provider TEXT DEFAULT 'openai',
  model TEXT DEFAULT 'sora-2',
  -- Resultados
  best_candidate_id UUID,
  result_url TEXT,
  result_thumbnail_url TEXT,
  fallback_used BOOLEAN DEFAULT false,
  -- QA summary
  qa_summary JSONB,
  -- Custos
  cost_credits INTEGER DEFAULT 0,
  cost_usd DECIMAL(10,4) DEFAULT 0,
  -- Erros
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) Candidatos de vídeo gerados
CREATE TABLE IF NOT EXISTS public.creative_video_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.creative_video_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- Resultado
  video_url TEXT,
  thumbnail_url TEXT,
  duration_actual DECIMAL(5,2),
  -- QA Scores (0-1)
  qa_similarity_score DECIMAL(4,3),
  qa_label_score DECIMAL(4,3),
  qa_quality_score DECIMAL(4,3),
  qa_temporal_score DECIMAL(4,3),
  qa_final_score DECIMAL(4,3),
  qa_passed BOOLEAN DEFAULT false,
  qa_rejection_reason TEXT,
  -- OCR do rótulo
  ocr_extracted_text TEXT,
  ocr_confidence DECIMAL(4,3),
  -- Metadata
  generation_metadata JSONB,
  is_best BOOLEAN DEFAULT false,
  is_fallback BOOLEAN DEFAULT false,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) Log de compliance por tenant (claims/textos proibidos)
CREATE TABLE IF NOT EXISTS public.creative_compliance_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  prohibited_terms TEXT[] DEFAULT '{}',
  required_disclaimers TEXT[] DEFAULT '{}',
  custom_rules JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_creative_video_jobs_tenant ON public.creative_video_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_creative_video_jobs_status ON public.creative_video_jobs(status);
CREATE INDEX IF NOT EXISTS idx_creative_video_jobs_product ON public.creative_video_jobs(product_id);
CREATE INDEX IF NOT EXISTS idx_creative_video_candidates_job ON public.creative_video_candidates(job_id);
CREATE INDEX IF NOT EXISTS idx_product_reference_assets_tenant_product ON public.product_reference_assets(tenant_id, product_id);

-- RLS Policies
ALTER TABLE public.product_category_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_preset_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_video_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reference_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_video_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_video_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creative_compliance_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para tabelas globais (leitura pública)
CREATE POLICY "Categorias são visíveis para todos" ON public.product_category_profiles FOR SELECT USING (true);
CREATE POLICY "Componentes são visíveis para todos" ON public.creative_preset_components FOR SELECT USING (true);
CREATE POLICY "Presets são visíveis para todos" ON public.creative_video_presets FOR SELECT USING (true);

-- Políticas para tabelas por tenant
CREATE POLICY "Usuários veem assets do seu tenant" ON public.product_reference_assets FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários criam assets do seu tenant" ON public.product_reference_assets FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários atualizam assets do seu tenant" ON public.product_reference_assets FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários veem jobs do seu tenant" ON public.creative_video_jobs FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários criam jobs do seu tenant" ON public.creative_video_jobs FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários atualizam jobs do seu tenant" ON public.creative_video_jobs FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários veem candidatos do seu tenant" ON public.creative_video_candidates FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários criam candidatos do seu tenant" ON public.creative_video_candidates FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Usuários veem compliance do seu tenant" ON public.creative_compliance_profiles FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Usuários gerenciam compliance do seu tenant" ON public.creative_compliance_profiles FOR ALL USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()));

-- =====================================================
-- DADOS INICIAIS: Perfis de Categoria Multi-Nicho
-- =====================================================

INSERT INTO public.product_category_profiles (category_key, display_name, description, hard_fidelity_default, negative_rules, constraints, qa_ruleset) VALUES
('packaged_goods', 'Embalagens (Cosméticos, Suplementos, Limpeza)', 'Produtos com rótulo/embalagem que precisa ficar legível', true, 
  '["inventar embalagem", "trocar letras", "distorcer logo", "mudar marca", "watermarks", "overlays", "texto ilegível", "rótulo borrado"]'::jsonb,
  '["rótulo sempre legível", "cores da embalagem fiéis", "proporções corretas", "sem morphing entre frames"]'::jsonb,
  '{"use_ocr": true, "label_weight": 0.35, "similarity_weight": 0.35, "temporal_weight": 0.15, "quality_weight": 0.15}'::jsonb),
  
('electronics', 'Eletrônicos', 'Smartphones, fones, gadgets - evitar reflexos irreais e botões inventados', true,
  '["inventar botões", "portas inexistentes", "tela com conteúdo errado", "reflexos irreais", "marca alterada"]'::jsonb,
  '["contorno preciso", "detalhes de hardware fiéis", "reflexos coerentes", "materiais corretos"]'::jsonb,
  '{"use_ocr": false, "label_weight": 0.20, "similarity_weight": 0.45, "temporal_weight": 0.20, "quality_weight": 0.15}'::jsonb),
  
('fashion', 'Moda e Acessórios', 'Roupas, bolsas, sapatos - foco em textura e caimento', false,
  '["logos inventados", "texturas derretidas", "costuras erradas", "padrões distorcidos"]'::jsonb,
  '["textura fiel", "caimento natural", "costuras visíveis corretas", "padrões consistentes"]'::jsonb,
  '{"use_ocr": false, "label_weight": 0.15, "similarity_weight": 0.40, "temporal_weight": 0.25, "quality_weight": 0.20}'::jsonb),
  
('home_decor', 'Casa e Decoração', 'Móveis, utensílios, decoração - escala real e contexto', false,
  '["deformações geométricas", "linhas tortas", "escala irreal", "reflexos impossíveis em vidro/metal"]'::jsonb,
  '["escala realista no ambiente", "linhas retas preservadas", "materiais coerentes"]'::jsonb,
  '{"use_ocr": false, "label_weight": 0.10, "similarity_weight": 0.40, "temporal_weight": 0.25, "quality_weight": 0.25}'::jsonb),
  
('food', 'Alimentos e Bebidas', 'Produtos alimentícios - embalagem fiel + apelo visual', true,
  '["texto da embalagem alterado", "cores de alimento irreais", "embalagem deformada"]'::jsonb,
  '["embalagem 100% fiel", "cores apetitosas mas realistas", "vapor/suculência natural"]'::jsonb,
  '{"use_ocr": true, "label_weight": 0.35, "similarity_weight": 0.30, "temporal_weight": 0.15, "quality_weight": 0.20}'::jsonb),
  
('automotive_tools', 'Automotivo e Ferramentas', 'Peças, ferramentas - robustez e detalhes técnicos', true,
  '["marca alterada", "peças deformadas", "encaixes errados", "textos técnicos ilegíveis"]'::jsonb,
  '["detalhes técnicos precisos", "materiais robustos", "encaixes corretos"]'::jsonb,
  '{"use_ocr": true, "label_weight": 0.25, "similarity_weight": 0.40, "temporal_weight": 0.20, "quality_weight": 0.15}'::jsonb),
  
('digital_product', 'Produto Digital', 'Cursos, ebooks, softwares - sem packshot físico', false,
  '["inventar produto físico", "caixas inexistentes"]'::jsonb,
  '["motion graphics limpo", "brand cards", "tipografia legível"]'::jsonb,
  '{"use_ocr": false, "label_weight": 0.10, "similarity_weight": 0.25, "temporal_weight": 0.30, "quality_weight": 0.35}'::jsonb)
ON CONFLICT (category_key) DO NOTHING;

-- =====================================================
-- DADOS INICIAIS: Componentes de Preset
-- =====================================================

-- Cenas
INSERT INTO public.creative_preset_components (component_type, component_key, display_name, description, config) VALUES
('scene', 'studio_white', 'Estúdio Branco', 'Fundo branco infinito, clean e profissional', '{"background": "infinite white cyclorama", "floor": "white reflective", "props": []}'::jsonb),
('scene', 'marble_countertop', 'Bancada de Mármore', 'Bancada de mármore premium com elementos decorativos', '{"background": "marble countertop", "floor": "none", "props": ["subtle greenery", "luxury accessories"]}'::jsonb),
('scene', 'bathroom_premium', 'Banheiro Premium', 'Banheiro de luxo com espelho e iluminação suave', '{"background": "luxury bathroom", "floor": "marble tile", "props": ["mirror", "towels", "plants"]}'::jsonb),
('scene', 'kitchen_fresh', 'Cozinha Fresca', 'Cozinha moderna com luz natural', '{"background": "modern kitchen", "floor": "wood", "props": ["cutting board", "fresh ingredients", "herbs"]}'::jsonb),
('scene', 'gym_performance', 'Academia/Performance', 'Ambiente de academia ou esportivo', '{"background": "gym environment", "floor": "rubber mat", "props": ["weights", "towel", "water bottle"]}'::jsonb),
('scene', 'tech_desk', 'Mesa Tech Minimalista', 'Escritório minimalista para eletrônicos', '{"background": "minimal desk", "floor": "none", "props": ["keyboard", "mouse", "plant"]}'::jsonb),
('scene', 'outdoor_natural', 'Outdoor Natural', 'Ambiente externo com luz natural suave', '{"background": "outdoor nature", "floor": "grass or wood deck", "props": ["natural elements"]}'::jsonb),
('scene', 'workshop_industrial', 'Oficina Industrial', 'Ambiente industrial/workshop', '{"background": "workshop", "floor": "concrete", "props": ["tools", "workbench"]}'::jsonb)
ON CONFLICT (component_type, component_key) DO NOTHING;

-- Iluminação
INSERT INTO public.creative_preset_components (component_type, component_key, display_name, description, config) VALUES
('lighting', 'softbox_key', 'Softbox Profissional', 'Iluminação de estúdio com softbox', '{"type": "softbox", "intensity": "medium", "color_temp": "5500K"}'::jsonb),
('lighting', 'natural_window', 'Luz Natural de Janela', 'Luz natural suave vindo de janela', '{"type": "natural", "intensity": "soft", "color_temp": "daylight"}'::jsonb),
('lighting', 'high_key', 'High Key Brilhante', 'Iluminação alta e uniforme', '{"type": "high_key", "intensity": "high", "color_temp": "5600K"}'::jsonb),
('lighting', 'moody_premium', 'Moody Premium', 'Iluminação dramática e premium', '{"type": "dramatic", "intensity": "low-medium", "color_temp": "warm"}'::jsonb),
('lighting', 'neon_tech', 'Neon Tech', 'Iluminação com toques de neon/RGB', '{"type": "neon", "intensity": "medium", "color_temp": "mixed"}'::jsonb),
('lighting', 'golden_hour', 'Golden Hour', 'Luz dourada de fim de tarde', '{"type": "golden_hour", "intensity": "warm", "color_temp": "3500K"}'::jsonb)
ON CONFLICT (component_type, component_key) DO NOTHING;

-- Câmera
INSERT INTO public.creative_preset_components (component_type, component_key, display_name, description, config) VALUES
('camera', 'push_in_slow', 'Push-in Lento', 'Aproximação lenta e suave do produto', '{"movement": "push_in", "speed": "slow", "stability": "high"}'::jsonb),
('camera', 'pan_gentle', 'Pan Suave', 'Movimento lateral suave', '{"movement": "pan", "speed": "gentle", "stability": "high"}'::jsonb),
('camera', 'turntable_15', 'Turntable 15°', 'Rotação leve do produto (15 graus)', '{"movement": "rotate", "angle": 15, "stability": "high"}'::jsonb),
('camera', 'macro_detail', 'Macro Detalhe', 'Close extremo em detalhes do produto', '{"movement": "macro", "speed": "slow", "stability": "very_high"}'::jsonb),
('camera', 'top_down_flat', 'Top-Down Flat Lay', 'Vista de cima, flat lay', '{"movement": "static", "angle": "top_down", "stability": "fixed"}'::jsonb),
('camera', 'orbit_smooth', 'Órbita Suave', 'Movimento orbital ao redor do produto', '{"movement": "orbit", "speed": "slow", "stability": "high"}'::jsonb),
('camera', 'handheld_ugc', 'Handheld UGC', 'Estilo de câmera na mão, mais orgânico', '{"movement": "handheld", "speed": "natural", "stability": "medium"}'::jsonb)
ON CONFLICT (component_type, component_key) DO NOTHING;

-- Narrativa
INSERT INTO public.creative_preset_components (component_type, component_key, display_name, description, config) VALUES
('narrative', 'hero_reveal', 'Hero Reveal', 'Revelação dramática do produto hero', '{"style": "reveal", "pacing": "build_up", "focus": "product"}'::jsonb),
('narrative', 'feature_highlight', 'Destaque de Features', 'Foco em características específicas', '{"style": "educational", "pacing": "steady", "focus": "features"}'::jsonb),
('narrative', 'lifestyle_integration', 'Lifestyle/Uso', 'Produto integrado ao estilo de vida', '{"style": "lifestyle", "pacing": "natural", "focus": "context"}'::jsonb),
('narrative', 'unboxing_reveal', 'Unboxing', 'Experiência de desembalar', '{"style": "unboxing", "pacing": "anticipation", "focus": "experience"}'::jsonb),
('narrative', 'before_after', 'Antes/Depois', 'Transformação ou resultado', '{"style": "comparison", "pacing": "contrast", "focus": "result"}'::jsonb)
ON CONFLICT (component_type, component_key) DO NOTHING;

-- =====================================================
-- DADOS INICIAIS: Presets de Vídeo Compostos
-- =====================================================

INSERT INTO public.creative_video_presets (preset_key, display_name, description, category_applicability, sort_order, shot_plan_6s, shot_plan_10s, shot_plan_15s, default_constraints, default_negatives) VALUES
('studio_white_hero', 'Estúdio Branco Hero', 'Produto em destaque no fundo branco infinito', ARRAY['packaged_goods', 'electronics', 'fashion', 'home_decor', 'food', 'automotive_tools'], 1,
  '{"shots": [{"duration": 6, "action": "slow push-in from medium to close-up, product centered, subtle rotation"}]}'::jsonb,
  '{"shots": [{"duration": 4, "action": "wide establishing shot"}, {"duration": 4, "action": "slow push-in to close-up"}, {"duration": 2, "action": "macro on label/detail"}]}'::jsonb,
  '{"shots": [{"duration": 4, "action": "wide establishing"}, {"duration": 4, "action": "push-in"}, {"duration": 4, "action": "orbit 15 degrees"}, {"duration": 3, "action": "macro detail"}]}'::jsonb,
  '["product centered", "clean background", "sharp focus on label", "stable camera"]'::jsonb,
  '["busy background", "distracting elements", "blur on product", "shaky camera"]'::jsonb),
  
('marble_premium', 'Bancada Mármore Premium', 'Produto sobre mármore com elementos premium', ARRAY['packaged_goods', 'food', 'home_decor'], 2,
  '{"shots": [{"duration": 6, "action": "gentle pan across marble surface revealing product"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "wide angle marble surface"}, {"duration": 4, "action": "pan to product"}, {"duration": 3, "action": "close-up with shallow DOF"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "establishing wide"}, {"duration": 4, "action": "pan reveal"}, {"duration": 4, "action": "orbit product"}, {"duration": 4, "action": "macro on textures"}]}'::jsonb,
  '["premium feel", "marble texture visible", "elegant props", "soft shadows"]'::jsonb,
  '["cheap props", "harsh shadows", "cluttered composition"]'::jsonb),
  
('bathroom_luxury', 'Banheiro Luxuoso', 'Produto em contexto de banheiro premium', ARRAY['packaged_goods', 'home_decor'], 3,
  '{"shots": [{"duration": 6, "action": "product reveal in bathroom setting, soft steam"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "bathroom ambiance"}, {"duration": 4, "action": "focus on product"}, {"duration": 3, "action": "detail shot"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "ambiance"}, {"duration": 3, "action": "pan to product"}, {"duration": 3, "action": "orbit"}, {"duration": 3, "action": "in-use simulation"}, {"duration": 3, "action": "final hero"}]}'::jsonb,
  '["spa atmosphere", "clean surfaces", "soft towels", "natural elements"]'::jsonb,
  '["dirty surfaces", "harsh lighting", "cluttered counters"]'::jsonb),
  
('tech_minimal', 'Tech Minimalista', 'Produto eletrônico em ambiente clean', ARRAY['electronics'], 4,
  '{"shots": [{"duration": 6, "action": "slow orbit around device on minimal desk"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "device establishing"}, {"duration": 4, "action": "feature highlight orbit"}, {"duration": 3, "action": "detail on ports/buttons"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "context shot"}, {"duration": 3, "action": "device hero"}, {"duration": 3, "action": "orbit"}, {"duration": 3, "action": "detail 1"}, {"duration": 3, "action": "detail 2"}]}'::jsonb,
  '["clean desk", "subtle RGB lighting optional", "modern feel", "sharp details"]'::jsonb,
  '["cluttered desk", "reflections obscuring screen", "invented features"]'::jsonb),
  
('gym_performance', 'Academia Performance', 'Produto em contexto fitness/esportivo', ARRAY['packaged_goods', 'food', 'fashion'], 5,
  '{"shots": [{"duration": 6, "action": "dynamic reveal with gym equipment in background"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "gym environment"}, {"duration": 4, "action": "product in context"}, {"duration": 3, "action": "action shot or close-up"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "wide gym"}, {"duration": 3, "action": "product on bench"}, {"duration": 3, "action": "in-hand or in-use"}, {"duration": 3, "action": "hero shot"}, {"duration": 3, "action": "final with energy"}]}'::jsonb,
  '["energy feel", "clean gym", "fitness props", "dynamic lighting"]'::jsonb,
  '["dirty equipment", "sweat visible", "unsafe positions"]'::jsonb),
  
('kitchen_fresh', 'Cozinha Fresca', 'Produto em cozinha moderna com ingredientes', ARRAY['food', 'home_decor', 'packaged_goods'], 6,
  '{"shots": [{"duration": 6, "action": "pan across kitchen counter to product with fresh ingredients"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "kitchen wide"}, {"duration": 4, "action": "product with ingredients"}, {"duration": 3, "action": "close-up appetizing"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "kitchen ambiance"}, {"duration": 3, "action": "ingredients"}, {"duration": 3, "action": "product reveal"}, {"duration": 3, "action": "in-use"}, {"duration": 3, "action": "final plated/served"}]}'::jsonb,
  '["fresh ingredients", "natural light", "clean surfaces", "appetizing colors"]'::jsonb,
  '["dirty dishes", "unappetizing food", "messy counters"]'::jsonb),
  
('flat_lay_topdown', 'Flat Lay Top-Down', 'Vista de cima estilo flat lay', ARRAY['fashion', 'packaged_goods', 'electronics'], 7,
  '{"shots": [{"duration": 6, "action": "top-down view with subtle zoom or composition build"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "full flat lay composition"}, {"duration": 4, "action": "slow zoom to product"}, {"duration": 3, "action": "detail on main item"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "composition build"}, {"duration": 3, "action": "full view"}, {"duration": 3, "action": "zoom to center"}, {"duration": 3, "action": "detail 1"}, {"duration": 3, "action": "detail 2"}]}'::jsonb,
  '["organized layout", "complementary props", "clean background", "balanced composition"]'::jsonb,
  '["cluttered", "unbalanced", "overlapping items", "shadows on product"]'::jsonb),
  
('workshop_industrial', 'Oficina Industrial', 'Ambiente industrial/workshop para ferramentas', ARRAY['automotive_tools'], 8,
  '{"shots": [{"duration": 6, "action": "product reveal on workbench with industrial backdrop"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "workshop environment"}, {"duration": 4, "action": "product on workbench"}, {"duration": 3, "action": "detail on tool features"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "wide workshop"}, {"duration": 3, "action": "approach workbench"}, {"duration": 3, "action": "product hero"}, {"duration": 3, "action": "in-use simulation"}, {"duration": 3, "action": "final with result"}]}'::jsonb,
  '["authentic workshop", "quality tools visible", "organized workspace", "good task lighting"]'::jsonb,
  '["messy dangerous", "poor lighting", "unrelated tools"]'::jsonb),
  
('outdoor_lifestyle', 'Outdoor Lifestyle', 'Produto em ambiente externo natural', ARRAY['packaged_goods', 'fashion', 'food', 'home_decor'], 9,
  '{"shots": [{"duration": 6, "action": "product in natural outdoor setting with soft sun"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "outdoor scene"}, {"duration": 4, "action": "product in context"}, {"duration": 3, "action": "lifestyle moment"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "nature establishing"}, {"duration": 3, "action": "product reveal"}, {"duration": 3, "action": "in-use lifestyle"}, {"duration": 3, "action": "detail"}, {"duration": 3, "action": "final scenic"}]}'::jsonb,
  '["natural light", "outdoor elements", "lifestyle context", "soft shadows"]'::jsonb,
  '["harsh midday sun", "distracting background", "weather issues"]'::jsonb),
  
('office_professional', 'Escritório Profissional', 'Produto em contexto B2B/corporativo', ARRAY['electronics', 'packaged_goods'], 10,
  '{"shots": [{"duration": 6, "action": "product on professional desk with business context"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "office environment"}, {"duration": 4, "action": "product on desk"}, {"duration": 3, "action": "professional use"}]}'::jsonb,
  '{"shots": [{"duration": 3, "action": "office wide"}, {"duration": 3, "action": "desk approach"}, {"duration": 3, "action": "product hero"}, {"duration": 3, "action": "in-use"}, {"duration": 3, "action": "professional finish"}]}'::jsonb,
  '["professional setting", "clean desk", "business appropriate", "quality office furniture"]'::jsonb,
  '["messy office", "personal items visible", "unprofessional elements"]'::jsonb)
ON CONFLICT (preset_key) DO NOTHING;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_video_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_creative_video_jobs_updated_at ON public.creative_video_jobs;
CREATE TRIGGER trigger_creative_video_jobs_updated_at
  BEFORE UPDATE ON public.creative_video_jobs
  FOR EACH ROW EXECUTE FUNCTION update_video_jobs_updated_at();