-- Landing pages nascem não indexáveis por padrão (Onda 1 SEO)
CREATE OR REPLACE FUNCTION public.store_pages_lp_default_noindex()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'landing_page' THEN
    NEW.no_index := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_pages_lp_default_noindex ON public.store_pages;
CREATE TRIGGER trg_store_pages_lp_default_noindex
BEFORE INSERT ON public.store_pages
FOR EACH ROW
EXECUTE FUNCTION public.store_pages_lp_default_noindex();