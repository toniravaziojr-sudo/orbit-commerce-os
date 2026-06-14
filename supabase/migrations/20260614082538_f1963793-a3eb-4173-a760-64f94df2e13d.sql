UPDATE public.ads_autopilot_actions
SET status = 'pending_approval',
    policy_check_result = NULL,
    idempotency_key = NULL,
    approved_at = NULL
WHERE id = '529e88f9-1adb-4c9e-ab9c-940ddc0fd7e5'
  AND status = 'rejected_duplicate';