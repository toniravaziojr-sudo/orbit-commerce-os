-- 1. Adicionar novos campos na tabela notification_rules
ALTER TABLE public.notification_rules 
ADD COLUMN IF NOT EXISTS rule_type text DEFAULT 'payment',
ADD COLUMN IF NOT EXISTS trigger_condition text,
ADD COLUMN IF NOT EXISTS whatsapp_message text,
ADD COLUMN IF NOT EXISTS email_subject text,
ADD COLUMN IF NOT EXISTS email_body text,
ADD COLUMN IF NOT EXISTS channels text[] DEFAULT ARRAY['email']::text[],
ADD COLUMN IF NOT EXISTS delay_seconds integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS delay_unit text DEFAULT 'minutes',
ADD COLUMN IF NOT EXISTS product_scope text DEFAULT 'all',
ADD COLUMN IF NOT EXISTS product_ids uuid[],
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- 2. Adicionar first_order_at no customers para pós-vendas
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS first_order_at timestamp with time zone;

-- 3. Criar tabela notification_logs para histórico detalhado
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES public.notification_rules(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  checkout_session_id uuid REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  rule_type text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  recipient text,
  content_preview text,
  attachments jsonb DEFAULT '[]'::jsonb,
  error_message text,
  attempt_count integer DEFAULT 0,
  scheduled_for timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Índices para notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_tenant ON public.notification_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_order ON public.notification_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_customer ON public.notification_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_checkout ON public.notification_logs(checkout_session_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_rule_type ON public.notification_logs(rule_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON public.notification_logs(status);

-- 5. Enable RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies para notification_logs
CREATE POLICY "Users can view notification logs of their tenant"
ON public.notification_logs
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert notification logs for their tenant"
ON public.notification_logs
FOR INSERT
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update notification logs of their tenant"
ON public.notification_logs
FOR UPDATE
USING (
  tenant_id IN (
    SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
  )
);

-- 7. Trigger para atualizar first_order_at quando cliente faz primeiro pedido
CREATE OR REPLACE FUNCTION public.update_customer_first_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualiza first_order_at apenas se for o primeiro pedido (first_order_at é NULL)
  UPDATE public.customers
  SET 
    first_order_at = COALESCE(first_order_at, NEW.created_at),
    last_order_at = NEW.created_at,
    total_orders = COALESCE(total_orders, 0) + 1
  WHERE id = NEW.customer_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. Criar trigger no insert de orders
DROP TRIGGER IF EXISTS trigger_update_customer_first_order ON public.orders;
CREATE TRIGGER trigger_update_customer_first_order
AFTER INSERT ON public.orders
FOR EACH ROW
WHEN (NEW.customer_id IS NOT NULL)
EXECUTE FUNCTION public.update_customer_first_order();

-- 9. Atualizar first_order_at para clientes existentes que já têm pedidos
UPDATE public.customers c
SET first_order_at = (
  SELECT MIN(o.created_at)
  FROM public.orders o
  WHERE o.customer_id = c.id
)
WHERE c.first_order_at IS NULL
AND EXISTS (SELECT 1 FROM public.orders o WHERE o.customer_id = c.id);