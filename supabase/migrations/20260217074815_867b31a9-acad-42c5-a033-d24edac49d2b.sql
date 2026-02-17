-- Add chat_overrides column to ads_autopilot_account_configs
-- This stores overrides made by the user via chat commands (prioridade máxima)
ALTER TABLE public.ads_autopilot_account_configs 
ADD COLUMN IF NOT EXISTS chat_overrides JSONB DEFAULT NULL;

COMMENT ON COLUMN public.ads_autopilot_account_configs.chat_overrides IS 'Overrides aplicados pelo lojista via chat. Têm prioridade máxima sobre configurações de tela.';