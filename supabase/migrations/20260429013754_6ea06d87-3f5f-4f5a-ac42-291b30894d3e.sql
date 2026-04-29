UPDATE public.notifications
SET status = 'scheduled', next_attempt_at = NOW(), attempt_count = 0, last_error = NULL, updated_at = NOW()
WHERE status = 'failed'
  AND channel = 'whatsapp'
  AND last_error LIKE '%bloqueado%';