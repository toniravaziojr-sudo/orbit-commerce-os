DELETE FROM public.message_attachments
WHERE message_id IN (
  SELECT id FROM public.messages WHERE conversation_id = '1b908be3-a49b-46f1-b1fb-86cd42231003'
);

DELETE FROM public.ai_support_turn_log WHERE conversation_id = '1b908be3-a49b-46f1-b1fb-86cd42231003';

DELETE FROM public.messages WHERE conversation_id = '1b908be3-a49b-46f1-b1fb-86cd42231003';

UPDATE public.conversations
SET sales_state = 'greeting',
    unread_count = 0,
    updated_at = NOW()
WHERE id = '1b908be3-a49b-46f1-b1fb-86cd42231003';