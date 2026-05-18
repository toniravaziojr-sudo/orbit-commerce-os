UPDATE public.notifications
SET status = 'retrying',
    attempt_count = 0,
    next_attempt_at = NOW(),
    scheduled_for = NOW(),
    last_error = NULL,
    updated_at = NOW()
WHERE id = '9a68d71e-74f4-4819-ba3a-c2ed3eac30db'
  AND tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';

DELETE FROM public.notification_logs
WHERE notification_id = '9a68d71e-74f4-4819-ba3a-c2ed3eac30db'
  AND status = 'pending';