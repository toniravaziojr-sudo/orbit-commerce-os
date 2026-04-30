-- Limpeza completa do contato de teste 5573991681425 no tenant respeite-o-homem
-- Tenant: d1a4d0ed-8842-495e-b741-540a9a345b25
-- Customers: b5c76dc3-481b-44f4-a0c0-b3d8a31eba67, 2ed33bb7-e601-4611-957e-4da36e37fed6
-- Conversation: 7008e95b-c26f-4ab6-a094-9d798bc25d66
-- Escopo: limpa histórico de mensagens, conversa, eventos, logs de IA, memórias e resumos.
-- NÃO toca em: customers (cadastro), orders, tenant_learning_events.

DO $$
DECLARE
  v_tenant uuid := 'd1a4d0ed-8842-495e-b741-540a9a345b25';
  v_conv uuid := '7008e95b-c26f-4ab6-a094-9d798bc25d66';
BEGIN
  -- Mensagens WhatsApp do número
  DELETE FROM whatsapp_messages
  WHERE tenant_id = v_tenant AND recipient_phone LIKE '%991681425%';

  -- Logs de turnos e tool calls da IA para a conversa
  DELETE FROM ai_support_tool_calls
  WHERE tenant_id = v_tenant AND conversation_id = v_conv;

  DELETE FROM ai_support_turn_log
  WHERE tenant_id = v_tenant AND conversation_id = v_conv;

  -- Eventos da conversa
  DELETE FROM conversation_events WHERE conversation_id = v_conv;

  -- Resumos e memórias da IA ligados à conversa/contato
  DELETE FROM ai_conversation_summaries
  WHERE tenant_id = v_tenant AND conversation_id = v_conv;

  DELETE FROM ai_memories
  WHERE tenant_id = v_tenant
    AND (
      content LIKE '%991681425%'
      OR metadata::text LIKE '%991681425%'
      OR metadata::text LIKE '%7008e95b%'
      OR source_conversation_id = v_conv
    );

  -- Participantes e a conversa em si
  DELETE FROM conversation_participants WHERE conversation_id = v_conv;
  DELETE FROM conversations WHERE id = v_conv;
END $$;