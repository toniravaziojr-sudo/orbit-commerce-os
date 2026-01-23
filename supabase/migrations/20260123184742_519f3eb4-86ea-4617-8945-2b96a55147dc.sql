-- Corrigir função de sync para usar INSERT direto em batch
CREATE OR REPLACE FUNCTION public.sync_list_subscribers_from_tag(p_list_id UUID)
RETURNS JSON AS $$
DECLARE
  v_tag_id UUID;
  v_tenant_id UUID;
  v_inserted INT := 0;
BEGIN
  -- Buscar dados da lista
  SELECT tag_id, tenant_id INTO v_tag_id, v_tenant_id
  FROM email_marketing_lists
  WHERE id = p_list_id;
  
  IF v_tag_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Lista não encontrada ou sem tag');
  END IF;
  
  -- Inserir todos de uma vez com ON CONFLICT
  INSERT INTO email_marketing_subscribers (
    tenant_id, email, name, phone, status, source, customer_id, created_from
  )
  SELECT 
    v_tenant_id,
    LOWER(TRIM(c.email)),
    c.full_name,
    c.phone,
    'active',
    'tag_sync:' || p_list_id::text,
    c.id,
    'tag_sync'
  FROM customers c
  INNER JOIN customer_tag_assignments cta ON cta.customer_id = c.id
  WHERE cta.tag_id = v_tag_id
    AND c.tenant_id = v_tenant_id
    AND c.deleted_at IS NULL
    AND c.email IS NOT NULL
    AND TRIM(c.email) <> ''
  ON CONFLICT (tenant_id, email) DO UPDATE SET
    customer_id = COALESCE(email_marketing_subscribers.customer_id, EXCLUDED.customer_id),
    name = COALESCE(email_marketing_subscribers.name, EXCLUDED.name),
    phone = COALESCE(email_marketing_subscribers.phone, EXCLUDED.phone),
    updated_at = now();
  
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'synced', v_inserted
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;