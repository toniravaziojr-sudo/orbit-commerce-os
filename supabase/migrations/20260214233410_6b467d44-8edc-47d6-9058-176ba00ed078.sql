
-- ====================================================
-- Fase 3: Google Merchant Center — Cache de produtos
-- ====================================================

-- Tabela para cache do status de sincronização com Google Merchant Center
CREATE TABLE public.google_merchant_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_account_id TEXT NOT NULL,
  
  -- Dados do Merchant Center
  merchant_product_id TEXT,          -- ID no Merchant Center (após envio)
  channel TEXT DEFAULT 'online',     -- 'online' ou 'local'
  content_language TEXT DEFAULT 'pt',
  target_country TEXT DEFAULT 'BR',
  
  -- Status de sincronização
  sync_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'synced', 'error', 'disapproved', 'pending_review'
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  disapproval_reasons JSONB,        -- Array de motivos de reprovação do Google
  
  -- Snapshot do que foi enviado (para detectar mudanças)
  synced_data_hash TEXT,             -- Hash do payload enviado
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraint: 1 produto por merchant account
  CONSTRAINT uq_merchant_product UNIQUE (tenant_id, product_id, merchant_account_id)
);

-- Índices
CREATE INDEX idx_gmp_tenant ON public.google_merchant_products(tenant_id);
CREATE INDEX idx_gmp_status ON public.google_merchant_products(tenant_id, sync_status);
CREATE INDEX idx_gmp_product ON public.google_merchant_products(product_id);

-- RLS
ALTER TABLE public.google_merchant_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can view merchant products"
  ON public.google_merchant_products FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can insert merchant products"
  ON public.google_merchant_products FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can update merchant products"
  ON public.google_merchant_products FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can delete merchant products"
  ON public.google_merchant_products FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

-- Trigger updated_at
CREATE TRIGGER update_google_merchant_products_updated_at
  BEFORE UPDATE ON public.google_merchant_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
