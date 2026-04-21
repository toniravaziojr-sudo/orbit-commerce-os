-- ============================================================
-- Reconciliação manual do caso Toni (tenant: respeite-o-homem)
-- Conversa canônica (com 9º dígito): 5a1c4996-b97c-4d50-b811-7788a3194341
-- Conversa duplicada (sem 9º dígito): e3aa57a2-89b2-410f-b993-f00473f4a042
-- ============================================================

-- 1) Move todas as mensagens da duplicada para a canônica (preserva histórico)
UPDATE public.messages
SET conversation_id = '5a1c4996-b97c-4d50-b811-7788a3194341'
WHERE conversation_id = 'e3aa57a2-89b2-410f-b993-f00473f4a042'
  AND tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';

-- 2) Persiste a mensagem inbound órfã (16:37) na conversa canônica,
--    se ainda não estiver lá (idempotente por external_message_id).
INSERT INTO public.messages (
  conversation_id,
  tenant_id,
  direction,
  sender_type,
  sender_name,
  content,
  content_type,
  delivery_status,
  external_message_id,
  is_ai_generated,
  is_internal,
  is_note,
  created_at
)
SELECT
  '5a1c4996-b97c-4d50-b811-7788a3194341',
  wim.tenant_id,
  'inbound',
  'customer',
  COALESCE(wim.from_phone, 'Toni'),
  wim.message_content,
  CASE WHEN wim.message_type = 'text' THEN 'text' ELSE wim.message_type END,
  'delivered',
  wim.external_message_id,
  false,
  false,
  false,
  wim.created_at
FROM public.whatsapp_inbound_messages wim
WHERE wim.id = '7617f7e6-4dc0-444b-b745-503ae6025601'
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.external_message_id = wim.external_message_id
      AND m.tenant_id = wim.tenant_id
  );

-- 2b) Marca a inbound órfã como processada e vinculada à canônica
UPDATE public.whatsapp_inbound_messages
SET processed_at = NOW(),
    processed_by = 'manual_reconciliation_toni',
    conversation_id = '5a1c4996-b97c-4d50-b811-7788a3194341'
WHERE id = '7617f7e6-4dc0-444b-b745-503ae6025601';

-- 2c) Faz o mesmo para a inbound de 14:15 que também ficou órfã
UPDATE public.whatsapp_inbound_messages
SET processed_at = NOW(),
    processed_by = 'manual_reconciliation_toni',
    conversation_id = '5a1c4996-b97c-4d50-b811-7788a3194341'
WHERE id = '22dc0bd9-efa0-4f8c-b2bb-13e1f1b7b02a'
  AND processed_at IS NULL;

INSERT INTO public.messages (
  conversation_id,
  tenant_id,
  direction,
  sender_type,
  sender_name,
  content,
  content_type,
  delivery_status,
  external_message_id,
  is_ai_generated,
  is_internal,
  is_note,
  created_at
)
SELECT
  '5a1c4996-b97c-4d50-b811-7788a3194341',
  wim.tenant_id,
  'inbound',
  'customer',
  COALESCE(wim.from_phone, 'Toni'),
  wim.message_content,
  CASE WHEN wim.message_type = 'text' THEN 'text' ELSE wim.message_type END,
  'delivered',
  wim.external_message_id,
  false,
  false,
  false,
  wim.created_at
FROM public.whatsapp_inbound_messages wim
WHERE wim.id = '22dc0bd9-efa0-4f8c-b2bb-13e1f1b7b02a'
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.external_message_id = wim.external_message_id
      AND m.tenant_id = wim.tenant_id
  );

-- 3) Reabre a conversa canônica em modo IA (bot), atualiza timestamps
UPDATE public.conversations
SET status = 'bot',
    assigned_to = NULL,
    last_message_at = NOW(),
    last_customer_message_at = NOW(),
    customer_name = COALESCE(NULLIF(customer_name, ''), 'Toni'),
    updated_at = NOW()
WHERE id = '5a1c4996-b97c-4d50-b811-7788a3194341';

-- 4) Marca a conversa duplicada como spam (some das filas, preserva histórico)
UPDATE public.conversations
SET status = 'spam',
    subject = COALESCE(subject, '') || ' [reconciliada -> 5a1c4996]',
    updated_at = NOW()
WHERE id = 'e3aa57a2-89b2-410f-b993-f00473f4a042';