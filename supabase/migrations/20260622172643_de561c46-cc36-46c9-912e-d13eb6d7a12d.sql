
-- 1) Atualiza CHECK do status para incluir paused e inactive
ALTER TABLE public.meli_listings DROP CONSTRAINT IF EXISTS meli_listings_status_check;
ALTER TABLE public.meli_listings ADD CONSTRAINT meli_listings_status_check
  CHECK (status = ANY (ARRAY['draft','ready','approved','publishing','published','paused','inactive','error']));

-- 2) Novas colunas de rastreio de origem
ALTER TABLE public.meli_listings
  ADD COLUMN IF NOT EXISTS last_status_change_source text
    CHECK (last_status_change_source IN ('local','meli')),
  ADD COLUMN IF NOT EXISTS last_status_change_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactive_reason text,
  ADD COLUMN IF NOT EXISTS inactive_at timestamptz;

-- 3) Trigger: ao mudar status, marca timestamp. Se a escrita não disser a origem,
-- assume 'local' (escrita do app); o webhook envia 'meli' explicitamente.
CREATE OR REPLACE FUNCTION public.meli_listings_status_change_stamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    IF NEW.last_status_change_at IS NULL THEN
      NEW.last_status_change_at := now();
    END IF;
    IF NEW.last_status_change_source IS NULL THEN
      NEW.last_status_change_source := 'local';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.last_status_change_at := now();
    -- Se quem escreveu não definiu a origem explicitamente nesta atualização,
    -- mantemos o valor anterior ou caímos para 'local'.
    IF NEW.last_status_change_source IS NULL
       OR NEW.last_status_change_source = OLD.last_status_change_source THEN
      -- escritor não tocou no campo → assume mudança local
      NEW.last_status_change_source := COALESCE(NEW.last_status_change_source, 'local');
      IF NEW.last_status_change_source = OLD.last_status_change_source
         AND NEW.last_status_change_source IS NULL THEN
        NEW.last_status_change_source := 'local';
      END IF;
    END IF;
  END IF;

  -- Carimba inactive_at quando entra em inactive
  IF NEW.status = 'inactive' AND (OLD.status IS DISTINCT FROM 'inactive') THEN
    NEW.inactive_at := COALESCE(NEW.inactive_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meli_listings_status_change_stamp ON public.meli_listings;
CREATE TRIGGER trg_meli_listings_status_change_stamp
  BEFORE INSERT OR UPDATE ON public.meli_listings
  FOR EACH ROW EXECUTE FUNCTION public.meli_listings_status_change_stamp();

-- 4) marketplace_connections: último webhook recebido (para selo de tempo real)
ALTER TABLE public.marketplace_connections
  ADD COLUMN IF NOT EXISTS last_webhook_at timestamptz;

-- 5) Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='meli_listings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.meli_listings';
  END IF;
END $$;

ALTER TABLE public.meli_listings REPLICA IDENTITY FULL;

-- 6) Backfill: marca last_status_change_at em registros antigos para começar com âncora válida
UPDATE public.meli_listings
  SET last_status_change_at = COALESCE(last_status_change_at, updated_at, created_at, now()),
      last_status_change_source = COALESCE(last_status_change_source, 'local')
  WHERE last_status_change_at IS NULL OR last_status_change_source IS NULL;
