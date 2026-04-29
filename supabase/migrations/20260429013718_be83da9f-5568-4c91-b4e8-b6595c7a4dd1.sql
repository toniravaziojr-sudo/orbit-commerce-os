UPDATE public.notifications
SET status = 'scheduled', next_attempt_at = NOW(), attempt_count = 0, last_error = NULL, updated_at = NOW()
WHERE id = '290d88ae-71f7-4e2f-a9a4-5774c2180cc5';