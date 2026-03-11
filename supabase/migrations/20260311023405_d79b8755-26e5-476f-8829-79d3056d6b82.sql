
-- Allow anonymous users to create chat conversations
CREATE POLICY "Anon can insert chat conversations"
ON public.conversations
FOR INSERT
TO anon
WITH CHECK (channel_type = 'chat');

-- Allow anonymous users to read their own conversation by ID
CREATE POLICY "Anon can read own chat conversation"
ON public.conversations
FOR SELECT
TO anon
USING (channel_type = 'chat');

-- Allow anonymous users to insert messages into chat conversations
CREATE POLICY "Anon can insert chat messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  direction = 'inbound' 
  AND sender_type = 'customer'
  AND EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND channel_type = 'chat'
  )
);

-- Allow anonymous users to read messages from chat conversations
CREATE POLICY "Anon can read chat messages"
ON public.messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND channel_type = 'chat'
  )
);
