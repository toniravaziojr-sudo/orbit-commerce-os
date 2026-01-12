-- Primeiro, atualiza o CHECK constraint para incluir todos os tipos de página
ALTER TABLE public.storefront_page_templates 
DROP CONSTRAINT storefront_page_templates_page_type_check;

ALTER TABLE public.storefront_page_templates 
ADD CONSTRAINT storefront_page_templates_page_type_check 
CHECK (page_type = ANY (ARRAY['home', 'category', 'product', 'cart', 'checkout', 'thank_you', 'account', 'account_orders', 'account_order_detail', 'institutional', 'blog', 'tracking']));

-- Recriar a função com os tipos corretos
CREATE OR REPLACE FUNCTION public.initialize_storefront_templates(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_page_types text[] := ARRAY['home', 'category', 'product', 'cart', 'checkout', 'thank_you', 'account', 'account_orders', 'account_order_detail', 'institutional', 'blog', 'tracking'];
  v_type text;
BEGIN
  FOREACH v_type IN ARRAY v_page_types
  LOOP
    INSERT INTO public.storefront_page_templates (tenant_id, page_type)
    VALUES (p_tenant_id, v_type)
    ON CONFLICT (tenant_id, page_type) DO NOTHING;
  END LOOP;
END;
$function$;