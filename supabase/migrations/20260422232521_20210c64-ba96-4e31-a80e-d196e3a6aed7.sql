DO $$
DECLARE
  v_conv_id uuid := '1b908be3-a49b-46f1-b1fb-86cd42231003';
BEGIN
  DELETE FROM messages WHERE conversation_id = v_conv_id;
  DELETE FROM ai_support_turn_log WHERE conversation_id = v_conv_id;
  UPDATE conversations
     SET sales_state = 'greeting',
         sales_state_updated_at = NOW(),
         last_intent = NULL,
         last_bot_response_hash = NULL,
         images_sent_per_product = '{}'::jsonb,
         status = 'bot',
         updated_at = NOW(),
         last_customer_message_at = NULL
   WHERE id = v_conv_id;
END $$;