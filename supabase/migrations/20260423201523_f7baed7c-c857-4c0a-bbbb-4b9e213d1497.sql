
-- Limpeza restrita: histórico WhatsApp do número de teste no tenant Respeite o Homem
WITH target_convs AS (
  SELECT id FROM public.conversations
  WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
    AND customer_phone LIKE '%73991681425%'
)
DELETE FROM public.messages
WHERE conversation_id IN (SELECT id FROM target_convs);

DELETE FROM public.conversations
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND customer_phone LIKE '%73991681425%';
