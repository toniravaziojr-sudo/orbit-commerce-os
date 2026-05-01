-- =========================================================
-- Frente 9: Flag "Venda IA" + Atribuição automática
-- Frente 8 (preparação): coluna greeting_style em ai_support_config
-- =========================================================

-- 1) Coluna sales_channel em orders (canal de venda)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS sales_channel text NOT NULL DEFAULT 'storefront';

-- Validação: garantir valores conhecidos via trigger (NÃO usar CHECK constraint
-- para permitir extensão futura sem migração estrutural)
CREATE OR REPLACE FUNCTION public.validate_orders_sales_channel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sales_channel IS NULL THEN
    NEW.sales_channel := 'storefront';
  END IF;
  IF NEW.sales_channel NOT IN ('storefront','ai_attendant','marketplace','link_checkout','manual','import') THEN
    RAISE EXCEPTION 'Invalid sales_channel value: %', NEW.sales_channel
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_orders_sales_channel ON public.orders;
CREATE TRIGGER trg_validate_orders_sales_channel
BEFORE INSERT OR UPDATE OF sales_channel ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.validate_orders_sales_channel();

-- 2) Coluna ai_conversation_id em orders (rastreabilidade)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ai_conversation_id uuid;

-- 3) Index para filtros rápidos por canal
CREATE INDEX IF NOT EXISTS idx_orders_tenant_sales_channel_created
  ON public.orders (tenant_id, sales_channel, created_at DESC);

-- 4) Frente 8 (preparação): greeting_style em ai_support_config
ALTER TABLE public.ai_support_config
  ADD COLUMN IF NOT EXISTS greeting_style text NOT NULL DEFAULT 'formal';

-- Validação por trigger (mesmo padrão acima)
CREATE OR REPLACE FUNCTION public.validate_ai_support_config_greeting_style()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.greeting_style IS NULL THEN
    NEW.greeting_style := 'formal';
  END IF;
  IF NEW.greeting_style NOT IN ('formal','mirror_informal') THEN
    RAISE EXCEPTION 'Invalid greeting_style value: %', NEW.greeting_style
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_ai_support_config_greeting_style ON public.ai_support_config;
CREATE TRIGGER trg_validate_ai_support_config_greeting_style
BEFORE INSERT OR UPDATE OF greeting_style ON public.ai_support_config
FOR EACH ROW EXECUTE FUNCTION public.validate_ai_support_config_greeting_style();

-- 5) Atualizar trigger link_whatsapp_cart_to_order para também
--    setar sales_channel + ai_conversation_id em orders
--    e gravar order_attribution com fonte "IA de Atendimento".
--
-- Estratégia: criar um novo trigger AFTER UPDATE em whatsapp_carts que dispara
-- quando order_id é setado, sem mexer no trigger existente (que pode ser
-- responsabilidade de outra função). Isso evita acoplamento.

CREATE OR REPLACE FUNCTION public.mark_order_as_ai_sale_on_cart_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Só age quando order_id passou de NULL para um valor
  IF NEW.order_id IS NULL OR (OLD.order_id IS NOT NULL AND OLD.order_id = NEW.order_id) THEN
    RETURN NEW;
  END IF;

  -- Pega tenant_id do pedido
  SELECT tenant_id INTO v_tenant_id FROM public.orders WHERE id = NEW.order_id;
  IF v_tenant_id IS NULL THEN
    RETURN NEW; -- pedido não encontrado, não faz nada
  END IF;

  -- Marca o pedido como venda IA (não sobrescreve se já é marketplace/link/manual)
  UPDATE public.orders
     SET sales_channel = 'ai_attendant',
         ai_conversation_id = NEW.conversation_id
   WHERE id = NEW.order_id
     AND sales_channel IN ('storefront');

  -- Grava/atualiza order_attribution com categoria "IA de Atendimento"
  INSERT INTO public.order_attribution (
    tenant_id, order_id, attribution_source, attribution_medium, first_touch_at, created_at, updated_at
  ) VALUES (
    v_tenant_id, NEW.order_id, 'ai_atendimento', 'whatsapp', now(), now(), now()
  )
  ON CONFLICT (order_id) DO UPDATE
    SET attribution_source = 'ai_atendimento',
        attribution_medium = 'whatsapp',
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_order_as_ai_sale ON public.whatsapp_carts;
CREATE TRIGGER trg_mark_order_as_ai_sale
AFTER UPDATE OF order_id ON public.whatsapp_carts
FOR EACH ROW
EXECUTE FUNCTION public.mark_order_as_ai_sale_on_cart_link();

-- 6) Comentários para documentação
COMMENT ON COLUMN public.orders.sales_channel IS 'Canal de venda: storefront | ai_attendant | marketplace | link_checkout | manual | import';
COMMENT ON COLUMN public.orders.ai_conversation_id IS 'ID da conversa da IA de atendimento que originou esta venda (quando sales_channel=ai_attendant)';
COMMENT ON COLUMN public.ai_support_config.greeting_style IS 'Estilo de saudação da IA: formal (padrão) | mirror_informal (espelha o que o cliente disse)';