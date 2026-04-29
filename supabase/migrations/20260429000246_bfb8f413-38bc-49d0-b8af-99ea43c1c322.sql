
CREATE OR REPLACE FUNCTION public.handle_conversation_assignment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL) THEN
    IF NEW.status IN ('new', 'waiting_agent', 'bot') THEN
      NEW.status := 'open';
    END IF;
    IF NEW.assigned_at IS NULL THEN
      NEW.assigned_at := now();
    END IF;
  END IF;

  IF (OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL) THEN
    -- Encerramento (resolved) preserva resolved; conversas ativas voltam para fila
    IF NEW.status IN ('open', 'waiting_customer') THEN
      NEW.status := 'waiting_agent';
    END IF;
    NEW.assigned_at := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.capture_human_agent_learning()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last_customer_msg text;
BEGIN
  IF NEW.sender_type <> 'agent' THEN RETURN NEW; END IF;
  IF NEW.direction <> 'outbound' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_internal, false) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_note, false) THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_ai_generated, false) THEN RETURN NEW; END IF;
  IF NEW.content IS NULL OR length(trim(NEW.content)) < 10 THEN RETURN NEW; END IF;

  SELECT m.content INTO v_last_customer_msg
  FROM public.messages m
  WHERE m.conversation_id = NEW.conversation_id
    AND m.direction = 'inbound'
    AND m.sender_type = 'customer'
    AND m.created_at < NEW.created_at
  ORDER BY m.created_at DESC
  LIMIT 1;

  BEGIN
    INSERT INTO public.tenant_learning_events (
      tenant_id, ai_agent, conversation_id, event_type, weight,
      customer_message, ai_response, metadata
    ) VALUES (
      NEW.tenant_id,
      'support',
      NEW.conversation_id,
      'human_correction_positive',
      10,
      v_last_customer_msg,
      NEW.content,
      jsonb_build_object(
        'source', 'human_agent_message',
        'message_id', NEW.id,
        'agent_user_id', NEW.sender_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'capture_human_agent_learning failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_capture_human_agent_learning ON public.messages;
CREATE TRIGGER trg_capture_human_agent_learning
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.capture_human_agent_learning();

COMMENT ON FUNCTION public.capture_human_agent_learning() IS
  'Eixo 4 Cerebro Regenerativo: captura mensagem outbound real do atendente humano como evento de aprendizado (human_correction_positive, peso 10). Aggregator promove para tenant_learning_memory como winning_response.';

COMMENT ON FUNCTION public.handle_conversation_assignment_status() IS
  'Transicao de status por assignment. Encerrar conversa (resolved + clear assigned_to) preserva resolved.';
