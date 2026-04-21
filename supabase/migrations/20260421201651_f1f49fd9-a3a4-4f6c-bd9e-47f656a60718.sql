
-- Tabela de snapshot tenant-aware para grounding da IA de atendimento
CREATE TABLE IF NOT EXISTS public.tenant_ai_context_snapshot (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  niche_label TEXT,
  niche_confidence NUMERIC(3,2),
  business_summary JSONB DEFAULT '{}'::jsonb,
  top_categories JSONB DEFAULT '[]'::jsonb,
  top_products JSONB DEFAULT '[]'::jsonb,
  policies_summary JSONB DEFAULT '{}'::jsonb,
  commercial_signals JSONB DEFAULT '{}'::jsonb,
  source_hash TEXT,
  is_stale BOOLEAN NOT NULL DEFAULT true,
  build_error TEXT,
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_ai_context_snapshot_stale 
  ON public.tenant_ai_context_snapshot(is_stale) WHERE is_stale = true;

ALTER TABLE public.tenant_ai_context_snapshot ENABLE ROW LEVEL SECURITY;

-- Leitura: usuários do tenant
CREATE POLICY "Users can view their tenant context snapshot"
ON public.tenant_ai_context_snapshot
FOR SELECT
USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

-- Escrita: somente service role (edge functions)
CREATE POLICY "Service role manages context snapshot"
ON public.tenant_ai_context_snapshot
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Trigger de timestamp
CREATE TRIGGER trg_tenant_ai_context_snapshot_updated_at
BEFORE UPDATE ON public.tenant_ai_context_snapshot
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função: marcar snapshot como stale quando dados-base mudam
CREATE OR REPLACE FUNCTION public.mark_tenant_context_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
  IF v_tenant_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.tenant_ai_context_snapshot (tenant_id, is_stale)
  VALUES (v_tenant_id, true)
  ON CONFLICT (tenant_id) DO UPDATE
    SET is_stale = true,
        updated_at = now();

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers de invalidação nos dados-base
DROP TRIGGER IF EXISTS trg_products_invalidate_context ON public.products;
CREATE TRIGGER trg_products_invalidate_context
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.mark_tenant_context_stale();

DROP TRIGGER IF EXISTS trg_categories_invalidate_context ON public.categories;
CREATE TRIGGER trg_categories_invalidate_context
AFTER INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.mark_tenant_context_stale();

DROP TRIGGER IF EXISTS trg_store_settings_invalidate_context ON public.store_settings;
CREATE TRIGGER trg_store_settings_invalidate_context
AFTER INSERT OR UPDATE OR DELETE ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.mark_tenant_context_stale();
