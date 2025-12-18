-- Add recovery_status column to checkouts table
ALTER TABLE public.checkouts 
ADD COLUMN IF NOT EXISTS recovery_status text NOT NULL DEFAULT 'not_recovered';

-- Add items_snapshot for storing cart items at checkout time
ALTER TABLE public.checkouts 
ADD COLUMN IF NOT EXISTS items_snapshot jsonb DEFAULT '[]'::jsonb;

-- Create index for efficient filtering
CREATE INDEX IF NOT EXISTS idx_checkouts_tenant_status ON public.checkouts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_checkouts_tenant_recovery ON public.checkouts(tenant_id, recovery_status);
CREATE INDEX IF NOT EXISTS idx_checkouts_abandoned_at ON public.checkouts(abandoned_at);

-- Add policy for viewing checkouts (admin only)
CREATE POLICY "Users can view checkouts of their tenants" 
ON public.checkouts 
FOR SELECT 
USING (user_belongs_to_tenant(auth.uid(), tenant_id));