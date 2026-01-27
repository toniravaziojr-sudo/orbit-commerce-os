-- Recreate suppliers and supplier_types tables for the Purchases module
-- These are needed for the ERP Purchases functionality

-- Supplier Types table
CREATE TABLE IF NOT EXISTS public.supplier_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplier_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies for supplier_types
CREATE POLICY "Tenant users can view supplier types" ON public.supplier_types
  FOR SELECT USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can insert supplier types" ON public.supplier_types
  FOR INSERT WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can update supplier types" ON public.supplier_types
  FOR UPDATE USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can delete supplier types" ON public.supplier_types
  FOR DELETE USING (public.user_has_tenant_access(tenant_id));

-- Suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  supplier_type_id UUID REFERENCES public.supplier_types(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Tenant users can view suppliers" ON public.suppliers
  FOR SELECT USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can insert suppliers" ON public.suppliers
  FOR INSERT WITH CHECK (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can update suppliers" ON public.suppliers
  FOR UPDATE USING (public.user_has_tenant_access(tenant_id));

CREATE POLICY "Tenant users can delete suppliers" ON public.suppliers
  FOR DELETE USING (public.user_has_tenant_access(tenant_id));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON public.suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_supplier_types_tenant_id ON public.supplier_types(tenant_id);

-- Create trigger for updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_types_updated_at
  BEFORE UPDATE ON public.supplier_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();