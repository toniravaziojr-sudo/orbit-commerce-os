# Tenants — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2025-01-19

---

## Visão Geral

O sistema opera em modelo **multi-tenant isolado**, onde cada loja é um tenant independente com dados, configurações e domínios próprios.

---

## Tabela: tenants

```sql
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                      -- Nome da loja
  slug TEXT UNIQUE NOT NULL,               -- Identificador URL-friendly
  plan tenant_plan DEFAULT 'free',         -- Plano atual
  type tenant_type DEFAULT 'default',      -- Tipo de tenant
  logo_url TEXT,                           -- Logo da loja
  settings JSONB,                          -- Configurações flexíveis
  next_order_number INT DEFAULT 1000,      -- Sequência de pedidos
  is_special BOOLEAN DEFAULT false,        -- Tenant especial (testes)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Enums

```sql
CREATE TYPE tenant_plan AS ENUM ('free', 'starter', 'growth', 'scale', 'enterprise');
CREATE TYPE tenant_type AS ENUM ('default', 'platform', 'demo');
```

---

## Tenants de Referência

| Tenant | Email | Tenant ID | Propósito |
|--------|-------|-----------|-----------|
| **Super Admin (Platform)** | `toniravaziojr@gmail.com` | - | Administração da plataforma |
| **Tenant Base (respeiteohomem)** | `respeiteohomem@gmail.com` | `d1a4d0ed-8842-495e-b741-540a9a345b25` | Validação de features/layout |

> **SPECIAL ONLY** = Mudança afeta apenas tenant especial, não platform nem outros tenants.

---

## Criação de Tenant

### RPC: create_tenant_for_user

**OBRIGATÓRIO:** Usar RPC, nunca INSERT direto (viola RLS).

```sql
CREATE FUNCTION public.create_tenant_for_user(p_name TEXT, p_slug TEXT)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant public.tenants;
BEGIN
  -- 1. Verificar autenticação
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Verificar slug único
  IF EXISTS (SELECT 1 FROM public.tenants WHERE slug = p_slug) THEN
    RAISE EXCEPTION 'Slug already exists';
  END IF;

  -- 3. Criar tenant
  INSERT INTO public.tenants (name, slug)
  VALUES (p_name, p_slug)
  RETURNING * INTO v_tenant;

  -- 4. Criar role de owner
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (auth.uid(), v_tenant.id, 'owner')
  ON CONFLICT DO NOTHING;

  -- 5. Definir tenant ativo no profile
  UPDATE public.profiles
  SET current_tenant_id = v_tenant.id
  WHERE id = auth.uid();

  RETURN v_tenant;
END;
$$;
```

### Fluxo de Criação Completo

```
1. Usuário faz signup (Auth.tsx)
   ↓
2. Sistema chama create_tenant_for_user(name, slug)
   - Cria registro em tenants
   - Cria user_role (owner)
   - Atualiza profiles.current_tenant_id
   ↓
3. Sistema chama domains-provision-default
   - Cria domínio padrão: {slug}.shops.comandocentral.com.br
   - Define status='verified', ssl_status='active'
   ↓
4. Sistema agenda emails de tutorial
   - schedule-tutorial-email + send-auth-email
   ↓
5. Redirect para dashboard
```

### Frontend: CreateStore.tsx

```typescript
// Chamada via RPC
const { data: newTenant, error } = await supabase
  .rpc('create_tenant_for_user', {
    p_name: data.name,
    p_slug: data.slug,
  });

// Provisionar domínio padrão
await supabase.functions.invoke('domains-provision-default', {
  body: { tenant_id: newTenant.id, tenant_slug: newTenant.slug }
});
```

---

## Isolamento Multi-Tenant

### Regras Fixas

| Regra | Descrição |
|-------|-----------|
| **Tenant-scoped** | TODA operação DEVE ter `tenant_id` |
| **Vazamento proibido** | NUNCA expor dados de um tenant para outro |
| **RLS obrigatório** | Todas tabelas operacionais filtram por `tenant_id` |
| **Validação em Edge Functions** | Sempre validar `tenant_id` do request |

### Padrão RLS

```sql
-- Exemplo: tabela products
CREATE POLICY "Tenant isolation"
ON products
FOR ALL
TO authenticated
USING (tenant_id IN (
  SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
));
```

---

## Settings (JSONB)

O campo `settings` armazena configurações flexíveis por tenant:

```typescript
interface TenantSettings {
  // Configurações de frete
  shipping?: {
    free_shipping_threshold?: number;
    default_processing_days?: number;
  };
  
