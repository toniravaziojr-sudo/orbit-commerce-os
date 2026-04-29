-- ============================================================
-- Limpeza do histórico de teste — contato 5573991681425
-- Tenant: d1a4d0ed-8842-495e-b741-540a9a345b25 (Respeite o Homem)
-- Conversa: 97b54ad3-f2d7-4771-a1d7-6c651bc9b512
-- Customers: b5c76dc3-481b-44f4-a0c0-b3d8a31eba67, 2ed33bb7-e601-4611-957e-4da36e37fed6
-- ============================================================

-- Mensagens da conversa de teste
DELETE FROM messages
WHERE conversation_id = '97b54ad3-f2d7-4771-a1d7-6c651bc9b512';

-- Mensagens WhatsApp do telefone (envio/recebimento)
DELETE FROM whatsapp_messages
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND recipient_phone = '5573991681425';

-- Log canônico de turnos da IA da conversa
DELETE FROM ai_support_turn_log
WHERE conversation_id = '97b54ad3-f2d7-4771-a1d7-6c651bc9b512';

-- Resumos de conversa
DELETE FROM ai_conversation_summaries
WHERE conversation_id = '97b54ad3-f2d7-4771-a1d7-6c651bc9b512';

-- Memórias da IA originadas dessa conversa
DELETE FROM ai_memories
WHERE source_conversation_id = '97b54ad3-f2d7-4771-a1d7-6c651bc9b512';

-- A própria conversa (zera estado/foco/pendência/sales_state)
DELETE FROM conversations
WHERE id = '97b54ad3-f2d7-4771-a1d7-6c651bc9b512';
