-- Adicionar campo marketplace_data para armazenar dados extras do marketplace (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'marketplace_data') 
  THEN
    ALTER TABLE public.orders ADD COLUMN marketplace_data JSONB;
  END IF;
END $$;

-- Criar índice para consultas por marketplace_source
CREATE INDEX IF NOT EXISTS idx_orders_marketplace_source ON public.orders(marketplace_source) WHERE marketplace_source IS NOT NULL;

-- Criar índice para consultas por tenant + marketplace
CREATE INDEX IF NOT EXISTS idx_orders_tenant_marketplace ON public.orders(tenant_id, marketplace_source) WHERE marketplace_source IS NOT NULL;