-- Add provider_message_id column to whatsapp_messages if it doesn't exist
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS provider_message_id text;

-- Add provider_response column for storing full API response
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS provider_response jsonb;