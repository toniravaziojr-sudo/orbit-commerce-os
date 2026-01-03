-- Adicionar campos de automação de remessa em fiscal_settings
ALTER TABLE public.fiscal_settings 
ADD COLUMN IF NOT EXISTS auto_create_shipment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_update_order_status BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS default_shipping_provider TEXT;

-- Comentários explicativos
COMMENT ON COLUMN public.fiscal_settings.auto_create_shipment IS 'Criar remessa automaticamente na transportadora após NF-e autorizada';
COMMENT ON COLUMN public.fiscal_settings.auto_update_order_status IS 'Atualizar status do pedido para Enviado após criar remessa';
COMMENT ON COLUMN public.fiscal_settings.default_shipping_provider IS 'Transportadora padrão: correios, loggi, frenet';