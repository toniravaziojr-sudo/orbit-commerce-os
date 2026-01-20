-- =============================================
-- MVP Email Marketing + Tags + Quizz Integration
-- =============================================

-- 1) Adicionar coluna tag_id nas listas de email marketing (vínculo canônico com customer_tags)
ALTER TABLE public.email_marketing_lists 
ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES public.customer_tags(id) ON DELETE SET NULL;

-- 2) Adicionar colunas extras na tabela de subscribers para sincronizar com customers
ALTER TABLE public.email_marketing_subscribers
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_from TEXT DEFAULT 'manual'; -- manual, form, popup, quiz, checkout, import

-- 3) Criar índice para busca rápida por customer_id
CREATE INDEX IF NOT EXISTS idx_email_marketing_subscribers_customer_id 
ON public.email_marketing_subscribers(customer_id) WHERE customer_id IS NOT NULL;

-- 4) Criar índice para busca por tag_id nas listas
CREATE INDEX IF NOT EXISTS idx_email_marketing_lists_tag_id 
ON public.email_marketing_lists(tag_id) WHERE tag_id IS NOT NULL;

-- 5) Adicionar coluna tag_id no quizzes para integração direta com tags (além de list_id)
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES public.customer_tags(id) ON DELETE SET NULL;

-- 6) Criar tabela para configuração de popups de newsletter por página
CREATE TABLE IF NOT EXISTS public.newsletter_popup_configs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    list_id UUID REFERENCES public.email_marketing_lists(id) ON DELETE SET NULL,
    
    -- Configurações visuais
    layout TEXT NOT NULL DEFAULT 'centered', -- centered, side-image, corner, fullscreen
    title TEXT NOT NULL DEFAULT 'Inscreva-se na nossa newsletter',
    subtitle TEXT,
    success_message TEXT DEFAULT 'Obrigado por se inscrever!',
    button_text TEXT DEFAULT 'Inscrever',
    
    -- Campos habilitados
    show_name BOOLEAN DEFAULT true,
    show_phone BOOLEAN DEFAULT false,
    show_birth_date BOOLEAN DEFAULT false,
    name_required BOOLEAN DEFAULT false,
    phone_required BOOLEAN DEFAULT false,
    birth_date_required BOOLEAN DEFAULT false,
    
    -- Estilo
    background_color TEXT DEFAULT '#ffffff',
    text_color TEXT DEFAULT '#000000',
    button_bg_color TEXT DEFAULT '#3b82f6',
    button_text_color TEXT DEFAULT '#ffffff',
    image_url TEXT,
    
    -- Trigger
    trigger_type TEXT NOT NULL DEFAULT 'delay', -- delay, scroll, exit_intent, immediate
    trigger_delay_seconds INTEGER DEFAULT 5,
    trigger_scroll_percent INTEGER DEFAULT 50,
    
    -- Onde exibir (para popup global)
    show_on_pages TEXT[] DEFAULT ARRAY['home', 'category', 'product']::TEXT[],
    exclude_pages TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Controle
    is_active BOOLEAN DEFAULT true,
    show_once_per_session BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS para newsletter_popup_configs
ALTER TABLE public.newsletter_popup_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for newsletter_popup_configs"
ON public.newsletter_popup_configs
FOR ALL
USING (tenant_id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Public read newsletter_popup_configs"
ON public.newsletter_popup_configs
FOR SELECT
USING (is_active = true);

-- 7) Adicionar unique constraint em email_marketing_list_members se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'email_marketing_list_members_unique'
    ) THEN
        ALTER TABLE public.email_marketing_list_members 
        ADD CONSTRAINT email_marketing_list_members_unique 
        UNIQUE (tenant_id, list_id, subscriber_id);
    END IF;
EXCEPTION WHEN others THEN
    -- Constraint já pode existir com outro nome
    NULL;
END $$;

