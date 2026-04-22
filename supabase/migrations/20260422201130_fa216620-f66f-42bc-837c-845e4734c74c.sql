DO $$
DECLARE
  v_conv_id uuid := '5a1c4996-b97c-4d50-b811-7788a3194341';
BEGIN
  DELETE FROM ai_support_turn_log WHERE conversation_id = v_conv_id;
  DELETE FROM ai_conversation_summaries WHERE conversation_id = v_conv_id;
  DELETE FROM ai_media_queue WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = v_conv_id);
  DELETE FROM message_attachments WHERE message_id IN (SELECT id FROM messages WHERE conversation_id = v_conv_id);
  DELETE FROM messages WHERE conversation_id = v_conv_id;
  UPDATE conversations
     SET sales_state = 'greeting',
         discovery_questions_asked = 0,
         images_sent_per_product = '{}'::jsonb,
         last_intent = NULL,
         last_bot_response_hash = NULL
   WHERE id = v_conv_id;
END $$;