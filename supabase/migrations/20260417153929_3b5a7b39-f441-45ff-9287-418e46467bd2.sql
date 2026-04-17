ALTER TABLE public.email_marketing_campaigns
  DROP CONSTRAINT IF EXISTS email_marketing_campaigns_type_check;

ALTER TABLE public.email_marketing_campaigns
  ADD CONSTRAINT email_marketing_campaigns_type_check
  CHECK (type = ANY (ARRAY['broadcast'::text, 'sequence'::text, 'automation'::text]));

DELETE FROM public.email_marketing_campaigns WHERE name LIKE 'TESTE_VALIDACAO%';
DELETE FROM public.email_marketing_templates WHERE name LIKE 'TESTE_VALIDACAO%';