ALTER TABLE public.meli_listings
  ADD COLUMN IF NOT EXISTS category_name text,
  ADD COLUMN IF NOT EXISTS category_path_text text;

COMMENT ON COLUMN public.meli_listings.category_name IS 'Nome amigável da categoria do ML, persistido para abertura instantânea do diálogo';
COMMENT ON COLUMN public.meli_listings.category_path_text IS 'Caminho completo (breadcrumb) da categoria do ML, persistido para abertura instantânea';