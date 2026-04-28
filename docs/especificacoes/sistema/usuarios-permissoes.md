# Usuários e Permissões (RBAC) — Regras e Especificações

> **STATUS:** ✅ Ready (validado)

> **Camada:** Layer 3 — Especificações / Sistema  
> **Migrado de:** `docs/regras/usuarios-permissoes.md`  
> **Última atualização:** 2026-04-03


## Visão Geral

Sistema de controle de acesso baseado em roles (RBAC) para gerenciamento de equipes dentro de cada tenant.

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/SystemUsers.tsx` | Página de gestão de usuários |
| `src/config/rbac-modules.ts` | Configuração RBAC (rotas, módulos, presets) |
| `src/hooks/usePermissions.ts` | Hook de verificação de permissões |
| `src/components/users/InviteUserModal.tsx` | Modal de convite |
| `src/components/users/EditUserModal.tsx` | Modal de edição |
| `supabase/functions/tenant-user-invite/` | Edge function de convite |
| `supabase/functions/tenant-user-update/` | Edge function de atualização |

---

## Roles do Sistema

| Role | Descrição | Acesso |
|------|-----------|--------|
| `owner` | Proprietário do tenant | Acesso total, único que gerencia usuários |
| `admin` | Administrador | Acesso amplo (não usa mais, migrado para user_type) |
| `operator` | Operador | Legado |
| `support` | Suporte | Legado |
| `finance` | Financeiro | Legado |
| `viewer` | Visualizador | Apenas leitura |

---

## User Types (Presets de Permissão)

| User Type | Label | Descrição |
|-----------|-------|-----------|
| `owner` | Proprietário | Acesso total automático |
| `manager` | Gerente | Todas as áreas exceto gestão de usuários |
| `editor` | Editor | Produtos, categorias, loja online, mídia |
| `attendant` | Atendente | Pedidos, clientes, atendimento |
| `assistant` | Auxiliar | Pedidos (só visualização), suporte |
| `viewer` | Visualizador | Apenas leitura em áreas permitidas |

---

## Estrutura de Permissões

```typescript
// Formato do objeto permissions
{
  ecommerce: true, // módulo inteiro
  // OU
  ecommerce: {
    orders: true,
    products: true,
    categories: false,
    customers: true,
  },
  storefront: true,
  marketing: {
    offers: true,
    reviews: true,
  },
  // ... outros módulos
}
```

---

## Módulos RBAC

| Módulo | Submódulos |
|--------|------------|
| `ecommerce` | orders, products, categories, customers, discounts, abandoned-checkouts |
| `storefront` | storefront, menus, pages, blog |
| `marketing` | integrations, attribution, email-marketing, offers, reviews, media, campaigns |
| `crm` | notifications, support, emails |
| `erp` | fiscal, finance, purchases, shipping |
| `partnerships` | influencers, affiliates |
| `marketplaces` | mercadolivre |
| `system` | integrations, import, files, settings, users (owner only) |

---

## Regras de Acesso

| Regra | Descrição |
|-------|-----------|
| **Owner only** | `/system/users` só acessível pelo owner |
| **Platform routes** | `/platform/*` só para platform operators |
| **Default deny** | Rotas não mapeadas em `ROUTE_TO_PERMISSION` são bloqueadas |
| **Whitelisted** | `/`, `/command-center`, `/account/*`, `/getting-started` sempre acessíveis |

---

## Admin Mode (Platform Operators)

Platform operators têm acesso a um toggle de contexto no header:

| Modo | Descrição | Sidebar |
|------|-----------|---------|
| **Plataforma** | Administração do app.comandocentral.com.br | Módulos de admin |
| **Minha Loja** | Ferramentas de cliente para comandocentral.com.br | Módulos de cliente |

### Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/contexts/AdminModeContext.tsx` | Context de Admin Mode |
| `src/components/layout/AdminModeToggle.tsx` | Toggle UI |
| `src/hooks/usePlatformOperator.ts` | Verificação de platform admin |

### Regras

| Regra | Descrição |
|-------|-----------|
| **Acesso** | Apenas platform operators (tabela `platform_admins`) |
| **Persistência** | `localStorage` key `admin-mode-preference` |
| **Fallback** | Não-admins sempre em modo "store" |

---

## Fluxo de Convite

```
1. Owner clica "Convidar Usuário"
2. Preenche email, user_type, permissões
3. Frontend chama edge function `tenant-user-invite`
4. Edge function:
   - Cria entrada em `tenant_user_invitations`
   - Envia email com link (token)
5. Usuário clica no link
6. Sistema redireciona para `/accept-invite`
7. AcceptInvite.tsx processa:
   - Se usuário existe: cria user_role
   - Se não existe: cria conta + user_role
8. Convite marcado como aceito
```

---

## Tabelas do Banco

### `user_roles`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| user_id | uuid | FK para auth.users |
| tenant_id | uuid | FK para tenants |
| role | text | 'owner', 'admin', etc |
| user_type | text | 'manager', 'editor', etc |
| permissions | jsonb | Objeto de permissões |
| created_at | timestamptz | Data de criação |

### `tenant_user_invitations`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| tenant_id | uuid | FK para tenants |
| email | text | Email do convidado |
| user_type | text | Tipo de usuário |
| permissions | jsonb | Permissões |
| token | text | Token único |
| expires_at | timestamptz | Expiração |
| accepted_at | timestamptz | Quando aceito |
| revoked_at | timestamptz | Quando revogado |

---

## Hooks Principais

### `usePermissions()`
```typescript
const { 
  isOwner,           // boolean
  userType,          // 'owner' | 'manager' | etc
  permissions,       // objeto ou null (owner)
  canAccess,         // (module, submodule?) => boolean
  canAccessRoute,    // (route) => boolean
  isSidebarItemVisible, // (href) => boolean
} = usePermissions();
```

---

## Proibições

| Proibido | Motivo |
|----------|--------|
| Não-owner acessar `/system/users` | Segurança |
| Bypass de `canAccessRoute()` | Controle de acesso |
| Criar roles fora do fluxo de convite | RLS/Segurança |
| Editar own role | Auto-elevação |

---

## Fluxo de Login (Autenticação Inicial)

### Pontos de Entrada
- **Rota:** `/auth` (componente `src/pages/Auth.tsx`)
- **Modos:** Login por e-mail/senha, Cadastro por e-mail/senha, Google OAuth (login e signup), Recuperação de senha (`/auth/reset-password`).
- **Hook único:** `useAuth` (`src/hooks/useAuth.tsx`) é a **fonte de verdade** para todas as operações de autenticação. Componentes de UI **não** podem chamar `supabase.auth.signInWithOAuth` diretamente.

### Fluxo Google OAuth (Emissor → Receptor)
1. **Emissor** (`Auth.tsx`): usuário clica em "Continuar com Google" → chama `useAuth().signInWithGoogle(intent)`.
2. `useAuth.signInWithGoogle`:
   - Marca sinal persistente `oauth_in_progress` em `localStorage` com timestamp (TTL de segurança: 60s).
   - Dispara `supabase.auth.signInWithOAuth({ provider: 'google', redirectTo })`.
3. **Redirecionamento externo** para Google → callback de volta em `/auth#access_token=...`.
4. **Receptor** (`Auth.tsx` + `ProtectedRoute.tsx` no remount):
   - Enquanto `isOAuthInProgress()` for `true`, ambos exibem **loader visual** e **bloqueiam o render** do formulário de login e de qualquer rota protegida.
   - `useAuth` detecta `onAuthStateChange('SIGNED_IN')`, hidrata sessão/tenant/roles, registra auditoria de login (provedor `google`) e chama `clearOAuthInProgress()`.
5. Concluído o bootstrap, `ProtectedRoute` libera a rota destino (ex.: `/command-center`).

### Regras Anti-Flicker (obrigatórias)
- Toda tela envolvida em redirect OAuth (emissor + receptor) deve respeitar `isOAuthInProgress()` como **gate de loader**, mantendo o loader visível até a conclusão do bootstrap.
- O sinal `oauth_in_progress` é limpo deterministicamente em: sucesso (`SIGNED_IN`), erro de OAuth, ou expiração do TTL de 60s.
- **Proibido**: chamar `supabase.auth.signInWithOAuth` fora do `useAuth`; esconder loader baseado apenas em `authLoading` durante callback OAuth.

### Auditoria de Login
- Todo evento `SIGNED_IN` é registrado via `onAuthStateChange` no `useAuth`, incluindo o provedor (`email` ou `google`). Ver constraint `mem://constraints/oauth-login-audit-via-onauthstatechange`.

### Padrões Aplicados (referência)
- §4.5 do `docs/tecnico/base-de-conhecimento-tecnico.md` — Loader/Wizard Guard no receptor de fluxos por URL.
- §10.6 — Stable Latch sobrevivendo a remounts via `localStorage`.
- `mem://constraints/oauth-callback-visual-loader-required` — gate visual obrigatório.

---

## Checklist de Implementação

- [x] Página de gestão de usuários
- [x] Modal de convite com RBAC
- [x] Modal de edição de permissões
- [x] Edge functions de convite/update
- [x] Hook usePermissions
- [x] Visibilidade do sidebar por permissão
- [x] Presets de user_type
- [ ] Logs de auditoria de permissões
