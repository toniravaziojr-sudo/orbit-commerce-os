-- ============================================================================
-- SUB-FASE 1.1 — FUNDAÇÃO DE DADOS DA IA DE ATENDIMENTO E VENDAS
-- Plano Mestre v4 — Pacotes A, B, C, H, J, G (base)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ENUMs
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE public.ai_snapshot_mode AS ENUM ('active', 'neutral', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_confidence_level AS ENUM ('low', 'medium', 'high', 'verified');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_context_node_level AS ENUM (
    'business', 'audience', 'macro_category', 'subcategory', 'product_type', 'pain'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_data_source AS ENUM ('inferred', 'manual', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_commercial_role AS ENUM (
    'primary', 'complement', 'upgrade', 'kit_component', 'accessory', 'consumable'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_product_kind AS ENUM (
    'single', 'kit', 'combo', 'pack', 'bundle', 'upgrade', 'complement', 'replacement'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_regen_scope AS ENUM ('full_snapshot', 'single_product', 'tree_only', 'payloads_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_regen_reason AS ENUM ('initial', 'catalog_changed', 'daily_cron', 'manual', 'override_changed', 'failure_retry');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ai_regen_status AS ENUM ('pending', 'processing', 'done', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- HELPER: belongs_to_tenant (idempotente)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.belongs_to_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND tenant_id = _tenant_id
  );
$$;

-- ----------------------------------------------------------------------------
-- TABELA 1: ai_business_snapshot (Pacote A)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_business_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Modo de operação
  mode public.ai_snapshot_mode NOT NULL DEFAULT 'pending',
  neutral_mode_reason text,
  
  -- Inferência
  niche_primary text,
  niche_secondary text[],
  audience_summary text,
  business_summary text,
  suggested_tone text,
  inferred_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Confiança
  confidence_score integer CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level public.ai_confidence_level DEFAULT 'low',
  
  -- Override manual (nunca sobrescrito pela regeneração)
  manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_manual_overrides boolean NOT NULL DEFAULT false,
  
  -- Versionamento e regeneração
  version integer NOT NULL DEFAULT 1,
  generated_at timestamptz,
  needs_regeneration boolean NOT NULL DEFAULT true,
  last_regen_attempt_at timestamptz,
  last_regen_error text,
  
  -- Modelo usado
  model_used text,
  generation_duration_ms integer,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_business_snapshot_tenant ON public.ai_business_snapshot(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_business_snapshot_needs_regen ON public.ai_business_snapshot(needs_regeneration) WHERE needs_regeneration = true;

ALTER TABLE public.ai_business_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read business snapshot"
  ON public.ai_business_snapshot FOR SELECT
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant owners update business snapshot overrides"
  ON public.ai_business_snapshot FOR UPDATE
  USING (public.belongs_to_tenant(tenant_id));

-- ----------------------------------------------------------------------------
-- TABELA 2: ai_context_tree (Pacote B)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_context_tree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.ai_context_tree(id) ON DELETE CASCADE,
  
  level public.ai_context_node_level NOT NULL,
  label text NOT NULL,
  slug text NOT NULL,
  description text,
  
  weight integer NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
  source public.ai_data_source NOT NULL DEFAULT 'inferred',
  
  -- Confiança
  confidence_score integer CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level public.ai_confidence_level DEFAULT 'low',
  
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (tenant_id, level, slug, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_context_tree_tenant_level ON public.ai_context_tree(tenant_id, level);
CREATE INDEX IF NOT EXISTS idx_ai_context_tree_parent ON public.ai_context_tree(parent_id);

ALTER TABLE public.ai_context_tree ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read context tree"
  ON public.ai_context_tree FOR SELECT
  USING (public.belongs_to_tenant(tenant_id));

-- Tenant-safety: parent deve ser do mesmo tenant
CREATE OR REPLACE FUNCTION public.assert_same_tenant_context_tree()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_tenant uuid;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT tenant_id INTO v_parent_tenant
    FROM public.ai_context_tree
    WHERE id = NEW.parent_id;
    
    IF v_parent_tenant IS NULL OR v_parent_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION 'Cross-tenant violation: parent node belongs to different tenant';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assert_same_tenant_context_tree
  BEFORE INSERT OR UPDATE ON public.ai_context_tree
  FOR EACH ROW EXECUTE FUNCTION public.assert_same_tenant_context_tree();

-- ----------------------------------------------------------------------------
-- TABELA 3: ai_product_pain_map (Pacote C)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_product_pain_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  pain_node_id uuid NOT NULL REFERENCES public.ai_context_tree(id) ON DELETE CASCADE,
  
  weight integer NOT NULL DEFAULT 50 CHECK (weight >= 0 AND weight <= 100),
  is_primary boolean NOT NULL DEFAULT false,
  source public.ai_data_source NOT NULL DEFAULT 'inferred',
  
  -- Confiança
  confidence_score integer CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level public.ai_confidence_level DEFAULT 'low',
  
  reasoning text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (tenant_id, product_id, pain_node_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_product_pain_map_tenant ON public.ai_product_pain_map(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_product_pain_map_product ON public.ai_product_pain_map(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_product_pain_map_pain ON public.ai_product_pain_map(pain_node_id);
CREATE INDEX IF NOT EXISTS idx_ai_product_pain_map_primary ON public.ai_product_pain_map(tenant_id, product_id) WHERE is_primary = true;

ALTER TABLE public.ai_product_pain_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read pain map"
  ON public.ai_product_pain_map FOR SELECT
  USING (public.belongs_to_tenant(tenant_id));

-- Tenant-safety: produto E pain_node devem ser do mesmo tenant
CREATE OR REPLACE FUNCTION public.assert_same_tenant_pain_map()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_tenant uuid;
  v_pain_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_product_tenant FROM public.products WHERE id = NEW.product_id;
  SELECT tenant_id INTO v_pain_tenant FROM public.ai_context_tree WHERE id = NEW.pain_node_id;
  
  IF v_product_tenant IS NULL OR v_product_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant violation: product belongs to different tenant';
  END IF;
  
  IF v_pain_tenant IS NULL OR v_pain_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant violation: pain node belongs to different tenant';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assert_same_tenant_pain_map
  BEFORE INSERT OR UPDATE ON public.ai_product_pain_map
  FOR EACH ROW EXECUTE FUNCTION public.assert_same_tenant_pain_map();

-- ----------------------------------------------------------------------------
-- TABELA 4: ai_product_commercial_payload (Pacote J + H)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_product_commercial_payload (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Identidade comercial
  commercial_name text,
  commercial_role public.ai_commercial_role NOT NULL DEFAULT 'primary',
  product_kind public.ai_product_kind NOT NULL DEFAULT 'single',
  
  -- Posicionamento
  main_pain_id uuid REFERENCES public.ai_context_tree(id) ON DELETE SET NULL,
  secondary_pain_ids uuid[] DEFAULT ARRAY[]::uuid[],
  target_audience text,
  when_not_to_indicate text,
  differentials text[] DEFAULT ARRAY[]::text[],
  
  -- Pitches (limites validados via CHECK)
  short_pitch text CHECK (short_pitch IS NULL OR length(short_pitch) <= 280),
  medium_pitch text CHECK (medium_pitch IS NULL OR length(medium_pitch) <= 800),
  comparison_arguments text,
  
  -- Variantes obrigatórias (resumo estruturado)
  variants_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_mandatory_variants boolean NOT NULL DEFAULT false,
  variant_ask_rule text,
  
  -- Prova social (só preenche se houver dado real)
  social_proof_snippet text,
  
  -- Origem e confiança
  source public.ai_data_source NOT NULL DEFAULT 'inferred',
  confidence_score integer CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_level public.ai_confidence_level DEFAULT 'low',
  
  -- Override manual
  manual_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  has_manual_overrides boolean NOT NULL DEFAULT false,
  
  -- Geração
  generated_at timestamptz,
  model_used text,
  needs_regeneration boolean NOT NULL DEFAULT true,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE (tenant_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_commercial_payload_tenant ON public.ai_product_commercial_payload(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_commercial_payload_product ON public.ai_product_commercial_payload(product_id);
CREATE INDEX IF NOT EXISTS idx_ai_commercial_payload_needs_regen ON public.ai_product_commercial_payload(tenant_id) WHERE needs_regeneration = true;

ALTER TABLE public.ai_product_commercial_payload ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read commercial payload"
  ON public.ai_product_commercial_payload FOR SELECT
  USING (public.belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant owners update commercial payload overrides"
  ON public.ai_product_commercial_payload FOR UPDATE
  USING (public.belongs_to_tenant(tenant_id));

-- Tenant-safety: produto E main_pain devem ser do mesmo tenant
CREATE OR REPLACE FUNCTION public.assert_same_tenant_commercial_payload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_tenant uuid;
  v_pain_tenant uuid;
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
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assert_same_tenant_commercial_payload
  BEFORE INSERT OR UPDATE ON public.ai_product_commercial_payload
  FOR EACH ROW EXECUTE FUNCTION public.assert_same_tenant_commercial_payload();

-- ----------------------------------------------------------------------------
-- TABELA 5: ai_snapshot_regen_queue (Fila com lease real)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_snapshot_regen_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  scope public.ai_regen_scope NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  reason public.ai_regen_reason NOT NULL,
  priority integer NOT NULL DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
  
  status public.ai_regen_status NOT NULL DEFAULT 'pending',
  
  -- Agendamento (debounce)
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  
  -- Lease (worker concorrente)
  locked_at timestamptz,
  locked_by text,
  lease_expires_at timestamptz,
  
  -- Retry
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  last_error text,
  next_retry_at timestamptz,
  
  -- Resultado
  processed_at timestamptz,
  result jsonb,
  
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_regen_queue_pending
  ON public.ai_snapshot_regen_queue(scheduled_for, priority DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_regen_queue_processing
  ON public.ai_snapshot_regen_queue(lease_expires_at)
  WHERE status = 'processing';

CREATE INDEX IF NOT EXISTS idx_ai_regen_queue_tenant ON public.ai_snapshot_regen_queue(tenant_id, status);

-- Índice parcial para evitar duplicação no debounce (1 pending por tenant+scope+product)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_regen_queue_pending_dedupe
  ON public.ai_snapshot_regen_queue(tenant_id, scope, COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status = 'pending';

ALTER TABLE public.ai_snapshot_regen_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read regen queue"
  ON public.ai_snapshot_regen_queue FOR SELECT
  USING (public.belongs_to_tenant(tenant_id));

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------

CREATE TRIGGER trg_ai_business_snapshot_updated_at
  BEFORE UPDATE ON public.ai_business_snapshot
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ai_context_tree_updated_at
  BEFORE UPDATE ON public.ai_context_tree
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ai_product_pain_map_updated_at
  BEFORE UPDATE ON public.ai_product_pain_map
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ai_commercial_payload_updated_at
  BEFORE UPDATE ON public.ai_product_commercial_payload
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_ai_regen_queue_updated_at
  BEFORE UPDATE ON public.ai_snapshot_regen_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- FUNÇÃO: enqueue_ai_regeneration (com debounce)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enqueue_ai_regeneration(
  p_tenant_id uuid,
  p_scope public.ai_regen_scope,
  p_reason public.ai_regen_reason,
  p_product_id uuid DEFAULT NULL,
  p_debounce_seconds integer DEFAULT 300,
  p_priority integer DEFAULT 50
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_new_id uuid;
  v_scheduled_for timestamptz;
BEGIN
  v_scheduled_for := now() + (p_debounce_seconds || ' seconds')::interval;
  
  -- Tenta atualizar pending existente (debounce: empurra scheduled_for)
  UPDATE public.ai_snapshot_regen_queue
  SET 
    scheduled_for = v_scheduled_for,
    reason = p_reason,
    priority = GREATEST(priority, p_priority),
    updated_at = now()
  WHERE tenant_id = p_tenant_id
    AND scope = p_scope
    AND status = 'pending'
    AND COALESCE(product_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_product_id, '00000000-0000-0000-0000-000000000000'::uuid)
  RETURNING id INTO v_existing_id;
  
  IF v_existing_id IS NOT NULL THEN
    RETURN v_existing_id;
  END IF;
  
  -- Insere novo
  INSERT INTO public.ai_snapshot_regen_queue (
    tenant_id, scope, reason, product_id, scheduled_for, priority
  ) VALUES (
    p_tenant_id, p_scope, p_reason, p_product_id, v_scheduled_for, p_priority
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- TRIGGERS DE CATÁLOGO → ENFILEIRAR REGENERAÇÃO
-- ----------------------------------------------------------------------------

-- Trigger genérico para products
CREATE OR REPLACE FUNCTION public.trg_catalog_change_enqueue_regen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_product_id uuid;
BEGIN
  -- Determina tenant_id e product_id conforme tabela de origem
  IF TG_TABLE_NAME = 'products' THEN
    v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
    v_product_id := COALESCE(NEW.id, OLD.id);
    
    -- Skip se mudança irrelevante (só timestamps, view_count, etc.)
    IF TG_OP = 'UPDATE' THEN
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
    
  ELSIF TG_TABLE_NAME = 'product_variants' THEN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);
    SELECT tenant_id INTO v_tenant_id FROM public.products WHERE id = v_product_id;
    
  ELSIF TG_TABLE_NAME = 'product_images' THEN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);
    SELECT tenant_id INTO v_tenant_id FROM public.products WHERE id = v_product_id;
    
  ELSIF TG_TABLE_NAME = 'product_components' THEN
    v_product_id := COALESCE(NEW.parent_product_id, OLD.parent_product_id);
    SELECT tenant_id INTO v_tenant_id FROM public.products WHERE id = v_product_id;
    
  ELSIF TG_TABLE_NAME = 'categories' THEN
    v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);
    v_product_id := NULL;
    
  ELSIF TG_TABLE_NAME = 'product_categories' THEN
    v_product_id := COALESCE(NEW.product_id, OLD.product_id);
    SELECT tenant_id INTO v_tenant_id FROM public.products WHERE id = v_product_id;
  END IF;
  
  IF v_tenant_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Marca snapshot como stale (sinalização rápida)
  UPDATE public.ai_business_snapshot
  SET needs_regeneration = true, updated_at = now()
  WHERE tenant_id = v_tenant_id;
  
  -- Enfileira regeneração (debounce 5min)
  IF v_product_id IS NOT NULL THEN
    -- Marca payload comercial do produto como stale
    UPDATE public.ai_product_commercial_payload
    SET needs_regeneration = true, updated_at = now()
    WHERE tenant_id = v_tenant_id AND product_id = v_product_id;
    
    PERFORM public.enqueue_ai_regeneration(
      v_tenant_id, 'single_product'::public.ai_regen_scope, 'catalog_changed'::public.ai_regen_reason,
      v_product_id, 300, 60
    );
  ELSE
    PERFORM public.enqueue_ai_regeneration(
      v_tenant_id, 'tree_only'::public.ai_regen_scope, 'catalog_changed'::public.ai_regen_reason,
      NULL, 300, 50
    );
  END IF;
  
  RETURN NULL;
END;
$$;

-- Aplica trigger nas tabelas de catálogo
DROP TRIGGER IF EXISTS trg_ai_regen_on_products ON public.products;
CREATE TRIGGER trg_ai_regen_on_products
  AFTER INSERT OR UPDATE OR DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.trg_catalog_change_enqueue_regen();

DROP TRIGGER IF EXISTS trg_ai_regen_on_product_variants ON public.product_variants;
CREATE TRIGGER trg_ai_regen_on_product_variants
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.trg_catalog_change_enqueue_regen();

DROP TRIGGER IF EXISTS trg_ai_regen_on_product_images ON public.product_images;
CREATE TRIGGER trg_ai_regen_on_product_images
  AFTER INSERT OR UPDATE OR DELETE ON public.product_images
  FOR EACH ROW EXECUTE FUNCTION public.trg_catalog_change_enqueue_regen();

DROP TRIGGER IF EXISTS trg_ai_regen_on_product_components ON public.product_components;
CREATE TRIGGER trg_ai_regen_on_product_components
  AFTER INSERT OR UPDATE OR DELETE ON public.product_components
  FOR EACH ROW EXECUTE FUNCTION public.trg_catalog_change_enqueue_regen();

DROP TRIGGER IF EXISTS trg_ai_regen_on_categories ON public.categories;
CREATE TRIGGER trg_ai_regen_on_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.trg_catalog_change_enqueue_regen();

DROP TRIGGER IF EXISTS trg_ai_regen_on_product_categories ON public.product_categories;
CREATE TRIGGER trg_ai_regen_on_product_categories
  AFTER INSERT OR UPDATE OR DELETE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.trg_catalog_change_enqueue_regen();

-- ----------------------------------------------------------------------------
-- CRON DIÁRIO (3h BRT = 6h UTC) — Reconciliação
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ai_daily_snapshot_reconciliation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant record;
  v_count integer := 0;
BEGIN
  FOR v_tenant IN
    SELECT t.id AS tenant_id
    FROM public.tenants t
    LEFT JOIN public.ai_business_snapshot s ON s.tenant_id = t.id
    WHERE s.id IS NULL
       OR s.generated_at IS NULL
       OR s.generated_at < (now() - interval '24 hours')
  LOOP
    PERFORM public.enqueue_ai_regeneration(
      v_tenant.tenant_id,
      'full_snapshot'::public.ai_regen_scope,
      'daily_cron'::public.ai_regen_reason,
      NULL, 0, 30
    );
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'enqueued', v_count,
    'ran_at', now()
  );
END;
$$;