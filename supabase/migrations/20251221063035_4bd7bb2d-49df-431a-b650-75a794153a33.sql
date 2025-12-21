-- ============================================
-- PATCH 3.2.1: Hardening de webhook_secrets
-- ============================================

-- A) Adicionar coluna secret_hash
ALTER TABLE public.webhook_secrets 
ADD COLUMN IF NOT EXISTS secret_hash text NOT NULL DEFAULT '';

-- B) Backfill: converter secrets existentes para hash (SHA-256 hex)
UPDATE public.webhook_secrets 
SET secret_hash = encode(sha256(secret::bytea), 'hex')
WHERE secret IS NOT NULL AND secret != '' AND secret_hash = '';

-- C) Zerar coluna secret (não podemos dropar facilmente, então zeramos)
UPDATE public.webhook_secrets SET secret = '';

-- D) Atualizar RLS: remover policy de SELECT genérico e restringir para owner/admin
DROP POLICY IF EXISTS "Users can view webhook_secrets" ON public.webhook_secrets;

-- Novo SELECT restrito a owner/admin
CREATE POLICY "Only owner/admin can view webhook_secrets"
ON public.webhook_secrets
FOR SELECT
TO authenticated
USING (
  tenant_id IN (
    SELECT ur.tenant_id FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('owner', 'admin')
  )
);

-- E) Comentário na tabela para documentar
COMMENT ON COLUMN public.webhook_secrets.secret IS 'DEPRECATED: use secret_hash. Valor zerado por segurança.';
COMMENT ON COLUMN public.webhook_secrets.secret_hash IS 'SHA-256 hex do secret original. Validação server-side.';