-- Fix security warning: set search_path for the function
CREATE OR REPLACE FUNCTION public.update_conversation_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.conversations
    SET 
      message_count = message_count + 1,
      last_message_at = NEW.created_at,
      unread_count = CASE 
        WHEN NEW.direction = 'inbound' THEN unread_count + 1 
        ELSE unread_count 
      END,
      last_customer_message_at = CASE 
        WHEN NEW.sender_type = 'customer' THEN NEW.created_at 
        ELSE last_customer_message_at 
      END,
      last_agent_message_at = CASE 
        WHEN NEW.sender_type IN ('agent', 'bot') THEN NEW.created_at 
        ELSE last_agent_message_at 
      END,
      first_response_at = CASE 
        WHEN first_response_at IS NULL AND NEW.sender_type IN ('agent', 'bot') AND NEW.direction = 'outbound'
        THEN NEW.created_at 
        ELSE first_response_at 
      END
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;