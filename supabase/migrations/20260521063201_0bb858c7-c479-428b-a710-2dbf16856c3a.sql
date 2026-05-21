
-- Fase A — Expansão do cadastro de fornecedores (versão corrigida sem pg_trgm)

DO $$ BEGIN
  CREATE TYPE public.supplier_person_type AS ENUM ('PF', 'PJ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.supplier_contributor_type AS ENUM ('contribuinte', 'nao_contribuinte', 'contribuinte_isento');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS person_type public.supplier_person_type NOT NULL DEFAULT 'PJ',
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS trade_name text,
  ADD COLUMN IF NOT EXISTS ie text,
  ADD COLUMN IF NOT EXISTS ie_isento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS im text,
  ADD COLUMN IF NOT EXISTS contributor_type public.supplier_contributor_type NOT NULL DEFAULT 'nao_contribuinte',
  ADD COLUMN IF NOT EXISTS is_foreign boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS uf text,
  ADD COLUMN IF NOT EXISTS codigo_ibge text,
  ADD COLUMN IF NOT EXISTS pais text NOT NULL DEFAULT 'Brasil',
  ADD COLUMN IF NOT EXISTS phone_secondary text,
  ADD COLUMN IF NOT EXISTS fiscal_notes text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.suppliers_doc_digits(p_cnpj text, p_cpf text, p_person_type public.supplier_person_type)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_person_type = 'PJ' THEN NULLIF(regexp_replace(COALESCE(p_cnpj, ''), '\D', '', 'g'), '')
    ELSE NULLIF(regexp_replace(COALESCE(p_cpf, ''), '\D', '', 'g'), '')
  END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_tenant_doc
  ON public.suppliers (tenant_id, public.suppliers_doc_digits(cnpj, cpf, person_type))
  WHERE deleted_at IS NULL
    AND public.suppliers_doc_digits(cnpj, cpf, person_type) IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_active
  ON public.suppliers (tenant_id, is_active)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_name_lower
  ON public.suppliers (tenant_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.suppliers_validate_person_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.person_type = 'PJ' AND NEW.cpf IS NOT NULL AND NEW.cnpj IS NULL THEN
    RAISE EXCEPTION 'Fornecedor PJ não pode ter apenas CPF; informe o CNPJ.';
  END IF;
  IF NEW.person_type = 'PF' AND NEW.cnpj IS NOT NULL AND NEW.cpf IS NULL THEN
    RAISE EXCEPTION 'Fornecedor PF não pode ter apenas CNPJ; informe o CPF.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suppliers_validate_person_type ON public.suppliers;
CREATE TRIGGER trg_suppliers_validate_person_type
  BEFORE INSERT OR UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.suppliers_validate_person_type();
