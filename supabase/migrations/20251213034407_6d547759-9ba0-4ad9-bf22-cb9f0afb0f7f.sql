
-- =============================================
-- FASE 2: Auth + Multi-tenant + RBAC
-- =============================================

-- 1. Enum para roles
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'operator', 'support', 'finance', 'viewer');

-- 2. Tabela de Lojas (tenants)
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela de Perfis (profiles)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    current_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Tabela de Roles (RBAC - separada de profiles por segurança)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, tenant_id, role)
);

-- 5. Tabela de Convites
CREATE TABLE public.tenant_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role app_role NOT NULL DEFAULT 'viewer',
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

-- =============================================
-- FUNÇÕES AUXILIARES
-- =============================================

-- Função para verificar role (SECURITY DEFINER para evitar recursão RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _tenant_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND tenant_id = _tenant_id
          AND role = _role
    )
$$;

-- Função para verificar se usuário pertence ao tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND tenant_id = _tenant_id
    )
$$;

-- Função para obter tenant atual do usuário
CREATE OR REPLACE FUNCTION public.get_current_tenant_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT current_tenant_id
    FROM public.profiles
    WHERE id = _user_id
$$;

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
    );
    RETURN NEW;
END;
$$;

-- Trigger para criar perfil ao registrar
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Triggers de updated_at
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Habilitar RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

-- Políticas para PROFILES
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid());

-- Políticas para TENANTS
CREATE POLICY "Users can view tenants they belong to"
    ON public.tenants FOR SELECT
    TO authenticated
    USING (public.user_belongs_to_tenant(auth.uid(), id));

CREATE POLICY "Users can create tenants"
    ON public.tenants FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Owners and admins can update tenant"
    ON public.tenants FOR UPDATE
    TO authenticated
    USING (
        public.has_role(auth.uid(), id, 'owner') OR 
        public.has_role(auth.uid(), id, 'admin')
    );

-- Políticas para USER_ROLES
CREATE POLICY "Users can view roles in their tenants"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (public.user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "System can insert roles"
    ON public.user_roles FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Owners can manage roles"
    ON public.user_roles FOR DELETE
    TO authenticated
    USING (public.has_role(auth.uid(), tenant_id, 'owner'));

-- Políticas para TENANT_INVITES
CREATE POLICY "Users can view invites for their tenants"
    ON public.tenant_invites FOR SELECT
    TO authenticated
    USING (
        public.has_role(auth.uid(), tenant_id, 'owner') OR
        public.has_role(auth.uid(), tenant_id, 'admin') OR
        email = (SELECT email FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Owners and admins can create invites"
    ON public.tenant_invites FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_role(auth.uid(), tenant_id, 'owner') OR
        public.has_role(auth.uid(), tenant_id, 'admin')
    );

CREATE POLICY "Owners and admins can delete invites"
    ON public.tenant_invites FOR DELETE
    TO authenticated
    USING (
        public.has_role(auth.uid(), tenant_id, 'owner') OR
        public.has_role(auth.uid(), tenant_id, 'admin')
    );

CREATE POLICY "Users can update invites they received"
    ON public.tenant_invites FOR UPDATE
    TO authenticated
    USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_tenant_id ON public.user_roles(tenant_id);
CREATE INDEX idx_tenant_invites_email ON public.tenant_invites(email);
CREATE INDEX idx_tenant_invites_token ON public.tenant_invites(token);
CREATE INDEX idx_profiles_current_tenant ON public.profiles(current_tenant_id);
