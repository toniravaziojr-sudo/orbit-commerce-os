-- Add 'institutional' to the list of page types in initialize_storefront_templates
CREATE OR REPLACE FUNCTION public.initialize_storefront_templates(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page_types text[] := ARRAY['home', 'category', 'product', 'cart', 'checkout', 'thank_you', 'account', 'account_orders', 'account_order_detail', 'institutional'];
  v_type text;
BEGIN
  FOREACH v_type IN ARRAY v_page_types
  LOOP
    INSERT INTO public.storefront_page_templates (tenant_id, page_type)
    VALUES (p_tenant_id, v_type)
    ON CONFLICT (tenant_id, page_type) DO NOTHING;
  END LOOP;
END;
$$;