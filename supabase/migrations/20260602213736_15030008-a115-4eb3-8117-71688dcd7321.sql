
-- ============================================================
-- Fase 1 — Fundação: Remessa agrupadora (modelo Bling)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shipping_remessas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  numero text NOT NULL,
  descricao text,
  carrier text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  protocolo_plp text,
  total_objetos integer NOT NULL DEFAULT 0,
  total_emitidos integer NOT NULL DEFAULT 0,
  total_falhas integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  emitted_at timestamptz,
  dispatched_at timestamptz,
  finalized_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT shipping_remessas_status_check CHECK (
    status IN ('rascunho','emitida','parcial','despachada','finalizada','cancelada')
  ),
  CONSTRAINT shipping_remessas_numero_tenant_unique UNIQUE (tenant_id, numero)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_remessas TO authenticated;
GRANT ALL ON public.shipping_remessas TO service_role;

ALTER TABLE public.shipping_remessas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read remessas"
  ON public.shipping_remessas FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can insert remessas"
  ON public.shipping_remessas FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can update remessas"
  ON public.shipping_remessas FOR UPDATE TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members can delete rascunho remessas"
  ON public.shipping_remessas FOR DELETE TO authenticated
  USING (public.user_belongs_to_tenant(auth.uid(), tenant_id) AND status = 'rascunho');

CREATE INDEX IF NOT EXISTS idx_shipping_remessas_tenant_status
  ON public.shipping_remessas (tenant_id, status, created_at DESC);

-- Vínculo opcional shipments → remessa
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS remessa_id uuid REFERENCES public.shipping_remessas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_shipments_remessa_id
  ON public.shipments (remessa_id) WHERE remessa_id IS NOT NULL;

-- Numerador único por tenant: Remessa_DDMMAAAA.HHMMSS (fallback em colisão)
CREATE OR REPLACE FUNCTION public.allocate_remessa_numero(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base text;
  v_numero text;
  v_suffix int := 0;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id obrigatório para alocar número de remessa';
  END IF;

  v_base := 'Remessa_' || to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'DDMMYYYY"."HH24MISS');
  v_numero := v_base;

  WHILE EXISTS (
    SELECT 1 FROM public.shipping_remessas
    WHERE tenant_id = p_tenant_id AND numero = v_numero
  ) LOOP
    v_suffix := v_suffix + 1;
    v_numero := v_base || '-' || v_suffix::text;
  END LOOP;

  RETURN v_numero;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_remessa_numero(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.allocate_remessa_numero(uuid) TO authenticated, service_role;

-- updated_at automático
CREATE OR REPLACE FUNCTION public.tg_shipping_remessas_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS shipping_remessas_touch ON public.shipping_remessas;
CREATE TRIGGER shipping_remessas_touch
  BEFORE UPDATE ON public.shipping_remessas
  FOR EACH ROW EXECUTE FUNCTION public.tg_shipping_remessas_touch();

-- Recalcula contadores quando objetos entram/saem ou mudam status
CREATE OR REPLACE FUNCTION public.recalc_remessa_counters(p_remessa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total int; v_emit int; v_fail int;
BEGIN
  IF p_remessa_id IS NULL THEN RETURN; END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE delivery_status NOT IN ('label_created','pending')),
    COUNT(*) FILTER (WHERE requires_action = true)
  INTO v_total, v_emit, v_fail
  FROM public.shipments
  WHERE remessa_id = p_remessa_id;

  UPDATE public.shipping_remessas
    SET total_objetos = COALESCE(v_total,0),
        total_emitidos = COALESCE(v_emit,0),
        total_falhas = COALESCE(v_fail,0),
        updated_at = now()
  WHERE id = p_remessa_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_remessa_counters(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.recalc_remessa_counters(uuid) TO authenticated, service_role;

-- Trigger no shipments
CREATE OR REPLACE FUNCTION public.tg_shipments_sync_remessa_counters()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.remessa_id IS NOT NULL THEN
      PERFORM public.recalc_remessa_counters(NEW.remessa_id);
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.remessa_id IS DISTINCT FROM OLD.remessa_id THEN
      PERFORM public.recalc_remessa_counters(OLD.remessa_id);
      PERFORM public.recalc_remessa_counters(NEW.remessa_id);
    ELSIF NEW.delivery_status IS DISTINCT FROM OLD.delivery_status
       OR NEW.requires_action IS DISTINCT FROM OLD.requires_action THEN
      PERFORM public.recalc_remessa_counters(NEW.remessa_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.remessa_id IS NOT NULL THEN
      PERFORM public.recalc_remessa_counters(OLD.remessa_id);
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS shipments_sync_remessa_counters ON public.shipments;
CREATE TRIGGER shipments_sync_remessa_counters
  AFTER INSERT OR UPDATE OR DELETE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.tg_shipments_sync_remessa_counters();

COMMENT ON TABLE public.shipping_remessas IS
  'Remessa agrupadora (modelo Bling). Junta N objetos (shipments) sob um número único por loja. Status: rascunho→emitida→parcial→despachada→finalizada/cancelada.';
COMMENT ON COLUMN public.shipments.remessa_id IS
  'Vínculo opcional com a Remessa agrupadora. Todo objeto emitido pelo fluxo local (Correios) deve pertencer a uma remessa, mesmo de 1. NULL = legado ou rascunho.';
