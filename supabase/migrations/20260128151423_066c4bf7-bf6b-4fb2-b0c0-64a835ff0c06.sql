-- Adicionar os plan_keys de billing_plans na tabela plans para manter compatibilidade com FK
INSERT INTO public.plans (plan_key, name, description, is_active, sort_order, order_limit)
SELECT 
  bp.plan_key,
  bp.name,
  bp.description,
  bp.is_active,
  bp.sort_order,
  bp.included_orders_per_month
FROM public.billing_plans bp
WHERE NOT EXISTS (
  SELECT 1 FROM public.plans p WHERE p.plan_key = bp.plan_key
)
ON CONFLICT (plan_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;