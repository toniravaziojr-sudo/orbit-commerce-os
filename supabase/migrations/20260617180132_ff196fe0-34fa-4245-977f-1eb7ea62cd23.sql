WITH cleaned AS (
  SELECT id,
    jsonb_set(
      action_data,
      '{planned_actions}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(act->'adsets') = 'array' THEN
              jsonb_set(
                CASE WHEN (act->'audience_exclusions'->>'customer_audience_detected')::text='true'
                     THEN jsonb_set(act, '{audience_exclusions}', (act->'audience_exclusions') - 'pending_dependency')
                     ELSE act END,
                '{adsets}',
                (SELECT jsonb_agg(
                  CASE WHEN (adset->'audience_exclusions'->>'customer_audience_detected')::text='true'
                       THEN jsonb_set(adset, '{audience_exclusions}', (adset->'audience_exclusions') - 'pending_dependency')
                       ELSE adset END
                ) FROM jsonb_array_elements(act->'adsets') adset)
              )
            ELSE act
          END
        )
        FROM jsonb_array_elements(action_data->'planned_actions') act
      )
    ) AS new_data
  FROM ads_autopilot_actions
  WHERE id='392f800a-84df-4bf4-8140-084b268e1b68'
)
UPDATE ads_autopilot_actions a
SET action_data = jsonb_set(cleaned.new_data, '{approval_status}', '"pending_approval"'),
    status = 'pending_approval'
FROM cleaned
WHERE a.id = cleaned.id;