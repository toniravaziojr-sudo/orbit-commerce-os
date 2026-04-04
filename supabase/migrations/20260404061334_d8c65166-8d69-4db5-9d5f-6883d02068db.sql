
-- 1. Add is_system column to email_marketing_lists
ALTER TABLE public.email_marketing_lists
ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- 2. Update the function to use is_system (already created in previous migration, just replace)
CREATE OR REPLACE FUNCTION public.ensure_default_email_marketing_lists(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tag_id UUID;
  v_defaults JSONB := '[
    {"tag_name": "Cliente",            "tag_color": "#10B981", "tag_desc": "Clientes com pedido aprovado",            "list_name": "Clientes"},
    {"tag_name": "Newsletter PopUp",   "tag_color": "#06b6d4", "tag_desc": "Leads capturados via popup newsletter",   "list_name": "Newsletter PopUp"},
    {"tag_name": "Cliente Potencial",  "tag_color": "#f97316", "tag_desc": "Clientes que abandonaram o checkout",     "list_name": "Clientes Potenciais"}
  ]';
  v_item JSONB;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_defaults)
  LOOP
    INSERT INTO public.customer_tags (tenant_id, name, color, description)
    VALUES (p_tenant_id, v_item->>'tag_name', v_item->>'tag_color', v_item->>'tag_desc')
    ON CONFLICT (tenant_id, name) DO NOTHING;

    SELECT id INTO v_tag_id
    FROM public.customer_tags
    WHERE tenant_id = p_tenant_id AND name = v_item->>'tag_name';

    IF v_tag_id IS NOT NULL THEN
      INSERT INTO public.email_marketing_lists (tenant_id, name, tag_id, is_system)
      VALUES (p_tenant_id, v_item->>'list_name', v_tag_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- 3. Rename legacy "PoupUp" tag and list
UPDATE public.customer_tags
SET name = 'Newsletter PopUp', color = '#06b6d4', description = 'Leads capturados via popup newsletter'
WHERE name = 'PoupUp'
  AND NOT EXISTS (
    SELECT 1 FROM public.customer_tags ct2
    WHERE ct2.tenant_id = customer_tags.tenant_id AND ct2.name = 'Newsletter PopUp'
  );

UPDATE public.email_marketing_lists
SET name = 'Newsletter PopUp', is_system = true
WHERE name = 'PoupUp';

-- 4. Run retroactively for all existing tenants
DO $$
DECLARE
  t_id UUID;
BEGIN
  FOR t_id IN SELECT id FROM public.tenants
  LOOP
    PERFORM public.ensure_default_email_marketing_lists(t_id);
  END LOOP;
END;
$$;