  // Configurações de checkout
  checkout?: {
    require_cpf?: boolean;
    allow_guest?: boolean;
  };
  
  // Configurações de notificação
  notifications?: {
    order_created_email?: boolean;
    order_shipped_whatsapp?: boolean;
  };
  
  // Configurações visuais
  branding?: {
    primary_color?: string;
    favicon_url?: string;
  };
}
```

---

## Numeração de Pedidos

Cada tenant tem sequência independente via `next_order_number`:

```sql
-- RPC para gerar próximo número
CREATE FUNCTION generate_order_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_number INT;
BEGIN
  UPDATE tenants 
  SET next_order_number = next_order_number + 1
  WHERE id = p_tenant_id
  RETURNING next_order_number INTO v_number;
  
  RETURN '#' || LPAD(v_number::TEXT, 4, '0');
END;
$$;
```

| Tenant | Início | Formato |
|--------|--------|---------|
| Novos tenants | #1000 | #1001, #1002... |
| respeiteohomem | #5000 | #5001, #5002... |

---

## Acesso e Contexto

### profiles.current_tenant_id

Define qual tenant o usuário está operando no momento:

```typescript
// Hook para obter tenant atual
const { currentTenantId, tenant, isLoading } = useTenant();

// Trocar de tenant
await supabase
  .from('profiles')
  .update({ current_tenant_id: newTenantId })
  .eq('id', userId);
```

### user_roles

Vincula usuários a tenants com roles específicas:

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  role app_role NOT NULL,  -- owner, admin, operator, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(user_id, tenant_id, role)
);
```

---

## Resolução de Tenant (Storefront)

O sistema resolve tenant por hostname via `resolve-domain`:

```typescript
// Request
GET /resolve-domain?hostname=loja.cliente.com.br

// Response
{
  "found": true,
  "tenant_id": "uuid",
  "tenant_slug": "minha-loja",
  "domain_type": "custom",
  "canonical_origin": "https://loja.cliente.com.br",
  "primary_public_host": "loja.cliente.com.br"
}
```

### Fluxo de Resolução

```
1. Request chega com hostname
   ↓
2. É subdomínio da plataforma? ({slug}.shops.comandocentral.com.br)
   SIM → Extrai slug, busca tenant por slug
   ↓
3. É domínio customizado?
   SIM → Busca em tenant_domains por domain
   ↓
4. Retorna tenant_id + canonical_origin
```

---

## Hooks do Frontend

### useTenant

```typescript
// src/hooks/useTenant.ts
const {
  currentTenantId,  // UUID do tenant atual
  tenant,           // Objeto tenant completo
  tenants,          // Lista de tenants do usuário
  isLoading,
  switchTenant,     // Trocar de tenant
} = useTenant();
```

### useProfile

```typescript
// src/hooks/useProfile.ts
const {
  profile,          // Profile do usuário
  currentTenantId,  // Derivado de profile
  refreshProfile,   // Recarregar
} = useProfile();
```

---

## Componentes Relacionados

| Componente | Local | Propósito |
|------------|-------|-----------|
| `CreateStore` | `src/pages/CreateStore.tsx` | Formulário de criação |
| `TenantSwitcher` | `src/components/tenant/TenantSwitcher.tsx` | Seletor de tenant |
| `TenantSettings` | `src/pages/Settings.tsx` | Configurações do tenant |

---

## Anti-Patterns (Proibidos)

| Proibido | Correto |
|----------|---------|
| INSERT direto em `tenants` | Usar RPC `create_tenant_for_user` |
| Queries sem `tenant_id` | Sempre filtrar por tenant |
| Hardcode de `tenant_id` | Usar `useTenant()` ou contexto |
| Confiar em `tenant_id` do client | Validar server-side |

---

## Checklist de Validação

- [ ] Toda tabela operacional tem coluna `tenant_id`
- [ ] RLS ativo em todas as tabelas com `tenant_id`
- [ ] Criação via RPC, não INSERT direto
- [ ] Domínio padrão provisionado automaticamente
- [ ] Numeração de pedidos independente por tenant
- [ ] `profiles.current_tenant_id` atualizado no signup
- [ ] Edge Functions validam `tenant_id` do request

---

## Documentação Relacionada

| Arquivo | Conteúdo |
|---------|----------|
| `docs/regras/dominios.md` | Gestão de domínios por tenant |
| `docs/regras/usuarios-permissoes.md` | RBAC e user_roles |
| `docs/regras/regras-gerais.md` | Regras gerais multi-tenant |
| `docs/regras/planos-billing.md` | Planos e limites por tenant |
