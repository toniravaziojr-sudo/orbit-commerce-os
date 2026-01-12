-- =============================================
-- CORE AUDIT LOG: Unified audit table for Core modules
-- Tracks all changes to products, customers, orders
-- =============================================

-- Create core_audit_log table
CREATE TABLE IF NOT EXISTS public.core_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'product', 'customer', 'order'
  entity_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'set_order_status', etc.
  before_json JSONB,
  after_json JSONB NOT NULL,
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  actor_user_id UUID,
  source TEXT NOT NULL DEFAULT 'unknown', -- 'core-orders', 'core-customers', 'core-products', 'import', etc.
  correlation_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_core_audit_log_tenant_id ON public.core_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_core_audit_log_entity ON public.core_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_core_audit_log_created_at ON public.core_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_core_audit_log_correlation ON public.core_audit_log(correlation_id) WHERE correlation_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.core_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only tenant members can view audit logs
CREATE POLICY "Tenant members can view audit logs"
ON public.core_audit_log
FOR SELECT
USING (
  public.user_belongs_to_tenant(auth.uid(), tenant_id)
  OR public.is_platform_admin()
);

-- Only service role can insert (via Edge Functions)
CREATE POLICY "Service role can insert audit logs"
ON public.core_audit_log
FOR INSERT
WITH CHECK (true);

-- Add payment_link fields to orders if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_link_url') THEN
    ALTER TABLE public.orders ADD COLUMN payment_link_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_link_expires_at') THEN
    ALTER TABLE public.orders ADD COLUMN payment_link_expires_at TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_cnpj') THEN
    ALTER TABLE public.orders ADD COLUMN customer_cnpj TEXT;
  END IF;
END $$;

-- Add deleted_at to customers and products for soft delete
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.customers ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'deleted_at') THEN
    ALTER TABLE public.products ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Create index for soft delete filtering
CREATE INDEX IF NOT EXISTS idx_customers_deleted ON public.customers(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_deleted ON public.products(deleted_at) WHERE deleted_at IS NULL;