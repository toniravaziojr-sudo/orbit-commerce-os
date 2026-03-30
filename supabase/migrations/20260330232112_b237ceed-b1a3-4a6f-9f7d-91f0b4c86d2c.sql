
-- Fase 2: Adicionar auth_profile_key em meta_oauth_states
-- Permite que o callback saiba qual perfil foi escolhido no start

ALTER TABLE public.meta_oauth_states 
ADD COLUMN auth_profile_key TEXT DEFAULT NULL;

COMMENT ON COLUMN public.meta_oauth_states.auth_profile_key IS 'V4: Perfil de auth escolhido no start (meta_auth_full ou meta_auth_external)';
