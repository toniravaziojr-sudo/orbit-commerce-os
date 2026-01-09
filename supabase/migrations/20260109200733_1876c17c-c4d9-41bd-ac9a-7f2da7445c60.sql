
-- Cria função para atualizar estatísticas de pedidos dos clientes
-- Esta função deve ser chamada após importação de pedidos para atualizar total_orders e total_spent

CREATE OR REPLACE FUNCTION public.update_customer_order_stats(p_tenant_id UUID)
RETURNS TABLE(updated_count INTEGER, total_customers INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_total_customers INTEGER := 0;
BEGIN
  -- Conta clientes do tenant
  SELECT COUNT(*) INTO v_total_customers
  FROM customers
  WHERE tenant_id = p_tenant_id;
  
  -- Atualiza estatísticas baseado nos pedidos
  WITH order_stats AS (
    SELECT 
      c.id as customer_id,
      COUNT(o.id) as order_count,
      COALESCE(SUM(o.total), 0) as spent_total,
      COALESCE(AVG(o.total), 0) as avg_ticket,
      MIN(o.created_at) as first_order,
      MAX(o.created_at) as last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    WHERE c.tenant_id = p_tenant_id
    GROUP BY c.id
  )
  UPDATE customers c
  SET 
    total_orders = CASE WHEN os.order_count > 0 THEN os.order_count ELSE total_orders END,
    total_spent = CASE WHEN os.spent_total > 0 THEN os.spent_total ELSE total_spent END,
    average_ticket = CASE WHEN os.avg_ticket > 0 THEN os.avg_ticket ELSE average_ticket END,
    first_order_at = COALESCE(os.first_order, first_order_at),
    last_order_at = COALESCE(os.last_order, last_order_at),
    updated_at = NOW()
  FROM order_stats os
  WHERE c.id = os.customer_id
    AND c.tenant_id = p_tenant_id
    AND (
      c.total_orders IS DISTINCT FROM os.order_count
      OR c.total_spent IS DISTINCT FROM os.spent_total
    );
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_updated_count, v_total_customers;
END;
$$;

-- Garante que a função pode ser chamada pelo service role
GRANT EXECUTE ON FUNCTION public.update_customer_order_stats(UUID) TO service_role;
