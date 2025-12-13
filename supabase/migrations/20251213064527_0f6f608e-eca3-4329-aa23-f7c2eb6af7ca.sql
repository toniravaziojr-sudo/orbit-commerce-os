-- Create order status enum
CREATE TYPE public.order_status AS ENUM (
  'pending',
  'awaiting_payment',
  'paid',
  'processing',
  'shipped',
  'in_transit',
  'delivered',
  'cancelled',
  'returned'
);

-- Create payment method enum
CREATE TYPE public.payment_method AS ENUM (
  'pix',
  'credit_card',
  'debit_card',
  'boleto',
  'mercado_pago',
  'pagarme'
);

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'processing',
  'approved',
  'declined',
  'refunded',
  'cancelled'
);

-- Create shipping status enum
CREATE TYPE public.shipping_status AS ENUM (
  'pending',
  'processing',
  'shipped',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'returned',
  'failed'
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  
  -- Order number (human readable)
  order_number TEXT NOT NULL,
  
  -- Status
  status order_status NOT NULL DEFAULT 'pending',
  
  -- Totals
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Payment info
  payment_method payment_method,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  payment_gateway TEXT, -- 'mercado_pago' or 'pagarme'
  payment_gateway_id TEXT, -- ID from payment gateway
  paid_at TIMESTAMP WITH TIME ZONE,
  
  -- Shipping info
  shipping_status shipping_status NOT NULL DEFAULT 'pending',
  shipping_carrier TEXT,
  tracking_code TEXT,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  
  -- Customer info (snapshot)
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  
  -- Shipping address (snapshot)
  shipping_street TEXT,
  shipping_number TEXT,
  shipping_complement TEXT,
  shipping_neighborhood TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT DEFAULT 'BR',
  
  -- Billing address (snapshot)
  billing_street TEXT,
  billing_number TEXT,
  billing_complement TEXT,
  billing_neighborhood TEXT,
  billing_city TEXT,
  billing_state TEXT,
  billing_postal_code TEXT,
  billing_country TEXT DEFAULT 'BR',
  
  -- Notes
  customer_notes TEXT,
  internal_notes TEXT,
  
  -- Cancellation
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  
  -- Product info (snapshot)
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_image_url TEXT,
  
  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_history table (for audit trail)
CREATE TABLE public.order_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  author_id UUID,
  
  -- Change info
  action TEXT NOT NULL, -- 'status_changed', 'payment_updated', 'shipping_updated', 'note_added', etc
  previous_value JSONB,
  new_value JSONB,
  description TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_orders_tenant_id ON public.orders(tenant_id);
CREATE INDEX idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_order_number ON public.orders(order_number);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX idx_order_history_order_id ON public.order_history(order_id);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_history ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Users can view orders of their tenants"
  ON public.orders FOR SELECT
  USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert orders"
  ON public.orders FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin') OR 
    has_role(auth.uid(), tenant_id, 'operator')
  );

CREATE POLICY "Admins can update orders"
  ON public.orders FOR UPDATE
  USING (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin') OR 
    has_role(auth.uid(), tenant_id, 'operator')
  );

CREATE POLICY "Admins can delete orders"
  ON public.orders FOR DELETE
  USING (
    has_role(auth.uid(), tenant_id, 'owner') OR 
    has_role(auth.uid(), tenant_id, 'admin')
  );

-- Order items policies
CREATE POLICY "Users can view order_items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.id = order_items.order_id 
      AND user_belongs_to_tenant(auth.uid(), o.tenant_id)
    )
  );

CREATE POLICY "Admins can manage order_items"
  ON public.order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.id = order_items.order_id 
      AND (
        has_role(auth.uid(), o.tenant_id, 'owner') OR 
        has_role(auth.uid(), o.tenant_id, 'admin') OR 
        has_role(auth.uid(), o.tenant_id, 'operator')
      )
    )
  );

-- Order history policies
CREATE POLICY "Users can view order_history"
  ON public.order_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.id = order_history.order_id 
      AND user_belongs_to_tenant(auth.uid(), o.tenant_id)
    )
  );

CREATE POLICY "Admins can insert order_history"
  ON public.order_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o 
      WHERE o.id = order_history.order_id 
      AND (
        has_role(auth.uid(), o.tenant_id, 'owner') OR 
        has_role(auth.uid(), o.tenant_id, 'admin') OR 
        has_role(auth.uid(), o.tenant_id, 'operator') OR
        has_role(auth.uid(), o.tenant_id, 'support')
      )
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_year TEXT;
  v_number TEXT;
BEGIN
  v_year := to_char(now(), 'YY');
  
  SELECT COUNT(*) + 1 INTO v_count
  FROM public.orders
  WHERE tenant_id = p_tenant_id
    AND created_at >= date_trunc('year', now());
  
  v_number := LPAD(v_count::TEXT, 6, '0');
  
  RETURN 'PED-' || v_year || '-' || v_number;
END;
$$;