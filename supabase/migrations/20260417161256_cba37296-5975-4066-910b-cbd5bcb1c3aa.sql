-- 1) Limpeza dos fluxos visuais antigos (sem dados em produção)
DELETE FROM public.email_automation_edges;
DELETE FROM public.email_automation_nodes;
DELETE FROM public.email_automation_flows;

-- 2) Adicionar coluna delivered_count em email_marketing_campaigns
ALTER TABLE public.email_marketing_campaigns
  ADD COLUMN IF NOT EXISTS delivered_count integer NOT NULL DEFAULT 0;

-- 3) Trigger: ao inserir uma email_conversion, cria/atualiza order_attribution
--    (somente se ainda não existir registro de atribuição para o pedido).
CREATE OR REPLACE FUNCTION public.propagate_email_conversion_to_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_name text;
BEGIN
  -- Buscar nome da campanha para utm_campaign
  SELECT name INTO v_campaign_name
  FROM public.email_marketing_campaigns
  WHERE id = NEW.campaign_id;

  -- Inserir atribuição apenas se o pedido ainda não tiver uma (last-click vence aqui)
  INSERT INTO public.order_attribution (
    tenant_id,
    order_id,
    attribution_source,
    attribution_medium,
    utm_source,
    utm_medium,
    utm_campaign,
    first_touch_at
  )
  VALUES (
    NEW.tenant_id,
    NEW.order_id,
    'email',
    'email',
    'email_marketing',
    'email',
    COALESCE(v_campaign_name, 'campaign_' || NEW.campaign_id::text),
    NEW.attributed_at
  )
  ON CONFLICT (order_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_email_conversion_to_attribution ON public.email_conversions;
CREATE TRIGGER trg_propagate_email_conversion_to_attribution
AFTER INSERT ON public.email_conversions
FOR EACH ROW
EXECUTE FUNCTION public.propagate_email_conversion_to_attribution();