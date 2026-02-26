-- Adicionar campos para steps ricos no quiz builder
-- step_type: 'question' (padrão) ou 'content' (apenas conteúdo visual)
-- description: texto rico (markdown) para acompanhar a pergunta ou step de conteúdo
-- media: { type: 'image'|'video', url: string, alt?: string, thumbnail?: string }

ALTER TABLE public.quiz_questions 
  ADD COLUMN IF NOT EXISTS step_type TEXT NOT NULL DEFAULT 'question',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS media JSONB;

-- Comentários para documentação
COMMENT ON COLUMN public.quiz_questions.step_type IS 'question = pergunta normal, content = etapa apenas visual (sem resposta)';
COMMENT ON COLUMN public.quiz_questions.description IS 'Texto rico (markdown) de apoio à pergunta ou conteúdo do step';
COMMENT ON COLUMN public.quiz_questions.media IS 'Mídia: {type: image|video, url: string, alt?: string}';