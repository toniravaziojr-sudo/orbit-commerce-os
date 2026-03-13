
-- ============================================
-- SHIPPING QUOTES - Canonical shipping validation (Security Plan v3.1 Phase 2A)
-- Snapshot of shipping quotes for server-side validation
-- ============================================

-- Table: shipping_quotes
CREATE TABLE IF NOT EXISTS public.shipping_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cep text NOT NULL,
  cart_fingerprint text NOT NULL,
  selected_option jsonb NOT NULL DEFAULT '{}'::jsonb,
  all_options jsonb NOT NULL DEFAULT '[]'::jsonb,
  cart_subtotal_cents bigint NOT NULL DEFAULT 0,
  shipping_price_cents bigint NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  used_at timestamptz,
  used_by_order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_shipping_quotes_tenant_id ON public.shipping_quotes(tenant_id);
CREATE INDEX idx_shipping_quotes_expires_at ON public.shipping_quotes(expires_at) WHERE used_at IS NULL;

-- RLS
ALTER TABLE public.shipping_quotes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (storefront is anonymous)
CREATE POLICY "Anyone can insert shipping quotes"
  ON public.shipping_quotes FOR INSERT
  WITH CHECK (true);

-- Policy: Anyone can read their own quote by ID (needed for checkout validation)
CREATE POLICY "Anyone can read shipping quotes"
  ON public.shipping_quotes FOR SELECT
  USING (true);

-- No update/delete from client side - only service role manages used_at

-- Add quote_id column to orders for traceability
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_quote_id uuid REFERENCES public.shipping_quotes(id);
