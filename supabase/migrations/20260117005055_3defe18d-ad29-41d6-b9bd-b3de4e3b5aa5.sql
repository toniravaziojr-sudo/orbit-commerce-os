-- Create table for product variant types (e.g., "Cor", "Tamanho")
CREATE TABLE public.product_variant_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Create table for variant type options (e.g., "Azul", "Verde" for "Cor")
CREATE TABLE public.product_variant_type_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  variant_type_id UUID NOT NULL REFERENCES public.product_variant_types(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(variant_type_id, value)
);

-- Enable RLS
ALTER TABLE public.product_variant_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variant_type_options ENABLE ROW LEVEL SECURITY;

-- RLS policies for product_variant_types
CREATE POLICY "Users can view their tenant's variant types"
ON public.product_variant_types
FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can create variant types for their tenant"
ON public.product_variant_types
FOR INSERT
WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update their tenant's variant types"
ON public.product_variant_types
FOR UPDATE
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can delete their tenant's variant types"
ON public.product_variant_types
FOR DELETE
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- RLS policies for product_variant_type_options
CREATE POLICY "Users can view their tenant's variant type options"
ON public.product_variant_type_options
FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can create variant type options for their tenant"
ON public.product_variant_type_options
FOR INSERT
WITH CHECK (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can update their tenant's variant type options"
ON public.product_variant_type_options
FOR UPDATE
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Users can delete their tenant's variant type options"
ON public.product_variant_type_options
FOR DELETE
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

-- Create trigger for updated_at on product_variant_types
CREATE TRIGGER update_product_variant_types_updated_at
BEFORE UPDATE ON public.product_variant_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();