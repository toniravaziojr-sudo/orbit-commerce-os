-- Reverter handoff indevido criado por bug do guardrail anterior
-- Tickets criados para "Oi" sem demanda real, agora bloqueados pelo novo guardrail
UPDATE public.support_tickets
SET status = 'closed',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'closed_reason', 'handoff_indevido_guardrail_retroativo',
      'closed_at', now()
    ),
    updated_at = now()
WHERE id IN (
  'bfe7a6e5-6755-4f4a-9036-15337973b7ec',
  '59c67f5c-9ae8-4291-b196-b2c6b7656c3e'
);

-- Reverter status da conversa para 'bot' para que a IA possa retomar o atendimento
UPDATE public.conversations
SET status = 'bot',
    updated_at = now()
WHERE id = '5a1c4996-b97c-4d50-b811-7788a3194341'
  AND status = 'waiting_agent';

-- Liberar carrinho (se houver) que ficou marcado como handoff
UPDATE public.whatsapp_carts
SET status = 'active',
    handoff_reason = NULL,
    handoff_ticket_id = NULL,
    updated_at = now()
WHERE conversation_id = '5a1c4996-b97c-4d50-b811-7788a3194341'
  AND status = 'handoff';