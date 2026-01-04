-- =============================================
-- FASE 1: Tabelas de tipos customizáveis
-- =============================================

-- Tipos de compra (ex: Matéria-prima, Serviços, Equipamentos)
CREATE TABLE public.purchase_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Tipos de fornecedor (ex: Fornecedor de matéria-prima, Prestador de serviço)
CREATE TABLE public.supplier_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Tipos de entrada/saída financeira (customizáveis além das categorias fixas)
CREATE TABLE public.finance_entry_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('income', 'expense')),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, entry_type, name)
);

-- =============================================
-- FASE 2: Adicionar colunas de referência
-- =============================================

-- Em purchases: adicionar purchase_type_id
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS purchase_type_id UUID REFERENCES public.purchase_types(id) ON DELETE SET NULL;

-- Em suppliers: adicionar supplier_type_id
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS supplier_type_id UUID REFERENCES public.supplier_types(id) ON DELETE SET NULL;

-- Em finance_entries: adicionar finance_entry_type_id
ALTER TABLE public.finance_entries ADD COLUMN IF NOT EXISTS finance_entry_type_id UUID REFERENCES public.finance_entry_types(id) ON DELETE SET NULL;

-- =============================================
-- FASE 3: RLS Policies
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE public.purchase_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_entry_types ENABLE ROW LEVEL SECURITY;

-- Purchase Types RLS
CREATE POLICY "Users can view purchase types of their tenant"
  ON public.purchase_types FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create purchase types for their tenant"
  ON public.purchase_types FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update purchase types of their tenant"
  ON public.purchase_types FOR UPDATE
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete purchase types of their tenant"
  ON public.purchase_types FOR DELETE
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

-- Supplier Types RLS
CREATE POLICY "Users can view supplier types of their tenant"
  ON public.supplier_types FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create supplier types for their tenant"
  ON public.supplier_types FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update supplier types of their tenant"
  ON public.supplier_types FOR UPDATE
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete supplier types of their tenant"
  ON public.supplier_types FOR DELETE
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

-- Finance Entry Types RLS
CREATE POLICY "Users can view finance entry types of their tenant"
  ON public.finance_entry_types FOR SELECT
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create finance entry types for their tenant"
  ON public.finance_entry_types FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update finance entry types of their tenant"
  ON public.finance_entry_types FOR UPDATE
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete finance entry types of their tenant"
  ON public.finance_entry_types FOR DELETE
  USING (
    tenant_id IN (
      SELECT ur.tenant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
    )
  );

-- =============================================
-- FASE 4: Triggers para updated_at
-- =============================================

CREATE TRIGGER update_purchase_types_updated_at
  BEFORE UPDATE ON public.purchase_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_types_updated_at
  BEFORE UPDATE ON public.supplier_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finance_entry_types_updated_at
  BEFORE UPDATE ON public.finance_entry_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FASE 5: Índices para performance
-- =============================================

CREATE INDEX IF NOT EXISTS idx_purchase_types_tenant ON public.purchase_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_types_tenant ON public.supplier_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_finance_entry_types_tenant ON public.finance_entry_types(tenant_id);
CREATE INDEX IF NOT EXISTS idx_finance_entry_types_entry_type ON public.finance_entry_types(tenant_id, entry_type);

CREATE INDEX IF NOT EXISTS idx_purchases_type ON public.purchases(purchase_type_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON public.suppliers(supplier_type_id);
CREATE INDEX IF NOT EXISTS idx_finance_entries_type_id ON public.finance_entries(finance_entry_type_id);