-- =============================================
-- CUSTOMERS MODULE - Compradores da loja virtual
-- =============================================

-- Tabela principal de clientes
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Autenticação (opcional - visitantes não têm)
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Dados pessoais
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    cpf TEXT,
    phone TEXT,
    birth_date DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'not_informed')),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    accepts_marketing BOOLEAN DEFAULT true,
    
    -- Métricas (atualizadas via triggers)
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    average_ticket NUMERIC(12,2) DEFAULT 0,
    last_order_at TIMESTAMP WITH TIME ZONE,
    
    -- Fidelidade
    loyalty_points INTEGER DEFAULT 0,
    loyalty_tier TEXT DEFAULT 'bronze' CHECK (loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Constraints
    UNIQUE(tenant_id, email),
    UNIQUE(tenant_id, cpf)
);

-- Índices
CREATE INDEX idx_customers_tenant ON public.customers(tenant_id);
CREATE INDEX idx_customers_email ON public.customers(email);
CREATE INDEX idx_customers_cpf ON public.customers(cpf);
CREATE INDEX idx_customers_auth_user ON public.customers(auth_user_id);
CREATE INDEX idx_customers_status ON public.customers(tenant_id, status);

-- RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customers of their tenants"
ON public.customers FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can insert customers"
ON public.customers FOR INSERT
WITH CHECK (
    has_role(auth.uid(), tenant_id, 'owner') OR
    has_role(auth.uid(), tenant_id, 'admin') OR
    has_role(auth.uid(), tenant_id, 'operator')
);

CREATE POLICY "Admins can update customers"
ON public.customers FOR UPDATE
USING (
    has_role(auth.uid(), tenant_id, 'owner') OR
    has_role(auth.uid(), tenant_id, 'admin') OR
    has_role(auth.uid(), tenant_id, 'operator')
);

CREATE POLICY "Admins can delete customers"
ON public.customers FOR DELETE
USING (
    has_role(auth.uid(), tenant_id, 'owner') OR
    has_role(auth.uid(), tenant_id, 'admin')
);

-- Trigger para updated_at
CREATE TRIGGER update_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ENDEREÇOS DOS CLIENTES
-- =============================================

CREATE TABLE public.customer_addresses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    
    -- Identificação
    label TEXT NOT NULL DEFAULT 'Casa', -- Casa, Trabalho, etc.
    is_default BOOLEAN DEFAULT false,
    
    -- Endereço
    recipient_name TEXT NOT NULL,
    street TEXT NOT NULL,
    number TEXT NOT NULL,
    complement TEXT,
    neighborhood TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT NOT NULL DEFAULT 'BR',
    
    -- Referência para entrega
    reference TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_customer_addresses_customer ON public.customer_addresses(customer_id);

-- RLS
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer addresses"
ON public.customer_addresses FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_addresses.customer_id
        AND user_belongs_to_tenant(auth.uid(), c.tenant_id)
    )
);

CREATE POLICY "Admins can manage customer addresses"
ON public.customer_addresses FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_addresses.customer_id
        AND (
            has_role(auth.uid(), c.tenant_id, 'owner') OR
            has_role(auth.uid(), c.tenant_id, 'admin') OR
            has_role(auth.uid(), c.tenant_id, 'operator')
        )
    )
);

-- Trigger para updated_at
CREATE TRIGGER update_customer_addresses_updated_at
    BEFORE UPDATE ON public.customer_addresses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- TAGS DE CLIENTES (Segmentação)
-- =============================================

CREATE TABLE public.customer_tags (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    UNIQUE(tenant_id, name)
);

-- RLS
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer tags"
ON public.customer_tags FOR SELECT
USING (user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins can manage customer tags"
ON public.customer_tags FOR ALL
USING (
    has_role(auth.uid(), tenant_id, 'owner') OR
    has_role(auth.uid(), tenant_id, 'admin') OR
    has_role(auth.uid(), tenant_id, 'operator')
);

-- Tabela de relacionamento customer <-> tags
CREATE TABLE public.customer_tag_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id),
    
    UNIQUE(customer_id, tag_id)
);

-- RLS
ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer tag assignments"
ON public.customer_tag_assignments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_tag_assignments.customer_id
        AND user_belongs_to_tenant(auth.uid(), c.tenant_id)
    )
);

CREATE POLICY "Admins can manage customer tag assignments"
ON public.customer_tag_assignments FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_tag_assignments.customer_id
        AND (
            has_role(auth.uid(), c.tenant_id, 'owner') OR
            has_role(auth.uid(), c.tenant_id, 'admin') OR
            has_role(auth.uid(), c.tenant_id, 'operator')
        )
    )
);

-- =============================================
-- NOTAS INTERNAS DE CLIENTES
-- =============================================

CREATE TABLE public.customer_notes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_customer_notes_customer ON public.customer_notes(customer_id);

-- RLS
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer notes"
ON public.customer_notes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_notes.customer_id
        AND user_belongs_to_tenant(auth.uid(), c.tenant_id)
    )
);

CREATE POLICY "Users can create customer notes"
ON public.customer_notes FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_notes.customer_id
        AND user_belongs_to_tenant(auth.uid(), c.tenant_id)
    )
    AND author_id = auth.uid()
);

CREATE POLICY "Authors can update their notes"
ON public.customer_notes FOR UPDATE
USING (author_id = auth.uid());

CREATE POLICY "Authors and admins can delete notes"
ON public.customer_notes FOR DELETE
USING (
    author_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_notes.customer_id
        AND (
            has_role(auth.uid(), c.tenant_id, 'owner') OR
            has_role(auth.uid(), c.tenant_id, 'admin')
        )
    )
);

-- Trigger para updated_at
CREATE TRIGGER update_customer_notes_updated_at
    BEFORE UPDATE ON public.customer_notes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- HISTÓRICO DE NOTIFICAÇÕES
-- =============================================

CREATE TABLE public.customer_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    
    -- Tipo de notificação
    type TEXT NOT NULL CHECK (type IN (
        'abandoned_cart',
        'order_confirmation', 
        'order_shipped',
        'order_delivered',
        'review_request',
        'birthday',
        'loyalty_reward',
        'campaign',
        'custom'
    )),
    
    -- Canal
    channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp', 'push')),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'clicked')),
    
    -- Conteúdo
    subject TEXT,
    content TEXT,
    template_id TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Tracking
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_customer_notifications_customer ON public.customer_notifications(customer_id);
CREATE INDEX idx_customer_notifications_type ON public.customer_notifications(type);
CREATE INDEX idx_customer_notifications_status ON public.customer_notifications(status);
CREATE INDEX idx_customer_notifications_created ON public.customer_notifications(created_at DESC);

-- RLS
ALTER TABLE public.customer_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer notifications"
ON public.customer_notifications FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_notifications.customer_id
        AND user_belongs_to_tenant(auth.uid(), c.tenant_id)
    )
);

CREATE POLICY "System can manage notifications"
ON public.customer_notifications FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.customers c
        WHERE c.id = customer_notifications.customer_id
        AND (
            has_role(auth.uid(), c.tenant_id, 'owner') OR
            has_role(auth.uid(), c.tenant_id, 'admin') OR
            has_role(auth.uid(), c.tenant_id, 'operator')
        )
    )
);