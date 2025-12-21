-- HARDEN: Remove políticas permissivas e restringir escrita ao service role
-- As Edge Functions usam service role que bypassa RLS

-- Remove políticas inseguras de INSERT/UPDATE
DROP POLICY IF EXISTS "checkout_sessions_insert_service" ON public.checkout_sessions;
DROP POLICY IF EXISTS "checkout_sessions_update_service" ON public.checkout_sessions;

-- A política de SELECT já está correta (tenant-scoped para usuários autenticados)
-- Não precisa alterar: checkout_sessions_select_policy

-- NOTA: Não criamos novas políticas de INSERT/UPDATE porque as Edge Functions
-- usam service role key que bypassa completamente o RLS.
-- Isso garante que APENAS as Edge Functions podem escrever na tabela.