-- 1) Coluna numero em shipments (sequencial por tenant)
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS numero bigint;

-- 2) Função de alocação (mesmo padrão de allocate_remessa_numero)
CREATE OR REPLACE FUNCTION public.allocate_shipment_numero(p_tenant_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id obrigatório';
  END IF;

  -- Lock por tenant para serializar a alocação
  PERFORM pg_advisory_xact_lock(
    hashtext('shipment_numero:' || p_tenant_id::text)
  );

  SELECT COALESCE(MAX(numero), 0) + 1
    INTO v_next
    FROM public.shipments
   WHERE tenant_id = p_tenant_id;

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_shipment_numero(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_shipment_numero(uuid) TO authenticated, service_role;

-- 3) Backfill cronológico por tenant (apenas registros sem numero)
WITH ranked AS (
  SELECT id,
         tenant_id,
         row_number() OVER (
           PARTITION BY tenant_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
    FROM public.shipments
   WHERE numero IS NULL
)
UPDATE public.shipments s
   SET numero = ranked.rn
  FROM ranked
 WHERE s.id = ranked.id
   AND s.numero IS NULL;

-- 4) NOT NULL após backfill
ALTER TABLE public.shipments
  ALTER COLUMN numero SET NOT NULL;

-- 5) Índices: unicidade (tenant, numero) e ordenação DESC
CREATE UNIQUE INDEX IF NOT EXISTS shipments_tenant_numero_key
  ON public.shipments (tenant_id, numero);

CREATE INDEX IF NOT EXISTS idx_shipments_tenant_numero_desc
  ON public.shipments (tenant_id, numero DESC);

-- 6) Trigger BEFORE INSERT: aloca numero quando vier NULL
CREATE OR REPLACE FUNCTION public.shipments_set_numero()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'shipments.tenant_id obrigatório';
  END IF;
  IF NEW.numero IS NULL THEN
    NEW.numero := public.allocate_shipment_numero(NEW.tenant_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipments_set_numero ON public.shipments;
CREATE TRIGGER trg_shipments_set_numero
BEFORE INSERT ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.shipments_set_numero();