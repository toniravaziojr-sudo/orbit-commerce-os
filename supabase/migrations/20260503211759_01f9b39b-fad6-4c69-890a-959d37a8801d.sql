
-- ============================================================================
-- ONDA 1B — Visão da IA do Produto
-- Estende ai_product_commercial_payload + cria ai_product_relations
-- ============================================================================

-- 1) Novas colunas em ai_product_commercial_payload
ALTER TABLE public.ai_product_commercial_payload
  ADD COLUMN IF NOT EXISTS base_product_id uuid NULL REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_base_candidate boolean NULL,
  ADD COLUMN IF NOT EXISTS when_to_recommend text NULL,
  ADD COLUMN IF NOT EXISTS recommendation_notes text NULL;

-- CHECKs (idempotentes)
DO $$ BEGIN
  ALTER TABLE public.ai_product_commercial_payload
    ADD CONSTRAINT ai_payload_base_not_self CHECK (base_product_id IS NULL OR base_product_id <> product_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_product_commercial_payload
    ADD CONSTRAINT ai_payload_when_to_recommend_len CHECK (when_to_recommend IS NULL OR length(when_to_recommend) <= 600);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.ai_product_commercial_payload
    ADD CONSTRAINT ai_payload_recommendation_notes_len CHECK (recommendation_notes IS NULL OR length(recommendation_notes) <= 1000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ai_payload_base_product
  ON public.ai_product_commercial_payload(tenant_id, base_product_id)
  WHERE base_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_payload_base_candidate
  ON public.ai_product_commercial_payload(tenant_id, is_base_candidate)
  WHERE is_base_candidate IS NOT NULL;

-- Estende trigger cross-tenant para validar base_product_id
CREATE OR REPLACE FUNCTION public.assert_same_tenant_commercial_payload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_tenant uuid;
  v_pain_tenant uuid;
  v_base_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_product_tenant FROM public.products WHERE id = NEW.product_id;
  IF v_product_tenant IS NULL OR v_product_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant violation: product belongs to different tenant';
  END IF;

  IF NEW.main_pain_id IS NOT NULL THEN
    SELECT tenant_id INTO v_pain_tenant FROM public.ai_context_tree WHERE id = NEW.main_pain_id;
    IF v_pain_tenant IS NULL OR v_pain_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Cross-tenant violation: main pain belongs to different tenant';
    END IF;
  END IF;

  IF NEW.base_product_id IS NOT NULL THEN
    SELECT tenant_id INTO v_base_tenant FROM public.products WHERE id = NEW.base_product_id;
    IF v_base_tenant IS NULL OR v_base_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Cross-tenant violation: base product belongs to different tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Tabela ai_product_relations (N:N de relações entre produtos)
CREATE TABLE IF NOT EXISTS public.ai_product_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  source_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  target_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('complement','related_base','upsell','cross_sell')),
  position integer NOT NULL DEFAULT 0,
  source public.ai_data_source NOT NULL DEFAULT 'manual',
  confidence_score integer CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 100)),
  manual_override boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_rel_no_self CHECK (source_product_id <> target_product_id),
  CONSTRAINT ai_rel_unique UNIQUE (tenant_id, source_product_id, target_product_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_rel_source ON public.ai_product_relations(tenant_id, source_product_id, relation_type);
CREATE INDEX IF NOT EXISTS idx_ai_rel_target ON public.ai_product_relations(tenant_id, target_product_id);

ALTER TABLE public.ai_product_relations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members read product relations" ON public.ai_product_relations;
CREATE POLICY "Tenant members read product relations"
  ON public.ai_product_relations FOR SELECT
  USING (public.belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant members insert product relations" ON public.ai_product_relations;
CREATE POLICY "Tenant members insert product relations"
  ON public.ai_product_relations FOR INSERT
  WITH CHECK (public.belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant members update product relations" ON public.ai_product_relations;
CREATE POLICY "Tenant members update product relations"
  ON public.ai_product_relations FOR UPDATE
  USING (public.belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant members delete product relations" ON public.ai_product_relations;
CREATE POLICY "Tenant members delete product relations"
  ON public.ai_product_relations FOR DELETE
  USING (public.belongs_to_tenant(tenant_id));

-- Trigger cross-tenant: ambos os produtos devem pertencer ao tenant_id
CREATE OR REPLACE FUNCTION public.assert_same_tenant_product_relations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src uuid;
  v_tgt uuid;
BEGIN
  SELECT tenant_id INTO v_src FROM public.products WHERE id = NEW.source_product_id;
  IF v_src IS NULL OR v_src <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant violation: source product belongs to different tenant';
  END IF;

  SELECT tenant_id INTO v_tgt FROM public.products WHERE id = NEW.target_product_id;
  IF v_tgt IS NULL OR v_tgt <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant violation: target product belongs to different tenant';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assert_same_tenant_product_relations ON public.ai_product_relations;
CREATE TRIGGER trg_assert_same_tenant_product_relations
  BEFORE INSERT OR UPDATE ON public.ai_product_relations
  FOR EACH ROW EXECUTE FUNCTION public.assert_same_tenant_product_relations();

-- updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_ai_product_relations_touch ON public.ai_product_relations;
CREATE TRIGGER trg_ai_product_relations_touch
  BEFORE UPDATE ON public.ai_product_relations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
