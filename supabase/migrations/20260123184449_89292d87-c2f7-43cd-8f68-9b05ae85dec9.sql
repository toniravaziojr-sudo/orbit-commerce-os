-- ============================================
-- Tornar tag_id obrigatório em email_marketing_lists
-- E criar função para sincronizar subscribers automaticamente
-- ============================================

-- 1. Alterar coluna tag_id para NOT NULL (primeiro limpar dados órfãos)
-- Remover listas sem tag_id
DELETE FROM email_marketing_lists WHERE tag_id IS NULL;

-- Alterar para NOT NULL
ALTER TABLE email_marketing_lists 
ALTER COLUMN tag_id SET NOT NULL;

-- 2. Adicionar FK se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'email_marketing_lists_tag_id_fkey'
  ) THEN
    ALTER TABLE email_marketing_lists 
    ADD CONSTRAINT email_marketing_lists_tag_id_fkey 
    FOREIGN KEY (tag_id) REFERENCES customer_tags(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Função para sincronizar subscribers de uma lista baseado na tag
CREATE OR REPLACE FUNCTION public.sync_list_subscribers_from_tag(p_list_id UUID)
RETURNS JSON AS $$
DECLARE
  v_tag_id UUID;
  v_tenant_id UUID;
  v_inserted INT := 0;
  v_skipped INT := 0;
  v_customer RECORD;
BEGIN
  -- Buscar dados da lista
  SELECT tag_id, tenant_id INTO v_tag_id, v_tenant_id
  FROM email_marketing_lists
  WHERE id = p_list_id;
  
  IF v_tag_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Lista não encontrada ou sem tag');
  END IF;
  
  -- Para cada customer com a tag
  FOR v_customer IN 
    SELECT c.id, c.email, c.full_name, c.phone
    FROM customers c
    INNER JOIN customer_tag_assignments cta ON cta.customer_id = c.id
    WHERE cta.tag_id = v_tag_id
      AND c.tenant_id = v_tenant_id
      AND c.deleted_at IS NULL
      AND c.email IS NOT NULL
      AND c.email <> ''
  LOOP
    -- Tentar inserir como subscriber
    BEGIN
      INSERT INTO email_marketing_subscribers (
        tenant_id, email, name, phone, status, source, customer_id, created_from
      ) VALUES (
        v_tenant_id,
        LOWER(TRIM(v_customer.email)),
        v_customer.full_name,
        v_customer.phone,
        'active',
        'tag_sync:' || p_list_id::text,
        v_customer.id,
        'tag_sync'
      )
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        customer_id = COALESCE(email_marketing_subscribers.customer_id, v_customer.id),
        name = COALESCE(email_marketing_subscribers.name, v_customer.full_name),
        phone = COALESCE(email_marketing_subscribers.phone, v_customer.phone),
        updated_at = now();
      
      v_inserted := v_inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'inserted', v_inserted,
    'skipped', v_skipped
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Trigger para auto-sync quando uma lista é criada
CREATE OR REPLACE FUNCTION public.auto_sync_list_on_create()
RETURNS TRIGGER AS $$
BEGIN
  -- Sincronizar subscribers da tag automaticamente
  PERFORM sync_list_subscribers_from_tag(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auto_sync_list_subscribers ON email_marketing_lists;
CREATE TRIGGER trg_auto_sync_list_subscribers
  AFTER INSERT ON email_marketing_lists
  FOR EACH ROW
  EXECUTE FUNCTION auto_sync_list_on_create();

-- 5. Trigger para sincronizar subscriber quando cliente recebe uma tag
CREATE OR REPLACE FUNCTION public.sync_subscriber_on_tag_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_customer RECORD;
  v_list RECORD;
BEGIN
  -- Buscar dados do customer
  SELECT id, tenant_id, email, full_name, phone INTO v_customer
  FROM customers
  WHERE id = NEW.customer_id AND deleted_at IS NULL;
  
  IF v_customer.email IS NULL OR v_customer.email = '' THEN
    RETURN NEW;
  END IF;
  
  -- Para cada lista vinculada a esta tag, garantir que o customer é subscriber
  FOR v_list IN 
    SELECT id FROM email_marketing_lists WHERE tag_id = NEW.tag_id
  LOOP
    INSERT INTO email_marketing_subscribers (
      tenant_id, email, name, phone, status, source, customer_id, created_from
    ) VALUES (
      v_customer.tenant_id,
      LOWER(TRIM(v_customer.email)),
      v_customer.full_name,
      v_customer.phone,
      'active',
      'tag_assignment',
      v_customer.id,
      'tag_assignment'
    )
    ON CONFLICT (tenant_id, email) DO UPDATE SET
      customer_id = COALESCE(email_marketing_subscribers.customer_id, v_customer.id),
      status = 'active',
      updated_at = now();
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_subscriber_on_tag ON customer_tag_assignments;
CREATE TRIGGER trg_sync_subscriber_on_tag
  AFTER INSERT ON customer_tag_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscriber_on_tag_assignment();

COMMENT ON FUNCTION sync_list_subscribers_from_tag(UUID) IS 
  'Sincroniza todos os customers com uma tag específica para a tabela de subscribers de email marketing';
COMMENT ON FUNCTION sync_subscriber_on_tag_assignment() IS 
  'Automaticamente adiciona customer como subscriber quando recebe uma tag vinculada a uma lista';