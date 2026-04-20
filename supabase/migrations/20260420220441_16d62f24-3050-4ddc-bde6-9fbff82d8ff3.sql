
ALTER TABLE public.whatsapp_configs
  ADD COLUMN IF NOT EXISTS previous_phone_number_id text,
  ADD COLUMN IF NOT EXISTS previous_waba_id text,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS migration_observation_until timestamptz;

-- Trigger function: when phone_number_id or waba_id changes, capture previous + open observation window.
CREATE OR REPLACE FUNCTION public.whatsapp_configs_track_migration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.linked_at := COALESCE(NEW.linked_at, now());
    -- New connection: also start an observation window so we don't claim "healthy" until first inbound or 24h pass
    IF NEW.phone_number_id IS NOT NULL THEN
      NEW.migration_observation_until := COALESCE(NEW.migration_observation_until, now() + interval '24 hours');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.phone_number_id IS DISTINCT FROM OLD.phone_number_id)
       OR (NEW.waba_id IS DISTINCT FROM OLD.waba_id) THEN
      NEW.previous_phone_number_id := OLD.phone_number_id;
      NEW.previous_waba_id := OLD.waba_id;
      NEW.linked_at := now();
      NEW.migration_observation_until := now() + interval '24 hours';
      -- Reset cached inbound timestamp because previous flow belonged to the old number
      NEW.last_inbound_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_configs_track_migration ON public.whatsapp_configs;
CREATE TRIGGER trg_whatsapp_configs_track_migration
BEFORE INSERT OR UPDATE ON public.whatsapp_configs
FOR EACH ROW EXECUTE FUNCTION public.whatsapp_configs_track_migration();

-- Backfill linked_at for existing rows where missing
UPDATE public.whatsapp_configs
SET linked_at = COALESCE(linked_at, last_connected_at, created_at)
WHERE linked_at IS NULL;
