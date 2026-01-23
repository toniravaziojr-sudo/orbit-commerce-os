-- ============================================
-- Auto-tag "Cliente" quando pedido é aprovado (payment_status = 'paid')
-- Substitui qualquer tag existente pela tag "Cliente"
-- ============================================

-- Função que gerencia a tag "Cliente" automaticamente
CREATE OR REPLACE FUNCTION public.auto_tag_cliente_on_payment_approved()
RETURNS TRIGGER AS $$
DECLARE
  v_customer_id UUID;
  v_cliente_tag_id UUID;
BEGIN
  -- Só executa se payment_status mudou para 'paid' (aprovado)
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS NULL OR OLD.payment_status <> 'paid') THEN
    
    -- Busca o customer_id do pedido
    v_customer_id := NEW.customer_id;
    
    -- Se não tem customer_id, não faz nada
    IF v_customer_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Busca ou cria a tag "Cliente" (verde #10B981)
    SELECT id INTO v_cliente_tag_id
    FROM customer_tags
    WHERE tenant_id = NEW.tenant_id AND name = 'Cliente'
    LIMIT 1;
    
    IF v_cliente_tag_id IS NULL THEN
      INSERT INTO customer_tags (tenant_id, name, color, description)
      VALUES (NEW.tenant_id, 'Cliente', '#10B981', 'Clientes com pedido aprovado')
      RETURNING id INTO v_cliente_tag_id;
    END IF;
    
    -- Remove TODAS as tags existentes do cliente (substituição)
    DELETE FROM customer_tag_assignments
    WHERE customer_id = v_customer_id;
    
    -- Adiciona a tag "Cliente"
    INSERT INTO customer_tag_assignments (customer_id, tag_id)
    VALUES (v_customer_id, v_cliente_tag_id)
    ON CONFLICT (customer_id, tag_id) DO NOTHING;
    
    RAISE LOG '[auto_tag_cliente] Customer % tagged with Cliente tag % for order %', 
      v_customer_id, v_cliente_tag_id, NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trg_auto_tag_cliente_on_payment ON orders;

-- Cria trigger que dispara após UPDATE no payment_status
CREATE TRIGGER trg_auto_tag_cliente_on_payment
  AFTER UPDATE OF payment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_tag_cliente_on_payment_approved();

-- Comentário explicativo
COMMENT ON FUNCTION auto_tag_cliente_on_payment_approved() IS 
  'Automaticamente substitui todas as tags do cliente pela tag "Cliente" quando um pedido é aprovado (payment_status = paid)';