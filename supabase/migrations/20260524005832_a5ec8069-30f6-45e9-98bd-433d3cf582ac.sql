CREATE TABLE IF NOT EXISTS public.tenant_ai_synonyms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  term TEXT NOT NULL,
  term_normalized TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'synonym',
  target_product_id UUID NULL,
  response_template TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tenant_ai_synonyms_kind_chk CHECK (kind IN ('synonym','brand','ingredient','alias'))
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_ai_synonyms_tenant_term_uniq
  ON public.tenant_ai_synonyms (tenant_id, term_normalized);
CREATE INDEX IF NOT EXISTS tenant_ai_synonyms_target_product_idx
  ON public.tenant_ai_synonyms (target_product_id);

ALTER TABLE public.tenant_ai_synonyms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members can read synonyms"
  ON public.tenant_ai_synonyms FOR SELECT
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "tenant members can insert synonyms"
  ON public.tenant_ai_synonyms FOR INSERT
  WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "tenant members can update synonyms"
  ON public.tenant_ai_synonyms FOR UPDATE
  USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "tenant members can delete synonyms"
  ON public.tenant_ai_synonyms FOR DELETE
  USING (public.user_has_tenant_access(tenant_id));

CREATE OR REPLACE FUNCTION public.tenant_ai_synonyms_normalize()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.term_normalized := lower(regexp_replace(public.unaccent(coalesce(NEW.term,'')), '\s+', ' ', 'g'));
  NEW.term_normalized := trim(NEW.term_normalized);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenant_ai_synonyms_normalize_trg ON public.tenant_ai_synonyms;
CREATE TRIGGER tenant_ai_synonyms_normalize_trg
BEFORE INSERT OR UPDATE ON public.tenant_ai_synonyms
FOR EACH ROW EXECUTE FUNCTION public.tenant_ai_synonyms_normalize();