-- 8) Criar função para sincronizar subscriber com customer e aplicar tag
CREATE OR REPLACE FUNCTION public.sync_subscriber_to_customer_with_tag(
    p_tenant_id UUID,
    p_email TEXT,
    p_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_birth_date DATE DEFAULT NULL,
    p_source TEXT DEFAULT 'form',
    p_list_id UUID DEFAULT NULL
) RETURNS TABLE (
    subscriber_id UUID,
    customer_id UUID,
    is_new_subscriber BOOLEAN,
    is_new_customer BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_subscriber_id UUID;
    v_customer_id UUID;
    v_is_new_subscriber BOOLEAN := false;
    v_is_new_customer BOOLEAN := false;
    v_tag_id UUID;
    v_normalized_email TEXT;
BEGIN
    -- Normalizar email
    v_normalized_email := LOWER(TRIM(p_email));
    
    -- 1) Buscar ou criar subscriber
    SELECT id INTO v_subscriber_id
    FROM email_marketing_subscribers
    WHERE tenant_id = p_tenant_id AND email = v_normalized_email;
    
    IF v_subscriber_id IS NULL THEN
        INSERT INTO email_marketing_subscribers (
            tenant_id, email, name, phone, source, created_from, status
        ) VALUES (
            p_tenant_id, v_normalized_email, p_name, p_phone, p_source, p_source, 'active'
        ) RETURNING id INTO v_subscriber_id;
        v_is_new_subscriber := true;
    ELSE
        -- Atualizar dados se fornecidos
        UPDATE email_marketing_subscribers
        SET 
            name = COALESCE(p_name, name),
            phone = COALESCE(p_phone, phone),
            birth_date = COALESCE(p_birth_date, birth_date),
            updated_at = now()
        WHERE id = v_subscriber_id;
    END IF;
    
    -- 2) Buscar ou criar customer
    SELECT id INTO v_customer_id
    FROM customers
    WHERE tenant_id = p_tenant_id AND email = v_normalized_email AND deleted_at IS NULL;
    
    IF v_customer_id IS NULL THEN
        INSERT INTO customers (
            tenant_id, email, full_name, phone, birth_date, status, accepts_email_marketing
        ) VALUES (
            p_tenant_id, v_normalized_email, COALESCE(p_name, v_normalized_email), p_phone, p_birth_date, 'active', true
        ) RETURNING id INTO v_customer_id;
        v_is_new_customer := true;
    ELSE
        -- Atualizar dados se fornecidos
        UPDATE customers
        SET 
            full_name = COALESCE(NULLIF(p_name, ''), full_name),
            phone = COALESCE(p_phone, phone),
            birth_date = COALESCE(p_birth_date, birth_date),
            accepts_email_marketing = true,
            updated_at = now()
        WHERE id = v_customer_id;
    END IF;
    
    -- 3) Linkar subscriber ao customer
    UPDATE email_marketing_subscribers
    SET customer_id = v_customer_id
    WHERE id = v_subscriber_id AND customer_id IS NULL;
    
    -- 4) Se houver list_id, adicionar à lista e aplicar tag
    IF p_list_id IS NOT NULL THEN
        -- Adicionar à lista
        INSERT INTO email_marketing_list_members (tenant_id, list_id, subscriber_id)
        VALUES (p_tenant_id, p_list_id, v_subscriber_id)
        ON CONFLICT DO NOTHING;
        
        -- Buscar tag_id da lista
        SELECT tag_id INTO v_tag_id
        FROM email_marketing_lists
        WHERE id = p_list_id;
        
        -- Aplicar tag ao customer se existir
        IF v_tag_id IS NOT NULL AND v_customer_id IS NOT NULL THEN
            INSERT INTO customer_tag_assignments (customer_id, tag_id)
            VALUES (v_customer_id, v_tag_id)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    
    RETURN QUERY SELECT v_subscriber_id, v_customer_id, v_is_new_subscriber, v_is_new_customer;
END;
$$;

-- 9) Criar função para contar membros da lista (derivado por tag)
CREATE OR REPLACE FUNCTION public.get_list_member_count(p_list_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
    SELECT COUNT(DISTINCT subscriber_id)::INTEGER
    FROM email_marketing_list_members
    WHERE list_id = p_list_id;
$$;

-- 10) Criar função para buscar contatos de uma lista via tag
CREATE OR REPLACE FUNCTION public.get_list_contacts_by_tag(p_list_id UUID)
RETURNS TABLE (
    customer_id UUID,
    email TEXT,
    full_name TEXT,
    phone TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
    SELECT DISTINCT c.id, c.email, c.full_name, c.phone
    FROM customers c
    JOIN customer_tag_assignments cta ON cta.customer_id = c.id
    JOIN email_marketing_lists l ON l.tag_id = cta.tag_id
    WHERE l.id = p_list_id
      AND c.deleted_at IS NULL
      AND c.accepts_email_marketing = true
    ORDER BY c.full_name;
$$;

-- 11) Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_newsletter_popup_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_newsletter_popup_configs_updated_at ON public.newsletter_popup_configs;
CREATE TRIGGER trg_newsletter_popup_configs_updated_at
    BEFORE UPDATE ON public.newsletter_popup_configs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_newsletter_popup_configs_updated_at();