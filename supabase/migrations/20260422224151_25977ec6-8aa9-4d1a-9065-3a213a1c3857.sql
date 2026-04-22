-- F2 — reset do contexto de teste (número 5573991681425, tenant respeite-o-homem)
DELETE FROM ai_support_turn_log WHERE conversation_id = '1b908be3-a49b-46f1-b1fb-86cd42231003';
DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = '1b908be3-a49b-46f1-b1fb-86cd42231003');
DELETE FROM messages WHERE conversation_id = '1b908be3-a49b-46f1-b1fb-86cd42231003';
UPDATE conversations
   SET sales_state = 'greeting',
       sales_state_updated_at = now(),
       last_intent = NULL,
       last_bot_response_hash = NULL,
       images_sent_per_product = '{}'::jsonb,
       status = 'bot',
       updated_at = now()
 WHERE id = '1b908be3-a49b-46f1-b1fb-86cd42231003';