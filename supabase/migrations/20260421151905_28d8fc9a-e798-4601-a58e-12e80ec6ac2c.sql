-- =========================================================
-- Phase 1 — Pipeline inbound estrutural
-- Trigger: assignment → status (humano assume = status 'open')
-- =========================================================

CREATE OR REPLACE FUNCTION public.handle_conversation_assignment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Caso 1: assigned_to passou de NULL para um usuário (humano assumiu)
  IF (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL) THEN
    -- Só promove para 'open' se a conversa ainda estava em estados de fila
    IF NEW.status IN ('new', 'waiting_agent', 'bot') THEN
      NEW.status := 'open';
    END IF;
    -- Garante carimbo de assignment se quem chamou não setou
    IF NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
    END IF;
  END IF;

  -- Caso 2: assigned_to passou de usuário para NULL (humano largou)
  IF (OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL) THEN
    -- Se estava em 'open' ou 'waiting_customer' (estados típicos de atendimento humano),
    -- volta para 'waiting_agent' para reentrar na fila Em aberto.
    IF NEW.status IN ('open', 'waiting_customer') THEN
      NEW.status := 'waiting_agent';
    END IF;
    NEW.assigned_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS conversations_assignment_status ON public.conversations;

CREATE TRIGGER conversations_assignment_status
BEFORE UPDATE OF assigned_to ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.handle_conversation_assignment_status();

COMMENT ON FUNCTION public.handle_conversation_assignment_status() IS
'Phase 1: Quando assigned_to muda, sincroniza status da conversa para refletir fila correta (Em aberto / Atendimento) sem precisar de update manual nos clientes.';