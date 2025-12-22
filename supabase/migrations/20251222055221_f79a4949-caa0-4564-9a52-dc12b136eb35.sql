-- PONTO 1: Adicionar contact_captured_at para controlar quando contato foi capturado
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS contact_captured_at timestamptz NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.checkout_sessions.contact_captured_at IS 'Timestamp when customer contact info was captured (step 1 complete). Only sessions with this set should be considered for abandoned recovery.';

-- Índice para queries de abandono (só com contato capturado)
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_abandoned_with_contact 
  ON public.checkout_sessions (tenant_id, status, contact_captured_at) 
  WHERE contact_captured_at IS NOT NULL;