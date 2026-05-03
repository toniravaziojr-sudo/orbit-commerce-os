ALTER TABLE public.ai_support_config
  ADD COLUMN IF NOT EXISTS business_context text,
  ADD COLUMN IF NOT EXISTS attendance_rules text;

COMMENT ON COLUMN public.ai_support_config.business_context IS 'Onda 1A: contexto factual do negócio (o que vende, público, lógica comercial). Editado pelo usuário em Configurações Gerais da IA. Ainda não lido pelo prompt em runtime — leitura entrará em onda futura (Context Compiler).';
COMMENT ON COLUMN public.ai_support_config.attendance_rules IS 'Onda 1A: regras gerais de atendimento (como a IA deve conduzir conversa, quando escalar, regras comerciais). Editado pelo usuário. Ainda não lido pelo prompt em runtime.';