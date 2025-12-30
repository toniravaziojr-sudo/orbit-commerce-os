-- Create page_templates table for Shopify-like page templates
CREATE TABLE public.page_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  content JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_page_template_slug UNIQUE (tenant_id, slug)
);

-- Add template_id column to store_pages to link pages to templates
ALTER TABLE public.store_pages 
ADD COLUMN template_id UUID REFERENCES public.page_templates(id) ON DELETE SET NULL;

-- Add individual_content column to store_pages for the page-specific text content
ALTER TABLE public.store_pages 
ADD COLUMN individual_content TEXT;

-- Enable RLS
ALTER TABLE public.page_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for page_templates (using user_roles table)
CREATE POLICY "Users can view templates of their tenant" 
ON public.page_templates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.tenant_id = page_templates.tenant_id 
    AND ur.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create templates for their tenant" 
ON public.page_templates 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.tenant_id = page_templates.tenant_id 
    AND ur.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update templates of their tenant" 
ON public.page_templates 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.tenant_id = page_templates.tenant_id 
    AND ur.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete non-system templates of their tenant" 
ON public.page_templates 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.tenant_id = page_templates.tenant_id 
    AND ur.user_id = auth.uid()
  ) 
  AND is_system = false
);

-- Create trigger to update updated_at
CREATE TRIGGER update_page_templates_updated_at
BEFORE UPDATE ON public.page_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_page_templates_tenant_id ON public.page_templates(tenant_id);
CREATE INDEX idx_store_pages_template_id ON public.store_pages(template_id);

-- Create function to initialize default page template for a tenant
CREATE OR REPLACE FUNCTION public.initialize_default_page_template(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_id uuid;
BEGIN
  -- Check if default template already exists
  SELECT id INTO v_template_id
  FROM public.page_templates
  WHERE tenant_id = p_tenant_id AND is_default = true
  LIMIT 1;
  
  -- If no default template exists, create one
  IF v_template_id IS NULL THEN
    INSERT INTO public.page_templates (
      tenant_id, 
      name, 
      slug, 
      description, 
      content,
      is_default,
      is_system
    ) VALUES (
      p_tenant_id,
      'Modelo Padrão',
      'padrao',
      'Template padrão para páginas institucionais com Header, área de conteúdo e Footer.',
      '{"id":"root","type":"Page","props":{},"children":[{"id":"header-slot","type":"Header","props":{"menuId":"","showSearch":true,"showCart":true,"sticky":true}},{"id":"content-slot","type":"Section","props":{"padding":"lg"},"children":[{"id":"content-container","type":"Container","props":{"maxWidth":"md","centered":true},"children":[{"id":"page-content","type":"PageContent","props":{}}]}]},{"id":"footer-slot","type":"Footer","props":{"menuId":"","showSocial":true}}]}'::jsonb,
      true,
      true
    ) RETURNING id INTO v_template_id;
  END IF;
  
  RETURN v_template_id;
END;
$$;