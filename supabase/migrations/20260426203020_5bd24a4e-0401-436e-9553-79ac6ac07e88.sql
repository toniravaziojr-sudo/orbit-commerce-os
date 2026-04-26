-- Cache persistente de incompatibilidades de parâmetro por modelo de IA.
-- Substitui o cache em-memória que se perdia a cada cold start, eliminando
-- o overhead de ~5-8s de erro+retry em todo turno de gpt-5-mini.
CREATE TABLE IF NOT EXISTS public.ai_model_param_compat (
  model text NOT NULL,
  param_name text NOT NULL,
  incompatible boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  PRIMARY KEY (model, param_name)
);

-- Índice para varreduras de expiração e leituras rápidas.
CREATE INDEX IF NOT EXISTS idx_ai_model_param_compat_expires
  ON public.ai_model_param_compat (expires_at);

-- RLS habilitada — acesso somente via service role (edge functions).
ALTER TABLE public.ai_model_param_compat ENABLE ROW LEVEL SECURITY;

-- Sem políticas públicas: nenhum cliente final pode ler/escrever.
-- (service role bypassa RLS automaticamente)
COMMENT ON TABLE public.ai_model_param_compat IS
  'Cache persistente de parâmetros incompatíveis por modelo (ex: reasoning no gpt-5-mini). Lido e escrito apenas por edge functions com service role.';