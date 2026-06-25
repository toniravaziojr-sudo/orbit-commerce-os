
CREATE TABLE public.meli_product_attribute_memory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL,
  attribute_name TEXT NOT NULL,
  attribute_id_last_seen TEXT,
  value_name TEXT,
  value_id TEXT,
  values_struct JSONB,
  not_applicable BOOLEAN NOT NULL DEFAULT false,
  category_id_last_seen TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meli_pam_unique UNIQUE (tenant_id, product_id, attribute_name)
);

CREATE INDEX meli_pam_tenant_product_idx
  ON public.meli_product_attribute_memory (tenant_id, product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meli_product_attribute_memory TO authenticated;
GRANT ALL ON public.meli_product_attribute_memory TO service_role;

ALTER TABLE public.meli_product_attribute_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members manage meli attr memory"
  ON public.meli_product_attribute_memory
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = meli_product_attribute_memory.tenant_id
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.tenant_id = meli_product_attribute_memory.tenant_id
  ));

CREATE OR REPLACE FUNCTION public.meli_pam_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER meli_pam_set_updated_at
  BEFORE UPDATE ON public.meli_product_attribute_memory
  FOR EACH ROW EXECUTE FUNCTION public.meli_pam_touch_updated_at();

-- Limpeza em cascata: quando um produto for excluído, a memória dele some junto.
ALTER TABLE public.meli_product_attribute_memory
  ADD CONSTRAINT meli_pam_product_fk
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
