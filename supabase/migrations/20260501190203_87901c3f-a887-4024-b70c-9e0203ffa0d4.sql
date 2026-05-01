-- Recovery do pedido #10 (Amazgan): rascunho fiscal foi marcado 'done' sem ter sido criado
-- (false positive corrigido em v2.5.0 do scheduler + v9.0.0 do worker).
-- Reenfileira para reprocessamento com a lógica permissiva.
UPDATE public.fiscal_draft_queue
SET status = 'pending',
    attempts = 0,
    error_message = NULL,
    processed_at = NULL
WHERE id = 'a6439f6b-2664-47b1-a27a-89e22a6185b8'
  AND order_id = '08f44bfb-80ab-435b-8156-d866d679f8b6';