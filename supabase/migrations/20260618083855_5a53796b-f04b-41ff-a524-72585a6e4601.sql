UPDATE public.ads_autopilot_actions
SET status = 'pending_approval',
    approved_at = NULL,
    action_data = jsonb_set(
      action_data,
      '{lifecycle}',
      jsonb_build_object(
        'status', 'campaign_proposal_pending_review',
        'version', 'h3_v1',
        'created_at', action_data->'lifecycle'->>'created_at',
        'reverted_at', to_jsonb(now()),
        'reverted_reason', 'limbo_recovery_publish_never_completed',
        'previous_lifecycle', action_data->'lifecycle'
      )
    )
WHERE id = 'ee2cf98d-de5d-4426-8845-aaad009bee27'
  AND status = 'approved';