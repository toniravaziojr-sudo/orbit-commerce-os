
-- ============================================================
-- Pacotes A + B + C — Inferência de contexto do negócio
-- ============================================================

-- 1) Contexto do negócio inferido por tenant
CREATE TABLE IF NOT EXISTS public.tenant_business_context (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Árvore inferida (Pacote B)
  -- {
  --   segment: { value: 'beleza', confidence: 'alta', evidence_count: 42 },
  --   audience: { value: 'masculino', confidence: 'media', evidence_count: 18 },
  --   macro_categories: [{ name: 'cabelo', confidence: 'alta', product_count: 28 }, ...],
  --   subcategories: [{ macro: 'cabelo', name: 'tratamento', product_count: 12 }, ...],
  --   product_types: [{ subcategory: 'tratamento', name: 'anticalvicie', product_count: 5 }, ...],
  --   pain_points: [{ name: 'queda de cabelo', synonyms: [...], confidence: 'alta', product_count: 8 }, ...]
  -- }
  inferred_tree JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Override manual do tenant (Pacote E - vai virar UI na Fase 4).
  -- Mesmo schema do inferred_tree, porém com prioridade na hora de montar
  -- o bloco do prompt. Nunca é sobrescrito pela regeneração automática.
  manual_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Confiança global da inferência ('alta' | 'media' | 'baixa')
  overall_confidence TEXT NOT NULL DEFAULT 'baixa',

  -- Pacote G — fallback de catálogo ruim
  catalog_incomplete BOOLEAN NOT NULL DEFAULT true,
  catalog_incomplete_reason TEXT,

  -- Controle de regeneração
  needs_regeneration BOOLEAN NOT NULL DEFAULT true,
  last_inferred_at TIMESTAMPTZ,
  last_inference_error TEXT,
  product_count_snapshot INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT tbc_overall_confidence_check
    CHECK (overall_confidence IN ('alta', 'media', 'baixa'))
);

CREATE INDEX IF NOT EXISTS idx_tbc_tenant_id ON public.tenant_business_context(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tbc_needs_regen ON public.tenant_business_context(needs_regeneration) WHERE needs_regeneration = true;

-- 2) Mapa N:N produto ↔ dor/objetivo (Pacote C)
CREATE TABLE IF NOT EXISTS public.product_pain_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Nome canônico da dor (ex: 'queda de cabelo', 'calvicie', 'caspa', 'oleosidade')
  pain_point TEXT NOT NULL,

  -- Peso do vínculo (1.0 = dor principal; 0.5 = dor secundária; 0.2 = dor tangencial)
  weight NUMERIC(3,2) NOT NULL DEFAULT 0.5,

  -- Origem do vínculo: 'inferred' (gerado pela IA a partir do catálogo) ou 'manual' (tenant ajustou)
  source TEXT NOT NULL DEFAULT 'inferred',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ppp_weight_check CHECK (weight > 0 AND weight <= 1),
  CONSTRAINT ppp_source_check CHECK (source IN ('inferred', 'manual')),
  UNIQUE (tenant_id, product_id, pain_point)
);

CREATE INDEX IF NOT EXISTS idx_ppp_tenant_pain ON public.product_pain_points(tenant_id, pain_point);
CREATE INDEX IF NOT EXISTS idx_ppp_product ON public.product_pain_points(product_id);

-- 3) RLS
ALTER TABLE public.tenant_business_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_pain_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_admins_view_business_context"
ON public.tenant_business_context FOR SELECT
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
  has_role(auth.uid(), tenant_id, 'admin'::app_role) OR
  has_role(auth.uid(), tenant_id, 'operator'::app_role)
);

CREATE POLICY "tenant_admins_manage_business_context"
ON public.tenant_business_context FOR ALL
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

CREATE POLICY "tenant_admins_view_pain_points"
ON public.product_pain_points FOR SELECT
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
  has_role(auth.uid(), tenant_id, 'admin'::app_role) OR
  has_role(auth.uid(), tenant_id, 'operator'::app_role)
);

CREATE POLICY "tenant_admins_manage_pain_points"
ON public.product_pain_points FOR ALL
USING (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), tenant_id, 'owner'::app_role) OR
  has_role(auth.uid(), tenant_id, 'admin'::app_role)
);

-- 4) Trigger de updated_at
CREATE TRIGGER trg_tbc_updated_at
BEFORE UPDATE ON public.tenant_business_context
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ppp_updated_at
BEFORE UPDATE ON public.product_pain_points
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Pacote G — Trigger que marca contexto como "stale" quando catálogo muda
CREATE OR REPLACE FUNCTION public.mark_business_context_stale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Determina tenant afetado
  IF (TG_OP = 'DELETE') THEN
    v_tenant_id := OLD.tenant_id;
  ELSE
    v_tenant_id := NEW.tenant_id;
  END IF;

  -- Só marca como stale se houve mudança relevante
  IF (TG_OP = 'INSERT' OR TG_OP = 'DELETE') THEN
    -- nada
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (
      OLD.name IS NOT DISTINCT FROM NEW.name AND
      OLD.description IS NOT DISTINCT FROM NEW.description AND
      OLD.short_description IS NOT DISTINCT FROM NEW.short_description AND
      OLD.tags IS NOT DISTINCT FROM NEW.tags AND
      OLD.status IS NOT DISTINCT FROM NEW.status AND
      OLD.deleted_at IS NOT DISTINCT FROM NEW.deleted_at AND
      OLD.product_type IS NOT DISTINCT FROM NEW.product_type
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Marca contexto como precisando regenerar (não regenera aqui — só sinaliza)
  UPDATE public.tenant_business_context
  SET needs_regeneration = true
  WHERE tenant_id = v_tenant_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_products_mark_context_stale
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.mark_business_context_stale();

-- 6) Trigger também para mudanças em categorias (categoria nova / renomeada)
CREATE OR REPLACE FUNCTION public.mark_business_context_stale_from_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_tenant_id := OLD.tenant_id;
  ELSE
    v_tenant_id := NEW.tenant_id;
  END IF;

  UPDATE public.tenant_business_context
  SET needs_regeneration = true
  WHERE tenant_id = v_tenant_id;

  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_categories_mark_context_stale
AFTER INSERT OR UPDATE OF name, description, parent_id, is_active OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.mark_business_context_stale_from_category();
