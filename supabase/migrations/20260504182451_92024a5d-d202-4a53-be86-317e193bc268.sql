DELETE FROM public.platform_external_costs WHERE service_key = 'nuvem_fiscal';

INSERT INTO public.platform_external_costs (
  service_key, display_name, category, description, vendor_url,
  billing_model, sync_mode, is_active
) VALUES (
  'focus_nfe',
  'Focus NFe',
  'fiscal',
  'Emissor fiscal NF-e (token único da plataforma)',
  'https://app.focusnfe.com.br/',
  'subscription',
  'manual',
  true
)
ON CONFLICT (service_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  vendor_url = EXCLUDED.vendor_url,
  category = EXCLUDED.category,
  is_active = true;