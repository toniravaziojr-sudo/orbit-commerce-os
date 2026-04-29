-- Reset 1 failed WhatsApp notification (order #369) to validate v1.6.0 safety-net.
-- Anti-regression: see mem://constraints/notification-template-render-contract
UPDATE public.notifications
SET status = 'scheduled',
    next_attempt_at = NOW(),
    attempt_count = 0,
    last_error = NULL,
    updated_at = NOW()
WHERE id = '290d88ae-71f7-4e2f-a9a4-5774c2180cc5'
  AND status = 'failed';