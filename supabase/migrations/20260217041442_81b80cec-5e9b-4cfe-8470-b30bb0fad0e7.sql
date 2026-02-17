
-- Add attachments column to ads_chat_messages for multimodal support
ALTER TABLE public.ads_chat_messages 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.ads_chat_messages.attachments IS 'Array of {url, filename, mimeType} for uploaded images/files';
