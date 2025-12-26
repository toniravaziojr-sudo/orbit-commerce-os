
-- 1. Adicionar campo effective_from na tabela notification_rules (regras não retroativas)
ALTER TABLE public.notification_rules
ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Garantir que customers.first_order_at existe (já existe conforme verificado)
-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_customers_first_order_at ON public.customers(first_order_at);
CREATE INDEX IF NOT EXISTS idx_notification_rules_effective_from ON public.notification_rules(effective_from);

-- 3. Backfill first_order_at para clientes existentes que não têm o campo preenchido
UPDATE public.customers c
SET first_order_at = sub.first_order
FROM (
  SELECT customer_email, MIN(created_at) as first_order
  FROM public.orders
  WHERE customer_email IS NOT NULL
  GROUP BY customer_email
) sub
WHERE LOWER(c.email) = LOWER(sub.customer_email)
  AND c.first_order_at IS NULL;

-- 4. Criar tabela para jobs de backfill de pós-venda
CREATE TABLE IF NOT EXISTS public.post_sale_backfill_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  total_customers INTEGER NOT NULL DEFAULT 0,
  processed_customers INTEGER NOT NULL DEFAULT 0,
  rate_limit_per_hour INTEGER NOT NULL DEFAULT 100,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Criar tabela para items do backfill (fila de clientes)
CREATE TABLE IF NOT EXISTS public.post_sale_backfill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.post_sale_backfill_jobs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_post_sale_backfill_jobs_tenant_status 
ON public.post_sale_backfill_jobs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_post_sale_backfill_items_job_status 
ON public.post_sale_backfill_items(job_id, status);

CREATE INDEX IF NOT EXISTS idx_post_sale_backfill_items_scheduled 
ON public.post_sale_backfill_items(scheduled_for) 
WHERE status = 'pending';

-- 6. Enable RLS
ALTER TABLE public.post_sale_backfill_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_sale_backfill_items ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies para jobs
CREATE POLICY "Users can view backfill jobs of their tenant"
ON public.post_sale_backfill_jobs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = post_sale_backfill_jobs.tenant_id
  )
);

CREATE POLICY "Admins can create backfill jobs"
ON public.post_sale_backfill_jobs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = post_sale_backfill_jobs.tenant_id
    AND role IN ('owner', 'admin')
  )
);

CREATE POLICY "Admins can update backfill jobs"
ON public.post_sale_backfill_jobs FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = post_sale_backfill_jobs.tenant_id
    AND role IN ('owner', 'admin')
  )
);

-- 8. RLS Policies para items
CREATE POLICY "Users can view backfill items of their tenant"
ON public.post_sale_backfill_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND tenant_id = post_sale_backfill_items.tenant_id
  )
);

CREATE POLICY "Service role can manage backfill items"
ON public.post_sale_backfill_items FOR ALL
USING (auth.role() = 'service_role');

-- 9. Trigger para updated_at
CREATE TRIGGER update_post_sale_backfill_jobs_updated_at
BEFORE UPDATE ON public.post_sale_backfill_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Adicionar campo occurred_at no events_inbox para referência temporal (se não existir)
-- O campo já existe conforme schema, então apenas criar índice
CREATE INDEX IF NOT EXISTS idx_events_inbox_occurred_at 
ON public.events_inbox(occurred_at);

CREATE INDEX IF NOT EXISTS idx_events_inbox_tenant_occurred 
ON public.events_inbox(tenant_id, occurred_at DESC);
