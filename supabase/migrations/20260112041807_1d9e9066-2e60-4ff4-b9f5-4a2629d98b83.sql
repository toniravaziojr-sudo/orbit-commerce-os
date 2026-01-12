
-- ============================================================================
-- CONSOLIDAÇÃO CANÔNICA: Products, Customers, Orders
-- Objetivo: Fonte de verdade para importador, marketplaces, automações, fiscal
-- ============================================================================

-- ============================================================================
-- PARTE A: CAMADA CANÔNICA DE IDENTIDADE EXTERNA
-- ============================================================================

-- Tabela para mapeamento de entidades internas ↔ ids externos por plataforma/origem
CREATE TABLE IF NOT EXISTS public.external_entity_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    entity_type text NOT NULL, -- product, variant, customer, order, category, image, etc
    internal_id uuid NOT NULL,
    source_platform text NOT NULL, -- shopify, tray, nuvemshop, bling, manual, etc
    external_id text NOT NULL,
    external_parent_id text, -- ex.: variant → external product id
    raw jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    
    -- Constraint para garantir unicidade por tenant/entidade/plataforma/id externo
    CONSTRAINT external_entity_mappings_unique UNIQUE (tenant_id, entity_type, source_platform, external_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_external_entity_mappings_internal 
    ON public.external_entity_mappings(tenant_id, entity_type, internal_id);
CREATE INDEX IF NOT EXISTS idx_external_entity_mappings_platform 
    ON public.external_entity_mappings(tenant_id, source_platform);

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER update_external_entity_mappings_updated_at
    BEFORE UPDATE ON public.external_entity_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.external_entity_mappings ENABLE ROW LEVEL SECURITY;

-- Policy para membros do tenant
CREATE POLICY "Tenant members can manage their mappings"
    ON public.external_entity_mappings
    FOR ALL
    USING (public.user_belongs_to_tenant(auth.uid(), tenant_id))
    WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Policy para platform admins (função sem argumento)
CREATE POLICY "Platform admins have full access to mappings"
    ON public.external_entity_mappings
    FOR ALL
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

-- ============================================================================
-- PARTE B: COMPLETAR SCHEMA PRODUCTS
-- ============================================================================

-- Adicionar campos em products (todos nullable/default para compatibilidade)
ALTER TABLE public.products 
    ADD COLUMN IF NOT EXISTS brand text,
    ADD COLUMN IF NOT EXISTS vendor text,
    ADD COLUMN IF NOT EXISTS product_type text,
    ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS requires_shipping boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS taxable boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS tax_code text,
    ADD COLUMN IF NOT EXISTS cest text,
    ADD COLUMN IF NOT EXISTS origin_code text, -- origem fiscal (0-8)
    ADD COLUMN IF NOT EXISTS uom text DEFAULT 'UN', -- unidade de medida
    ADD COLUMN IF NOT EXISTS meta_keywords text,
    ADD COLUMN IF NOT EXISTS published_at timestamptz,
    ADD COLUMN IF NOT EXISTS external_reference text; -- compat legado

-- Índices úteis para products
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(tenant_id, brand) WHERE brand IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_vendor ON public.products(tenant_id, vendor) WHERE vendor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_tags ON public.products USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_products_published ON public.products(tenant_id, published_at) WHERE published_at IS NOT NULL;

-- Completar product_variants
ALTER TABLE public.product_variants
    ADD COLUMN IF NOT EXISTS width numeric,
    ADD COLUMN IF NOT EXISTS height numeric,
    ADD COLUMN IF NOT EXISTS depth numeric,
    ADD COLUMN IF NOT EXISTS taxable boolean,
    ADD COLUMN IF NOT EXISTS requires_shipping boolean,
    ADD COLUMN IF NOT EXISTS position integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS image_url text;

-- Adicionar file_id em product_images para integração com Meu Drive
ALTER TABLE public.product_images
    ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Índice para product_images por tenant
CREATE INDEX IF NOT EXISTS idx_product_images_tenant ON public.product_images(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_product_images_file ON public.product_images(file_id) WHERE file_id IS NOT NULL;

-- ============================================================================
-- PARTE C: COMPLETAR SCHEMA CUSTOMERS (Brasil PF/PJ + Marketing)
-- ============================================================================

ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS person_type text CHECK (person_type IN ('pf', 'pj')),
    ADD COLUMN IF NOT EXISTS cnpj text,
    ADD COLUMN IF NOT EXISTS company_name text, -- razão social
    ADD COLUMN IF NOT EXISTS ie text, -- inscrição estadual
    ADD COLUMN IF NOT EXISTS rg text,
    ADD COLUMN IF NOT EXISTS state_registration_is_exempt boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS accepts_email_marketing boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS accepts_sms_marketing boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS accepts_whatsapp_marketing boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz,
    ADD COLUMN IF NOT EXISTS bounced_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_source_platform text,
    ADD COLUMN IF NOT EXISTS last_external_id text,
    ADD COLUMN IF NOT EXISTS notes text; -- notas gerais do cliente

-- Índices úteis para customers
CREATE INDEX IF NOT EXISTS idx_customers_person_type ON public.customers(tenant_id, person_type) WHERE person_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_cnpj ON public.customers(tenant_id, cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_last_source ON public.customers(tenant_id, last_source_platform) WHERE last_source_platform IS NOT NULL;

-- Completar customer_addresses para Brasil
ALTER TABLE public.customer_addresses
    ADD COLUMN IF NOT EXISTS recipient_cpf text,
    ADD COLUMN IF NOT EXISTS recipient_phone text,
    ADD COLUMN IF NOT EXISTS ibge_code text, -- código IBGE do município
    ADD COLUMN IF NOT EXISTS address_type text DEFAULT 'residential' CHECK (address_type IN ('residential', 'commercial', 'other'));

-- ============================================================================
-- PARTE D: COMPLETAR SCHEMA ORDERS (Snapshot + Reconciliação)
-- ============================================================================

-- Os campos customer_name, customer_email, customer_phone já existem em orders (verificado)
-- Adicionar campos de reconciliação e moeda

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS currency text DEFAULT 'BRL',
    ADD COLUMN IF NOT EXISTS fx_rate numeric,
    ADD COLUMN IF NOT EXISTS shipping_method_name text,
    ADD COLUMN IF NOT EXISTS shipping_method_code text,
    ADD COLUMN IF NOT EXISTS tracking_url text,
    ADD COLUMN IF NOT EXISTS gateway_payload jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS source_hash text, -- para dedupe quando não há source_order_number
    ADD COLUMN IF NOT EXISTS customer_cpf text, -- snapshot do CPF
    ADD COLUMN IF NOT EXISTS installments integer, -- número de parcelas
    ADD COLUMN IF NOT EXISTS installment_value numeric, -- valor da parcela
    ADD COLUMN IF NOT EXISTS internal_notes text, -- notas internas do pedido
    ADD COLUMN IF NOT EXISTS customer_notes text; -- notas do cliente no pedido

-- Índice para dedupe por origem (parcial, quando source_order_number não é nulo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_source_unique 
    ON public.orders(tenant_id, source_platform, source_order_number) 
    WHERE source_order_number IS NOT NULL AND source_platform IS NOT NULL;

-- Índice para tracking
CREATE INDEX IF NOT EXISTS idx_orders_tracking ON public.orders(tenant_id, tracking_code) WHERE tracking_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_currency ON public.orders(tenant_id, currency);

-- Completar order_items com snapshot completo
ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS product_slug text,
    ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS variant_name text,
    ADD COLUMN IF NOT EXISTS image_file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS weight numeric,
    ADD COLUMN IF NOT EXISTS tax_amount numeric DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cost_price numeric, -- custo no momento da venda
    ADD COLUMN IF NOT EXISTS barcode text,
    ADD COLUMN IF NOT EXISTS ncm text,
    ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Índice para order_items por tenant
CREATE INDEX IF NOT EXISTS idx_order_items_tenant ON public.order_items(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_variant ON public.order_items(variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id) WHERE product_id IS NOT NULL;

-- ============================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE public.external_entity_mappings IS 'Mapeamento canônico de entidades internas para IDs externos por plataforma (Shopify, Tray, etc). Permite updates confiáveis sem match frágil.';
COMMENT ON COLUMN public.external_entity_mappings.entity_type IS 'Tipo: product, variant, customer, order, category, image';
COMMENT ON COLUMN public.external_entity_mappings.source_platform IS 'Origem: shopify, tray, nuvemshop, bling, mercadolivre, manual, etc';
COMMENT ON COLUMN public.external_entity_mappings.external_parent_id IS 'Para variantes: ID externo do produto pai';

COMMENT ON COLUMN public.products.brand IS 'Marca do produto';
COMMENT ON COLUMN public.products.vendor IS 'Fornecedor/fabricante';
COMMENT ON COLUMN public.products.origin_code IS 'Origem fiscal: 0=Nacional, 1-8=Importado';
COMMENT ON COLUMN public.products.cest IS 'Código CEST para substituição tributária';
COMMENT ON COLUMN public.products.uom IS 'Unidade de medida: UN, KG, M, etc';

COMMENT ON COLUMN public.customers.person_type IS 'Tipo de pessoa: pf (física) ou pj (jurídica)';
COMMENT ON COLUMN public.customers.company_name IS 'Razão social para PJ';
COMMENT ON COLUMN public.customers.ie IS 'Inscrição estadual para PJ';

COMMENT ON COLUMN public.orders.currency IS 'Moeda do pedido (ISO 4217)';
COMMENT ON COLUMN public.orders.fx_rate IS 'Taxa de câmbio para pedidos em moeda estrangeira';
COMMENT ON COLUMN public.orders.source_hash IS 'Hash para dedupe quando source_order_number não existe';
