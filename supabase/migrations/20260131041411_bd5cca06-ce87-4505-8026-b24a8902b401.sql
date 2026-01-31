-- Tabela para presets de voz (F5-TTS)
-- Biblioteca interna de vozes de referência para TTS

CREATE TABLE IF NOT EXISTS public.voice_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  ref_audio_url TEXT,  -- URL do áudio de referência (preenchido pelo admin)
  ref_text TEXT,       -- Transcrição do áudio de referência
  language TEXT DEFAULT 'pt-BR',
  category TEXT CHECK (category IN ('female', 'male', 'neutral')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_voice_presets_active ON public.voice_presets(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE public.voice_presets ENABLE ROW LEVEL SECURITY;

-- Todos podem ler presets ativos
CREATE POLICY "Anyone can read active voice presets"
  ON public.voice_presets FOR SELECT
  USING (is_active = true);

-- Apenas platform admins podem modificar
CREATE POLICY "Platform admins can manage voice presets"
  ON public.voice_presets FOR ALL
  USING (public.is_platform_admin());

-- Dados iniciais (ref_audio_url será preenchido pelo admin)
INSERT INTO public.voice_presets (name, slug, category, description, language) VALUES
  ('Feminina Jovem Entusiasta', 'female-young', 'female', 'Tom animado e convidativo, ideal para UGC', 'pt-BR'),
  ('Feminina Madura Confiante', 'female-mature', 'female', 'Tom profissional e seguro, ideal para reviews', 'pt-BR'),
  ('Masculina Jovem Casual', 'male-young', 'male', 'Tom descontraído e amigável, ideal para lifestyle', 'pt-BR'),
  ('Masculina Madura Profissional', 'male-mature', 'male', 'Tom sério e confiável, ideal para tech', 'pt-BR')
ON CONFLICT (slug) DO NOTHING;