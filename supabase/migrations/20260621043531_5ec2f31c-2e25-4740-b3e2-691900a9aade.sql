
-- =============================================================
-- Etapa 1+2 — Base de dados para Classificação Inteligente ML
-- Sem impacto de UI. Dados pré-cadastrados (seed inicial).
-- =============================================================

-- ===== Tabela 1: Taxonomia Universal de Categorias =====
CREATE TABLE IF NOT EXISTS public.system_universal_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  parent_slug text REFERENCES public.system_universal_categories(slug) ON DELETE RESTRICT,
  name text NOT NULL,
  level smallint NOT NULL DEFAULT 1,
  regulatory_regime text NOT NULL DEFAULT 'none'
    CHECK (regulatory_regime IN ('anvisa_cosmetic','anvisa_health','anvisa_food','mapa','inmetro','anatel','none')),
  -- Lista de chaves de atributos universais (do dicionário) tipicamente exigidos nessa categoria
  typical_attributes jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Pistas de mapeamento para categorias de marketplaces (texto livre, opcional)
  marketplace_hints jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_universal_categories TO authenticated, anon;
GRANT ALL ON public.system_universal_categories TO service_role;

ALTER TABLE public.system_universal_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read universal categories"
  ON public.system_universal_categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role manages universal categories"
  ON public.system_universal_categories FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_universal_categories_parent
  ON public.system_universal_categories(parent_slug);

-- ===== Tabela 2: Dicionário Universal de Atributos =====
CREATE TABLE IF NOT EXISTS public.system_marketplace_attribute_dictionary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  universal_key text NOT NULL UNIQUE,
  label_pt text NOT NULL,
  description_pt text,
  value_type text NOT NULL DEFAULT 'string'
    CHECK (value_type IN ('string','number','boolean','enum','dimension')),
  enum_values jsonb,
  -- De onde o sistema tenta derivar/preencher (campo do cadastro, derivação, IA, marketplace)
  derivable_from text,
  -- Códigos por marketplace
  ml_attribute_id text,
  shopee_attribute_id text,
  tiktok_attribute_id text,
  -- Slugs de categorias universais onde se aplica (vazio = pode aplicar em qualquer)
  applies_to_categories text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_common boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.system_marketplace_attribute_dictionary TO authenticated, anon;
GRANT ALL ON public.system_marketplace_attribute_dictionary TO service_role;

ALTER TABLE public.system_marketplace_attribute_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read attribute dictionary"
  ON public.system_marketplace_attribute_dictionary FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role manages attribute dictionary"
  ON public.system_marketplace_attribute_dictionary FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_attr_dict_ml ON public.system_marketplace_attribute_dictionary(ml_attribute_id);

-- ===== Trigger updated_at compartilhado (se ainda não existir, cria) =====
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_universal_categories_updated
  BEFORE UPDATE ON public.system_universal_categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_attr_dict_updated
  BEFORE UPDATE ON public.system_marketplace_attribute_dictionary
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
