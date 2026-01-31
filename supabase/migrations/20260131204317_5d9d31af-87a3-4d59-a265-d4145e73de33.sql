-- =============================================
-- 1. BUCKET PARA VOICE PRESETS (armazenamento próprio)
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('system-voice-presets', 'system-voice-presets', true, 52428800, '{"audio/mpeg","audio/wav","audio/mp3","audio/x-wav","audio/ogg"}')
ON CONFLICT (id) DO NOTHING;

-- RLS: Apenas leitura pública (uploads via admin/edge function)
CREATE POLICY "Anyone can view voice preset audios" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'system-voice-presets');

-- Admins podem fazer upload
CREATE POLICY "Authenticated users can upload voice preset audios" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'system-voice-presets' 
  AND auth.role() = 'authenticated'
);

-- =============================================
-- 2. LIMPAR PRESETS ANTIGOS E CRIAR 8 NOVOS PT-BR
-- =============================================

-- Desativar presets antigos (não deletar para preservar histórico)
UPDATE public.voice_presets SET is_active = false WHERE is_active = true;

-- Inserir 8 presets PT-BR profissionais (ref_audio_url = NULL até upload)
INSERT INTO public.voice_presets (name, slug, category, language, description, ref_audio_url, ref_text, is_active)
VALUES 
-- FEMININAS (4)
('Feminina Jovem – Amigável', 'female-young-friendly', 'female', 'pt-BR', 
 'Tom leve, natural e acolhedor. Ideal para tutoriais e UGC.', 
 NULL, 
 'Oi! Eu sou a voz de demonstração em português do Brasil. Estou gravando este áudio para referência de timbre, dicção e ritmo. Hoje é um ótimo dia para criar anúncios com clareza e confiança.',
 true),

('Feminina Jovem – Enérgica', 'female-young-energetic', 'female', 'pt-BR', 
 'Ritmo rápido e dinâmico. Perfeito para ads curtos e chamadas de atenção.', 
 NULL, 
 'Fala, pessoal! Esta é uma amostra de voz em português do Brasil, com energia e ritmo mais rápido. Perfeita para vídeos curtos, chamadas de atenção e anúncios diretos.',
 true),

('Feminina Madura – Profissional', 'female-mature-professional', 'female', 'pt-BR', 
 'Credibilidade e clareza. Ideal para comunicação empresarial.', 
 NULL, 
 'Olá. Esta é uma voz de referência em português do Brasil, com tom profissional e seguro. Ideal para comunicação clara, objetiva e com credibilidade.',
 true),

('Feminina – Suave/Calma', 'female-soft-calm', 'female', 'pt-BR', 
 'Tom tranquilo e acolhedor. Boa para wellness, skincare, ASMR.', 
 NULL, 
 'Oi. Esta é uma amostra de voz em português do Brasil, com tom suave e tranquilo. Boa para mensagens acolhedoras, explicações e conteúdo mais leve.',
 true),

-- MASCULINAS (3)
('Masculina Jovem – Casual', 'male-young-casual', 'male', 'pt-BR', 
 'Natural e descontraído. Perfeito para UGC e reviews.', 
 NULL, 
 'E aí! Esta é uma voz de referência em português do Brasil, com tom casual e natural. Boa para UGC, reviews e vídeos de rotina do dia a dia.',
 true),

('Masculina Madura – Confiável', 'male-mature-trustworthy', 'male', 'pt-BR', 
 'Tom firme e seguro. Recomendado para anúncios e instruções.', 
 NULL, 
 'Olá. Esta é uma voz de referência em português do Brasil, com tom firme e confiável. Recomendada para anúncios, instruções e comunicações mais sérias.',
 true),

('Masculina – Vendas/Enérgica', 'male-energetic-sales', 'male', 'pt-BR', 
 'Energia comercial. Ideal para promos e CTAs.', 
 NULL, 
 'Vamos lá! Esta é uma amostra de voz em português do Brasil, com energia e intenção comercial. Ideal para chamadas curtas, promoções e CTAs.',
 true),

-- NEUTRA (1)
('Neutra – Narrador', 'neutral-narrator', 'neutral', 'pt-BR', 
 'Voz neutra e bem articulada. Excelente para narração de vídeos de produto.', 
 NULL, 
 'Esta é uma voz de referência em português do Brasil, neutra e bem articulada. Excelente para narração de vídeos de produto e explicações rápidas.',
 true)

ON CONFLICT (slug) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  ref_text = EXCLUDED.ref_text,
  is_active = true,
  ref_audio_url = NULL; -- Reset URL para forçar novo upload