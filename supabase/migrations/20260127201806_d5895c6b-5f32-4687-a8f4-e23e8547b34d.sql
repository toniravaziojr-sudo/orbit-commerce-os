-- Fix feature_bullets update using JSONB concatenation
UPDATE public.billing_plans 
SET feature_bullets = COALESCE(feature_bullets, '[]'::jsonb) || '["ChatGPT: Não disponível"]'::jsonb 
WHERE plan_key = 'basico';

UPDATE public.billing_plans 
SET feature_bullets = COALESCE(feature_bullets, '[]'::jsonb) || '["ChatGPT: Não disponível"]'::jsonb 
WHERE plan_key = 'evolucao';

UPDATE public.billing_plans 
SET feature_bullets = COALESCE(feature_bullets, '[]'::jsonb) || '["ChatGPT: US$ 2/mês incluídos"]'::jsonb 
WHERE plan_key = 'profissional';

UPDATE public.billing_plans 
SET feature_bullets = COALESCE(feature_bullets, '[]'::jsonb) || '["ChatGPT: US$ 5/mês incluídos"]'::jsonb 
WHERE plan_key = 'avancado';

UPDATE public.billing_plans 
SET feature_bullets = COALESCE(feature_bullets, '[]'::jsonb) || '["ChatGPT: US$ 10/mês incluídos"]'::jsonb 
WHERE plan_key = 'impulso';

UPDATE public.billing_plans 
SET feature_bullets = COALESCE(feature_bullets, '[]'::jsonb) || '["ChatGPT: US$ 15/mês incluídos"]'::jsonb 
WHERE plan_key = 'consolidar';

UPDATE public.billing_plans 
SET feature_bullets = COALESCE(feature_bullets, '[]'::jsonb) || '["ChatGPT: US$ 25/mês incluídos"]'::jsonb 
WHERE plan_key = 'comando_maximo';

UPDATE public.billing_plans 
SET feature_bullets = COALESCE(feature_bullets, '[]'::jsonb) || '["ChatGPT: Ilimitado"]'::jsonb 
WHERE plan_key = 'customizado';