-- Create table for global storefront layout (Header/Footer)
CREATE TABLE public.storefront_global_layout (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  header_config JSONB NOT NULL DEFAULT '{}',
  footer_config JSONB NOT NULL DEFAULT '{}',
  checkout_header_config JSONB NOT NULL DEFAULT '{}',
  checkout_footer_config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT storefront_global_layout_tenant_unique UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.storefront_global_layout ENABLE ROW LEVEL SECURITY;

-- Admins can manage global layout
CREATE POLICY "Admins can manage global layout"
ON public.storefront_global_layout
FOR ALL
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR 
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

-- Anyone can view global layout of published stores
CREATE POLICY "Anyone can view global layout of published stores"
ON public.storefront_global_layout
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM store_settings ss
    WHERE ss.tenant_id = storefront_global_layout.tenant_id
    AND ss.is_published = true
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_storefront_global_layout_updated_at
BEFORE UPDATE ON public.storefront_global_layout
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add page_type column to store_pages for landing pages distinction
-- (type already exists, we just need to ensure landing_page is a valid type)
COMMENT ON COLUMN public.store_pages.type IS 'Page type: institutional, landing_page';