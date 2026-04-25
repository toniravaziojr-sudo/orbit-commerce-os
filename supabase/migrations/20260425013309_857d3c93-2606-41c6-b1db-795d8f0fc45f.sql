-- =====================================================================
-- SUB-FASE 2.1 — Pacotes J + M
-- Padrão de RLS alinhado à Fase 1 (belongs_to_tenant)
-- =====================================================================

-- ---------------------------------------------------------------------
-- PACOTE J — ai_language_dictionary
-- ---------------------------------------------------------------------
CREATE TABLE public.ai_language_dictionary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  tone_style TEXT NOT NULL DEFAULT 'consultivo',
  treatment_pronoun TEXT NOT NULL DEFAULT 'voce',
  use_emojis BOOLEAN NOT NULL DEFAULT true,
  emoji_whitelist TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  niche_vocabulary JSONB NOT NULL DEFAULT '{}'::jsonb,
  product_aliases JSONB NOT NULL DEFAULT '{}'::jsonb,
  forbidden_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  preferred_phrases JSONB NOT NULL DEFAULT '{}'::jsonb,

  confidence_score NUMERIC(3,2),
  confidence_level public.ai_confidence_level,
  source public.ai_data_source NOT NULL DEFAULT 'inferred',
  manual_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  has_manual_overrides BOOLEAN NOT NULL DEFAULT false,
  needs_regeneration BOOLEAN NOT NULL DEFAULT false,
  model_used TEXT,
  generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ai_language_dictionary_tenant_unique UNIQUE (tenant_id)
);

CREATE INDEX idx_ai_language_dictionary_tenant ON public.ai_language_dictionary(tenant_id);

ALTER TABLE public.ai_language_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read language dictionary"
ON public.ai_language_dictionary
FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members insert language dictionary"
ON public.ai_language_dictionary
FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members update language dictionary"
ON public.ai_language_dictionary
FOR UPDATE
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members delete language dictionary"
ON public.ai_language_dictionary
FOR DELETE
USING (belongs_to_tenant(tenant_id));

CREATE TRIGGER trg_ai_language_dictionary_updated_at
BEFORE UPDATE ON public.ai_language_dictionary
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- PACOTE M — ai_intent_objection_map
-- ---------------------------------------------------------------------
CREATE TABLE public.ai_intent_objection_map (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  entry_type TEXT NOT NULL,
  key TEXT NOT NULL,
  label TEXT NOT NULL,

  trigger_patterns TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  recommended_state TEXT,
  standard_response TEXT,

  severity TEXT,
  product_scope UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],

  is_active BOOLEAN NOT NULL DEFAULT true,

  confidence_score NUMERIC(3,2),
  confidence_level public.ai_confidence_level,
  source public.ai_data_source NOT NULL DEFAULT 'inferred',
  manual_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  has_manual_overrides BOOLEAN NOT NULL DEFAULT false,
  needs_regeneration BOOLEAN NOT NULL DEFAULT false,
  model_used TEXT,
  generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ai_intent_objection_unique UNIQUE (tenant_id, entry_type, key),
  CONSTRAINT ai_intent_objection_entry_type_check
    CHECK (entry_type IN ('intent', 'objection')),
  CONSTRAINT ai_intent_objection_severity_check
    CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high'))
);

CREATE INDEX idx_ai_intent_objection_tenant ON public.ai_intent_objection_map(tenant_id);
CREATE INDEX idx_ai_intent_objection_type ON public.ai_intent_objection_map(tenant_id, entry_type, is_active);

ALTER TABLE public.ai_intent_objection_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members read intent objection map"
ON public.ai_intent_objection_map
FOR SELECT
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members insert intent objection map"
ON public.ai_intent_objection_map
FOR INSERT
WITH CHECK (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members update intent objection map"
ON public.ai_intent_objection_map
FOR UPDATE
USING (belongs_to_tenant(tenant_id));

CREATE POLICY "Tenant members delete intent objection map"
ON public.ai_intent_objection_map
FOR DELETE
USING (belongs_to_tenant(tenant_id));

CREATE TRIGGER trg_ai_intent_objection_map_updated_at
BEFORE UPDATE ON public.ai_intent_objection_map
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- TRIGGER COMPARTILHADO — auto-marca has_manual_overrides
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_has_manual_overrides_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.manual_overrides IS NOT NULL
     AND NEW.manual_overrides <> '{}'::jsonb THEN
    NEW.has_manual_overrides := true;
  ELSE
    NEW.has_manual_overrides := false;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ai_language_dictionary_overrides_flag
BEFORE INSERT OR UPDATE OF manual_overrides ON public.ai_language_dictionary
FOR EACH ROW
EXECUTE FUNCTION public.set_has_manual_overrides_flag();

CREATE TRIGGER trg_ai_intent_objection_overrides_flag
BEFORE INSERT OR UPDATE OF manual_overrides ON public.ai_intent_objection_map
FOR EACH ROW
EXECUTE FUNCTION public.set_has_manual_overrides_flag();