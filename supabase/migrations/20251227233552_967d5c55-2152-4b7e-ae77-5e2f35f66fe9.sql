-- Suppliers table (Fornecedores)
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  contact_person TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchases table (Pedidos de Compra)
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'cancelled')),
  total_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Purchase Items table
CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Finance Entries table (Entradas e Saídas)
CREATE TABLE public.finance_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('order', 'manual')),
  source_id UUID,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers
CREATE POLICY "Users can view their tenant suppliers" ON public.suppliers
  FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert suppliers" ON public.suppliers
  FOR INSERT WITH CHECK (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "Admins can update suppliers" ON public.suppliers
  FOR UPDATE USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "Admins can delete suppliers" ON public.suppliers
  FOR DELETE USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin'));

-- RLS Policies for purchases
CREATE POLICY "Users can view their tenant purchases" ON public.purchases
  FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert purchases" ON public.purchases
  FOR INSERT WITH CHECK (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "Admins can update purchases" ON public.purchases
  FOR UPDATE USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "Admins can delete purchases" ON public.purchases
  FOR DELETE USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin'));

-- RLS Policies for purchase_items
CREATE POLICY "Users can view their tenant purchase items" ON public.purchase_items
  FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert purchase items" ON public.purchase_items
  FOR INSERT WITH CHECK (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "Admins can update purchase items" ON public.purchase_items
  FOR UPDATE USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "Admins can delete purchase items" ON public.purchase_items
  FOR DELETE USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin'));

-- RLS Policies for finance_entries
CREATE POLICY "Users can view their tenant finance entries" ON public.finance_entries
  FOR SELECT USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert finance entries" ON public.finance_entries
  FOR INSERT WITH CHECK (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "Admins can update finance entries" ON public.finance_entries
  FOR UPDATE USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin') OR has_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "Admins can delete finance entries" ON public.finance_entries
  FOR DELETE USING (has_role(auth.uid(), tenant_id, 'owner') OR has_role(auth.uid(), tenant_id, 'admin'));

-- Indexes for performance
CREATE INDEX idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX idx_purchases_tenant ON public.purchases(tenant_id);
CREATE INDEX idx_purchases_supplier ON public.purchases(supplier_id);
CREATE INDEX idx_purchases_status ON public.purchases(status);
CREATE INDEX idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX idx_finance_entries_tenant ON public.finance_entries(tenant_id);
CREATE INDEX idx_finance_entries_type ON public.finance_entries(type);
CREATE INDEX idx_finance_entries_date ON public.finance_entries(entry_date);

-- Triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_finance_entries_updated_at
  BEFORE UPDATE ON public.finance_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();