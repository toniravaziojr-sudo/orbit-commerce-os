UPDATE public.ai_support_config
SET ai_model = 'openai/gpt-5',
    updated_at = now()
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND (ai_model IS NULL OR ai_model ILIKE '%flash%' OR ai_model ILIKE '%mini%' OR ai_model ILIKE '%nano%');