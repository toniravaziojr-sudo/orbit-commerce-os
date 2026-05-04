
ALTER TABLE public.platform_external_costs
  ADD COLUMN IF NOT EXISTS billing_model text NOT NULL DEFAULT 'subscription'
  CHECK (billing_model IN ('subscription','prepaid','payg'));

-- Subscription (custo fixo mensal)
UPDATE public.platform_external_costs SET billing_model='subscription'
 WHERE service_key IN ('lovable','cloudflare','sendgrid','firecrawl','focus_nfe','nuvem_fiscal');

-- Prepaid (saldo / créditos)
UPDATE public.platform_external_costs SET billing_model='prepaid'
 WHERE service_key IN ('fal_ai','openai','google_cloud');

-- Pay-as-you-go (cobrado por uso, sem saldo)
UPDATE public.platform_external_costs SET billing_model='payg'
 WHERE service_key IN ('gemini');

-- Sync auto só faz sentido onde realmente lemos saldo via API.
UPDATE public.platform_external_costs SET sync_mode='manual'
 WHERE service_key IN ('fal_ai','openai','gemini','cloudflare','google_cloud','firecrawl','focus_nfe','nuvem_fiscal','lovable');

UPDATE public.platform_external_costs SET sync_mode='auto'
 WHERE service_key='sendgrid';
