UPDATE public.ads_autopilot_actions
SET status = 'pending_approval',
    executed_at = NULL,
    approved_at = NULL,
    action_data = jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(action_data,
              '{lifecycle,status}', '"ready_for_review"'),
            '{lifecycle,published_at}', 'null'),
          '{lifecycle,reverted_at}', to_jsonb(now()::text)),
        '{lifecycle,revert_reason}', '"Campanha removida manualmente da Meta pelo lojista — devolvida para nova publicação com publisher v1.6.0"'),
      '{lifecycle,meta_campaign_id}', 'null')
WHERE id = 'ee2cf98d-de5d-4426-8845-aaad009bee27';