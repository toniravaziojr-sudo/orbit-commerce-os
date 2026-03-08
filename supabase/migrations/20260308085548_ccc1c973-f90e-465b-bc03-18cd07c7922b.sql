
-- Step 1: Add meta_retailer_id column and create tombstone table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS meta_retailer_id TEXT;

CREATE TABLE IF NOT EXISTS public.meta_retired_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  retired_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'meta',
  reason TEXT,
  retired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, retired_id, channel)
);

ALTER TABLE public.meta_retired_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage retired IDs"
  ON public.meta_retired_ids
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), tenant_id, 'owner'::app_role)
    OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role(auth.uid(), tenant_id, 'operator'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), tenant_id, 'owner'::app_role)
    OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
    OR has_role(auth.uid(), tenant_id, 'operator'::app_role)
  );
