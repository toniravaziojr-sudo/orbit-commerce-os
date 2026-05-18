-- Adiciona campo "Serviço contratado" da transportadora ao Pedido de Venda / NF.
-- Vem do checkout (orders.shipping_service_name) e fica exibido na aba Transp.
ALTER TABLE public.fiscal_invoices
  ADD COLUMN IF NOT EXISTS transportadora_servico text;

COMMENT ON COLUMN public.fiscal_invoices.transportadora_servico
  IS 'Serviço contratado dentro da transportadora (ex: PAC, SEDEX, Mini Envios, Loggi Express). Herdado de orders.shipping_service_name.';

-- Backfill: preenche o serviço a partir do pedido para Pedidos de Venda já existentes.
UPDATE public.fiscal_invoices fi
SET transportadora_servico = COALESCE(o.shipping_service_name, o.shipping_method_name)
FROM public.orders o
WHERE fi.order_id = o.id
  AND fi.transportadora_servico IS NULL
  AND COALESCE(o.shipping_service_name, o.shipping_method_name) IS NOT NULL;