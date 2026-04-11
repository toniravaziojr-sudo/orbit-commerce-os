
-- Table to map which gateway handles each transparent payment method
CREATE TABLE public.payment_method_gateway_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit_card', 'boleto')),
  provider TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, payment_method)
);

-- Enable RLS
ALTER TABLE public.payment_method_gateway_map ENABLE ROW LEVEL SECURITY;

-- Admin/owner can manage
CREATE POLICY "Admins can manage gateway map"
ON public.payment_method_gateway_map FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) 
  OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) 
  OR has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

-- Public read for enabled entries (checkout needs this)
CREATE POLICY "Anyone can read enabled gateway map"
ON public.payment_method_gateway_map FOR SELECT
USING (is_enabled = true);

-- Add mp_redirect_enabled to payment_providers
ALTER TABLE public.payment_providers 
ADD COLUMN IF NOT EXISTS mp_redirect_enabled BOOLEAN NOT NULL DEFAULT false;

-- Updated_at trigger
CREATE TRIGGER update_payment_method_gateway_map_updated_at
BEFORE UPDATE ON public.payment_method_gateway_map
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
