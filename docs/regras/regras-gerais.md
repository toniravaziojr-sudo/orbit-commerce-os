# Regras Gerais — Comandos Fundamentais

> **REGRAS NÃO NEGOCIÁVEIS** — Aplicáveis a TODO o sistema.

---

## 🚀 Feature Rollout — Regra de Implementação Gradual

> **REGRA CRÍTICA NÃO NEGOCIÁVEL** — Aplica-se a TODAS as implementações de novos recursos ou alterações em módulos de cliente/usuário.

### Fluxo Obrigatório

| Etapa | Descrição |
|-------|-----------|
| **1. Implementar no Admin** | Toda nova feature/ajuste DEVE ser implementada **PRIMEIRO** e **EXCLUSIVAMENTE** no tenant do usuário admin (`toniravaziojr@gmail.com`) |
| **2. Testar no Admin** | O usuário admin testa a funcionalidade em seu próprio tenant |
| **3. Validar com Usuário** | Aguardar confirmação explícita do usuário: "Pode liberar para os outros" |
| **4. Liberar para Todos** | Só então remover qualquer gate/flag e disponibilizar para todos os tenants |

### Mecanismo de Controle

Para implementar esta regra, usar uma das abordagens:

**Opção A - Feature Flag por Tenant:**
```typescript
// Verificar se é o tenant admin
const isAdminTenant = tenantId === 'cc000000-0000-0000-0000-000000000001';

// Ou verificar se é platform operator em modo store
const { isPlatformOperator } = usePlatformOperator();
const { isStoreMode } = useAdminModeSafe();
const canAccessNewFeature = isPlatformOperator && isStoreMode;
```

**Opção B - Tabela de Feature Flags:**
```sql
-- Verificar em billing_feature_flags ou criar tenant_feature_flags
SELECT is_enabled FROM feature_flags WHERE flag_key = 'youtube_upload' AND tenant_id = ?
```

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Liberar feature nova para todos imediatamente | Implementar primeiro no admin, testar, depois liberar |
| Implementar direto em produção sem gate | Usar feature flag para controlar acesso |
| Assumir que "funciona" sem teste do admin | Aguardar confirmação explícita do usuário |
| Liberar sem comando explícito | Aguardar: "Pode liberar para os outros" |

### Comandos do Usuário

| Comando | Ação |
|---------|------|
| "Implementar X" (sem especificar) | Implementar APENAS no tenant admin |
| "Pode liberar para os outros" | Remover gate e disponibilizar para todos |
| "Liberar X para todos" | Remover gate e disponibilizar para todos |
| "Testar X primeiro" | Implementar no admin com feature flag |

---

## Abordagem Estrutural (Regra Permanente)

Quando um problema/lógica envolver vários componentes (frontend + Edge Functions + banco + RLS + jobs), a correção deve ser feita no **pipeline/lógica global** — não em ajustes item-a-item — para reduzir regressões e retrabalho.

---

## Diagnóstico Obrigatório para Erro Recorrente

Se um erro se repetir mais de 1 vez (mesmo sintoma/rota/stack), **parar "tentativas rápidas"** e instalar diagnóstico antes da próxima correção:

| Diagnóstico | Descrição |
|-------------|-----------|
| **ErrorBoundary** | Na rota afetada com botão "Copiar Diagnóstico" (stack + componentStack + URL + userAgent + timestamp) |
| **Debug Panel** | Opcional via `?debug=1` exibindo: tenant atual, auth state, status/erro das queries, dados mínimos retornados |
| **Logs estruturados** | `console.group` nos hooks críticos (inputs/outputs) para identificar causa raiz |

**Critério:** Só voltar a "corrigir" depois de capturar diagnóstico suficiente para apontar a causa raiz.

---

## Anti-Regressão de Core

**Proibido** refatorar core/base sem autorização explícita do usuário.

---

## Multi-Tenant (Regra Fixa)

- Tudo sempre tenant-scoped
- **Proibido** vazamento de dados/tokens/credenciais entre tenants
- Validar `tenant_id` em TODA operação

---

## CORE DO SISTEMA (Regra Fixa)

**Produtos, Clientes e Pedidos são a base/fonte de verdade.**

Qualquer módulo (marketing, suporte, automações, integrações, fiscal, logística, marketplaces, atendimento etc.) deve ler/alterar o Core via **API interna do Core** (camada de serviço), sem fluxos paralelos nem writes diretos fora dessa camada.

---

## Build (Regra Fixa)

**Não considerar concluído** se build/lint/typecheck falharem.

---

## Feature Incompleta

Esconder via feature-flag. **NUNCA** deixar "UI quebrada" em produção.

---

## Integrações Sensíveis (WhatsApp/Email/Pagamentos/Marketplaces)

**Não quebrar provider em produção.** Se trocar, implementar em paralelo com gate + rollback.

---

## Tenants Âncora

| Tenant | Email | Tenant ID | Descrição |
|--------|-------|-----------|-----------|
| **Super Admin (Platform)** | `toniravaziojr@gmail.com` | `cc000000-0000-0000-0000-000000000001` | Admin da plataforma com Admin Mode Toggle |
| **Tenant Base Especial** | `respeiteohomem@gmail.com` | `d1a4d0ed-8842-495e-b741-540a9a345b25` | Tenant cliente especial (plan=unlimited, is_special=true) |

> "Somente no tenant base especial" = **SPECIAL ONLY** (não afetar platform/admin nem customers).

---

## Admin Mode (Toggle de Contexto)

O Platform Admin tem acesso a dois modos de visualização via toggle pills no header:

| Modo | Ícone | Descrição | Sidebar |
|------|-------|-----------|---------|
| **Plataforma** | `Building2` | Administração do Comando Central | Módulos de admin (Health, Planos, Avisos, Tutoriais, Integrações Plataforma) |
| **Minha Loja** | `Store` | Ferramentas de loja/e-commerce | Todos módulos de cliente (Produtos, Pedidos, CRM, Marketing, etc) |

### Arquivos do Admin Mode

| Arquivo | Descrição |
|---------|-----------|
| `src/contexts/AdminModeContext.tsx` | Context + Provider + hooks (useAdminMode, useAdminModeSafe) |
| `src/components/layout/AdminModeToggle.tsx` | Toggle pills UI |
| `src/hooks/usePlatformOperator.ts` | Hook para verificar se usuário é platform admin |

### Regras

| Regra | Descrição |
|-------|-----------|
| **Visibilidade** | Toggle só aparece para platform operators |
| **Persistência** | Modo salvo em `localStorage` (key: `admin-mode-preference`) |
| **Default** | Platform operators iniciam em modo "Plataforma" |
| **Fallback** | Usuários não-admin sempre veem modo "Minha Loja" |
| **Sidebar** | Muda completamente baseado no modo ativo |

---

## Auth / RLS (Resumo Operacional)

| Aspecto | Descrição |
|---------|-----------|
| **Auth** | `auth.users` → `profiles` (id igual) |
| **Multi-tenancy** | `tenants` + `user_roles`; `profiles.current_tenant_id` = tenant ativo |
| **Roles** | Usar `hasRole()` (nunca hardcoded) |
| **Platform admins** | Tabela `platform_admins` (separado). Platform admin não precisa de tenant para acessar |

### Hooks de Acesso ao Tenant (Unificados)

| Hook | Status | Descrição |
|------|--------|-----------|
| **`useTenantAccess`** | ✅ **CANÔNICO** | Hook unificado. Retorna: `tenantType`, `plan`, `isSpecial`, `isPlatform`, `isPlatformTenant`, `isCustomerTenant`, `isUnlimited`, `planLevel`, `canAccess(feature)`, `showStatusIndicators`, `overrides` |
| `useTenantType` | ⚠️ **DEPRECATED** | Wrapper fino sobre `useTenantAccess`. Mantido para backwards compat. Usar `useTenantAccess` em código novo. |
| `useIsSpecialTenant` | ⚠️ **DEPRECATED** | Wrapper fino sobre `useTenantAccess().showStatusIndicators`. Usar `useTenantAccess` em código novo. |
| **`usePlatformOperator`** | ✅ Ativo | Verifica se o usuário é admin da plataforma (tabela `platform_admins`). Eixo separado. |
| **`usePermissions`** | ✅ Ativo | RBAC de sub-usuários (owner/admin/operator/viewer). Eixo separado. |

### Regra de Uso

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Usar `useTenantType` em código novo | Usar `useTenantAccess` |
| Usar `useIsSpecialTenant` em código novo | Usar `useTenantAccess().showStatusIndicators` |
| Criar novo hook para dados do tenant | Adicionar ao `useTenantAccess` |

---

## Arquitetura — Locais Canônicos (Regra Fixa)

| Local Canônico | Responsabilidade |
|----------------|------------------|
| **Integrações (hub)** | Conectar/configurar integrações e credenciais globais |
| **Atendimento** | Todas as mensagens de todos os canais |
| **Marketplaces** | Operações específicas do marketplace |
| **Fiscal (NFe)** | Módulo fiscal/certificado; **não é "integração"** |
| **Logística (/shipping)** | Frete e transportadoras; **não fica em Integrações** |
| **Meu Drive (public.files)** | Fonte de verdade de arquivos/mídias do tenant |
| **Usuários e Permissões** | Equipe do tenant; não confundir com `platform_admins` |

---

## Credenciais Globais (platform_credentials)

| Regra | Descrição |
|-------|-----------|
| **Allowlist** | Qualquer nova key precisa estar na allowlist de edição da function de update (ex.: `EDITABLE_CREDENTIALS`), senão salvar deve falhar |
| **UX admin** | Após salvar, UI deve refletir estado persistido (SET + preview mascarado) e permitir editar/remover |

---

## Regra de Prompts (Lovable)

Problema estrutural/multi-componente → prompt pede correção do **pipeline global**; nunca correção item a item.

---

## 🔴 Separação Admin vs Storefront (REGRA CRÍTICA)

> **NÃO NEGOCIÁVEL** — Alterações no sistema admin NUNCA devem afetar a loja pública dos tenants.

### Princípio

| Contexto | Domínio | Escopo |
|----------|---------|--------|
| **Admin (Comando Central)** | `app.comandocentral.com.br` | Sistema SaaS, UI fixa, tema azul marinho |
| **Storefront (Loja Pública)** | `tenant.shops.comandocentral.com.br` ou domínio customizado | Loja do cliente, herda tema do tenant |

### Componentes Separados

| Componente | Admin | Storefront |
|------------|-------|------------|
| **Toaster (Sonner)** | `AdminToaster` (`src/components/ui/admin-sonner.tsx`) | `Toaster` (`src/components/ui/sonner.tsx`) |
| **Tema/Cores** | Fixo (azul marinho #1e3a5f) | CSS Variables do tenant |
| **Layout** | `AppShell.tsx` | `StorefrontLayout.tsx`, `TenantStorefrontLayout.tsx` |

### Detecção de Contexto

```typescript
// Em App.tsx - shouldUseTenantRootRoutes
// TRUE = Estamos em domínio de tenant (loja pública)
// FALSE = Estamos em domínio admin (Comando Central)
const shouldUseTenantRootRoutes = isOnTenantHost();

// Renderização condicional
{shouldUseTenantRootRoutes ? <Sonner /> : <AdminToaster />}
```

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Alterar `sonner.tsx` para estilizar toasts do admin | Alterar `admin-sonner.tsx` |
| Usar cores hardcoded em componentes compartilhados | Usar CSS variables ou criar versão específica |
| Assumir que mudança em UI afeta só um contexto | Verificar se componente é compartilhado |
| Editar componentes em `src/components/storefront/` para ajustes do admin | Criar componente específico em `src/components/layout/` ou `src/components/ui/` |

### Arquivos de Referência

| Arquivo | Contexto | Descrição |
|---------|----------|-----------|
| `src/components/ui/admin-sonner.tsx` | Admin | Toaster do Comando Central (azul marinho) |
| `src/components/ui/sonner.tsx` | Storefront | Toaster da loja (herda tema do tenant) |
| `src/components/layout/AppShell.tsx` | Admin | Shell do painel admin |
| `src/components/storefront/TenantStorefrontLayout.tsx` | Storefront | Layout da loja pública |

### Verificação Obrigatória

Antes de QUALQUER alteração de UI/estilo, verificar:

1. **Qual contexto será afetado?** (Admin, Storefront ou ambos)
2. **O componente é compartilhado?** (Se sim, considerar criar versão específica)
3. **A mudança usa CSS variables ou cores hardcoded?**
4. **Testar em ambos os contextos** após a mudança

---

## Importação — Wizard (Etapas Congeladas)

| Etapa | Nome | Status |
|-------|------|--------|
| 1 | Análise da Loja | **CONGELADA** |
| 2 | Importação de Arquivos | **CONGELADA** |
| 3 | Estrutura da Loja | Em ajuste |

### Regras da Etapa 2

| Regra | Descrição |
|-------|-----------|
| **Batches** | 25–50; health check obrigatório |
| **Produto sem nome** | NUNCA inserir "Produto sem nome"; se faltar name/title → erro |
| **SKU** | Pode ser gerado se faltar (determinístico + único por tenant) |
| **Preço** | Não vira 0 silenciosamente; parse falhou = erro/warning explícito |
| **Pós-validação** | O que o job diz que importou deve aparecer na mesma query/tabela usada pela UI; mismatch = FAILED |

---

## Integrações — UI/UX (Regras Fixas)

| Regra | Descrição |
|-------|-----------|
| **Abas** | Em uma linha (sem duplicidade) |
| **NFe** | Não aparece em Integrações |
| **Frete/Logística** | Não aparece em Integrações (fica em `/shipping`) |
| **Email (domínio)** | Fica em Integrações (aba Emails) |

---

## Marketplaces — Padrão

| Aspecto | Regra |
|---------|-------|
| **Credenciais globais do app** | `platform_credentials` (admin) |
| **Conexão por tenant** | `marketplace_connections` (tenant-scoped) |
| **Tokens em tabela global** | Proibido |
| **Expor secrets globais ao tenant** | Proibido |
| **Navegação** | Marketplaces menu principal; `/marketplaces/mercadolivre` |
| **OAuth** | Conectar em Integrações; menu do marketplace só mostra CTA enquanto não conectado |
| **Pedidos** | `orders.marketplace_source`, `marketplace_order_id`, `marketplace_data` |

---

## Atendimento (Canais) — Regra Fixa

Tudo em **Atendimento**. Mercado Livre alimenta `conversations` + `messages` (`channel_type='mercadolivre'`).

**Proibido:** Manter "Mensagens" como aba principal dentro de Marketplaces.

---

## Logística / Frete — Segurança

| Regra | Descrição |
|-------|-----------|
| **Configuração** | Em `/shipping` |
| **RLS** | Proibido SELECT público amplo em shipping rules |
| **Checkout** | Calcula via Edge Function com service role + filtro tenant |

---

## Origem do Pedido — Ícone + Fiscal

| Regra | Descrição |
|-------|-----------|
| **Badge** | Pedidos exibem badge de origem |
| **Fiscal** | Filtra por origem via `orders.marketplace_source` |
| **Anti-regressão** | Não quebrar comportamento atual |

---

## Usuários e Permissões (RBAC do Cliente)

### Modelo

| Aspecto | Descrição |
|---------|-----------|
| **Tabelas** | `profiles`, `user_roles`, `role_invitations` |
| **RLS de profiles** | Tenant-scoped via `current_tenant_id` |
| **Convites** | Via `role_invitations` com token e expiração |
| **Modo convite** | Usuário só acessa tenant se tiver role ativo |
| **Guards** | Usar `hasRole()` para verificar permissões |
| **Default deny** | Sem role = sem acesso |

---

## Categorias — Módulo Core

### Miniaturas de Categorias

| Regra | Descrição |
|-------|-----------|
| **Cadastro de categoria** | **NÃO** possui campo de miniatura/thumbnail. Apenas nome, slug, descrição e banners. |
| **Miniaturas nos blocos** | Imagens de miniatura são configuradas **diretamente nos blocos do Builder** |
| **Flexibilidade** | Cada bloco pode ter dimensões e imagens diferentes para a mesma categoria |

---

## Produtos, Clientes e Pedidos — Módulos Core

### Core API

Todas as operações de escrita passam pela Core API (Edge Functions):
- `core-orders`
- `core-customers`
- `core-products`

### Auditoria

Todas as alterações são registradas em `core_audit_log`.

### State Machine (Pedidos)

| Status | Transições Permitidas |
|--------|----------------------|
| `pending` | `processing`, `cancelled` |
| `processing` | `shipped`, `cancelled` |
| `shipped` | `delivered`, `returned` |
| `delivered` | `returned` |
| `cancelled` | - |
| `returned` | - |

---

## 🔄 Loading States — Regra de Feedback Visual em Ações

> **REGRA OBRIGATÓRIA** — Aplica-se a TODAS as ações que disparam operações assíncronas.

### Padrão Obrigatório

**Todo botão que executa uma ação assíncrona DEVE:**

1. **Desabilitar durante a execução** — `disabled={isLoading}`
2. **Mostrar spinner animado** — Usar `Loader2` do lucide-react com `animate-spin`
3. **Alterar texto para gerúndio** — Ex: "Publicar" → "Publicando..."
4. **Desabilitar botões relacionados** — Ex: botão "Cancelar" no mesmo modal

### Implementação Padrão

```tsx
import { Loader2 } from 'lucide-react';

// Em botões simples:
<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Salvando...
    </>
  ) : (
    'Salvar'
  )}
</Button>

// Em AlertDialog (confirmações):
<AlertDialogFooter>
  <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
  <AlertDialogAction onClick={onAction} disabled={isLoading}>
    {isLoading ? (
      <>
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        Processando...
      </>
    ) : (
      'Confirmar'
    )}
  </AlertDialogAction>
</AlertDialogFooter>
```

### Nomenclatura de Estados

| Ação Original | Texto em Loading |
|---------------|------------------|
| Salvar | Salvando... |
| Publicar | Publicando... |
| Excluir | Excluindo... |
| Enviar | Enviando... |
| Processar | Processando... |
| Confirmar | Confirmando... |
| Importar | Importando... |
| Exportar | Exportando... |
| Conectar | Conectando... |
| Sincronizar | Sincronizando... |

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Botão clicável durante loading | `disabled={isLoading}` |
| Sem feedback visual | Spinner + texto de loading |
| Múltiplos cliques permitidos | Desabilitar imediatamente |
| Fechar modal durante ação | Desabilitar botão cancelar |

---

## 🔴 Diálogos de Confirmação — useConfirmDialog (OBRIGATÓRIO)

> **REGRA OBRIGATÓRIA** — Aplica-se a TODAS as ações destrutivas ou críticas no sistema.

### Hook Canônico

`src/hooks/useConfirmDialog.tsx` — **useConfirmDialog**

### Uso Obrigatório

**Toda ação que requer confirmação do usuário DEVE usar `useConfirmDialog`.** É **PROIBIDO** usar `window.confirm()` ou `window.alert()` nativos do navegador.

### API

```typescript
const { confirm, ConfirmDialog } = useConfirmDialog();

// No JSX: <ConfirmDialog />

// Para usar:
const confirmed = await confirm({
  title: "Título da ação",
  description: "Descrição do impacto",
  variant: "destructive" | "warning" | "info" | "default",
  confirmText: "Texto do botão", // opcional
});
if (!confirmed) return;
```

### Variantes

| Variante | Uso | Ícone | Cor |
|----------|-----|-------|-----|
| `destructive` | Exclusão permanente | Trash2 | Vermelho |
| `warning` | Ações com impacto reversível | AlertTriangle | Amarelo |
| `info` | Confirmações informativas | Info | Azul |
| `default` | Ações gerais (publicar, enviar) | Send | Primary |

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| `window.confirm("Tem certeza?")` | `await confirm({ title: "...", variant: "destructive" })` |
| `window.alert("Feito!")` | `toast.success("Feito!")` |
| Diálogos nativos do browser | `useConfirmDialog` com variante adequada |

---

## 📅 DateRangeFilter — Componente Padrão de Seleção de Datas

> **REGRA OBRIGATÓRIA** — Aplica-se a TODOS os módulos que filtram dados por período.

### Componente Canônico

`src/components/ui/date-range-filter.tsx` — **DateRangeFilter**

### Uso Obrigatório

**Todo filtro de período de datas no sistema DEVE usar o componente `DateRangeFilter`.**

```tsx
import { DateRangeFilter } from "@/components/ui/date-range-filter";

<DateRangeFilter
  startDate={startDate}
  endDate={endDate}
  onChange={(start, end) => {
    setStartDate(start);
    setEndDate(end);
  }}
/>
```

### Funcionalidades Incluídas

| Feature | Descrição |
|---------|-----------|
| **Calendário duplo** | Dois meses lado a lado para seleção visual |
| **Inputs de data** | Campos editáveis DD/MM/AAAA para início e fim |
| **Presets** | Todo o período, Hoje, Ontem, Esta semana, Semana passada, Este mês, Mês passado, Selecionar mês, Período customizado |
| **Ícone** | `CalendarIcon` do lucide-react |
| **Label inteligente** | Presets nomeados (Hoje, Ontem, Esta semana, etc.) exibem o **nome** no botão (ex: "Período: Hoje"). Períodos customizados ou seleção de mês exibem datas (ex: "Período: 01/03/2026 até 31/03/2026"). |

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Criar calendário customizado com `Calendar` + `Popover` | Usar `DateRangeFilter` |
| Criar constantes `DATE_PRESETS` locais | Usar presets nativos do componente |
| Implementar lógica própria de seleção de range | Usar `onChange(start, end)` do componente |
| Usar `react-day-picker` diretamente para filtros | Usar `DateRangeFilter` que encapsula o picker |

---

## 🚀 Performance e Latência — Regras Estruturais

> **REGRA OBRIGATÓRIA** — Aplica-se a toda implementação que envolve carregamento de dados ou processamento assíncrono.

### Princípios

| Princípio | Descrição |
|-----------|-----------|
| **Execução Paralela** | Edge Functions com múltiplas sub-tarefas DEVEM usar `Promise.allSettled()` para execução concorrente |
| **Bootstrap Pattern** | Páginas que precisam de 3+ queries iniciais DEVEM consolidar em uma única Edge Function bootstrap |
| **Cache Agressivo** | Dados que mudam raramente (settings, menus, templates) DEVEM usar `staleTime` ≥ 2 minutos |
| **Batch Processing** | Processamento de listas DEVE usar batches concorrentes (max 5-10 paralelos) em vez de loops sequenciais |

### Edge Functions — Padrão de Concorrência

```typescript
// ❌ ERRADO: Execução sequencial
const result1 = await step1();
const result2 = await step2();
const result3 = await step3();

// ✅ CORRETO: Execução paralela
const [r1, r2, r3] = await Promise.allSettled([step1(), step2(), step3()]);
```

### Frontend — Cache Pattern

```typescript
// ✅ CORRETO: staleTime para dados estáveis
useQuery({
  queryKey: ['storefront-bootstrap', tenantSlug],
  queryFn: fetchBootstrap,
  staleTime: 2 * 60 * 1000, // 2 min
  gcTime: 5 * 60 * 1000,    // 5 min
});
```

### Edge Functions Otimizadas

| Edge Function | Padrão | Descrição |
|---------------|--------|-----------|
| `scheduler-tick` | Hybrid Dispatcher | Steps 4-7 executam em paralelo via `Promise.allSettled` |
| `reconcile-payments` | Concurrent Batches | Tenants processados em paralelo, pagamentos em batches de 5 |
| `storefront-bootstrap` | Single-Request Bundle v2.0 | 8+ queries em paralelo + extração de layout/settings do template. Reduz ~13 queries frontend para 1 |

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Loops `for...of` com `await` sequencial em Edge Functions | `Promise.allSettled()` para operações independentes |
| Múltiplas queries individuais no frontend para dados iniciais | Agrupar em Edge Function bootstrap |
| `staleTime: 0` para dados que mudam raramente | `staleTime` ≥ 2 minutos para settings/menus/templates |
| Acesso direto a `auth.users` via client | Usar tabela `profiles` ou funções `SECURITY DEFINER` |

---

## 🚨 Tratamento de Erros — Padrão v1.0

> **REGRA OBRIGATÓRIA** — Aplica-se a TODOS os módulos do admin (Comando Central).

### Princípio

**Nenhum erro pode ser silencioso.** Todo erro deve resultar em feedback visual claro para o usuário.

### Camadas de Proteção

| Camada | Componente | Descrição |
|--------|-----------|-----------|
| **Global** | `AdminErrorBoundary` (`src/components/layout/AdminErrorBoundary.tsx`) | Captura erros não tratados em qualquer componente do admin. Mostra tela de erro com botão "Tentar novamente" e "Contatar suporte" |
| **Página** | `QueryErrorState` (`src/components/ui/query-error-state.tsx`) | Componente reutilizável para exibir quando uma query falha (`isError === true`) |
| **Hook/Ação** | `showErrorToast` (`src/lib/error-toast.ts`) | Utilitário para categorizar erros e exibir toasts com mensagem clara |

### Regras Obrigatórias

| Regra | Descrição |
|-------|-----------|
| **Nenhum `console.error` sem `toast`** | Todo `catch` que loga no console DEVE também notificar o usuário via `toast.error()` ou `showErrorToast()` |
| **Toda página com query deve tratar `isError`** | Extrair `isError` e `refetch` da query e renderizar `<QueryErrorState>` quando `isError === true` |
| **Catches vazios proibidos** | `catch {}` vazio é proibido exceto para fallbacks de `localStorage` |
| **Erros técnicos orientam suporte** | Erros de rede/500/timeout devem incluir "Se o problema persistir, entre em contato com o suporte" |
| **Erros de permissão são claros** | Erros 403/RLS devem dizer "Você não tem permissão para esta ação" |

### Categorias de Erro (error-toast.ts)

| Categoria | Quando | Mensagem |
|-----------|--------|----------|
| **permission** | 403, "permission", "not authorized", "RLS" | "Você não tem permissão para realizar esta ação" |
| **technical** | 500, timeout, network, erro genérico | "Erro interno do sistema. Se persistir, entre em contato com o suporte." |
| **validation** | 400, "duplicate", "unique", "invalid" | Mensagem original do erro |

### Uso do QueryErrorState

```tsx
import { QueryErrorState } from "@/components/ui/query-error-state";

// No componente da página:
const { data, isLoading, isError, refetch } = useMyQuery();

if (isError) {
  return (
    <QueryErrorState
      title="Erro ao carregar [módulo]"
      message="Não foi possível carregar os dados. Tente novamente."
      onRetry={() => refetch()}
    />
  );
}
```

### Uso do showErrorToast

```typescript
import { showErrorToast } from "@/lib/error-toast";

try {
  await someAction();
} catch (error) {
  showErrorToast(error, "Erro ao salvar produto");
}
```

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| `catch (e) { console.error(e) }` sem toast | `catch (e) { console.error(e); showErrorToast(e, "Contexto") }` |
| `catch {}` vazio (exceto localStorage) | `catch (e) { toast.error("Mensagem clara") }` |
| Página sem tratamento de `isError` | `if (isError) return <QueryErrorState ... />` |
| Mensagem genérica "Algo deu errado" sem ação | Mensagem + botão "Tentar novamente" + link suporte |

### Arquivos de Referência

| Arquivo | Descrição |
|---------|-----------|
| `src/components/layout/AdminErrorBoundary.tsx` | ErrorBoundary global do admin |
| `src/components/ui/query-error-state.tsx` | Componente de estado de erro em queries |
| `src/lib/error-toast.ts` | Utilitário centralizado de toast de erro |

---

## Dashboard — Métricas e Formatação

### Layout de Métricas (v8.8.0 — 4 Categorias Horizontais)

O grid de métricas da Central de Execuções é organizado em **4 categorias empilhadas verticalmente**, cada uma contendo cards horizontais (`flex gap-3`):

| Ordem | Título | Métricas | Fonte de Dados |
|-------|--------|----------|----------------|
| **0 — Faturamento** | "Faturamento" | Faturamento Total (pagos+não pagos), Faturamento Real (só pagos), Retorno Real (pagos - ad spend total), Taxa de Conversão (visitantes × pedidos pagos) | `orders`, `meta_ad_insights`, `google_ad_insights`, `tiktok_ad_insights`, `storefront_visits` |
| **1 — Funil de Conversão** | "Funil de Conversão" | Visitas → Adicionou ao carrinho → Iniciou checkout → Pedidos (vendas efetivadas) | `storefront_visits`, `carts`, `checkout_sessions`, `orders` |
| **2 — Pedidos & Financeiro** | "Pedidos & Financeiro" | Pedidos Pagos, Pedidos Não Pagos, Ticket Médio, Novos Clientes (1ª compra) | `orders` (payment_status), `customers` |
| **3 — Checkouts Abandonados** | "Checkouts Abandonados" | Total abandonados, Recuperados, Com erros de contato | `checkout_sessions` (status/recovered_at/customer_email/phone) |

#### Componentes

| Campo | Valor |
|-------|-------|
| **Tipo** | Componente |
| **Localização** | `src/components/dashboard/DashboardMetricsGrid.tsx` |
| **Contexto** | Renderizado em `DashboardContent()` dentro de `CommandCenter.tsx` |
| **Descrição** | 4 categorias empilhadas (`space-y-4`), cada uma com `Card` contendo cards horizontais internos (`flex gap-3`) |
| **Props** | `metrics: DashboardMetrics`, `isLoading: boolean`, `trendLabel: string` |
| **Visual** | Cada métrica é um `MetricCard` com: label (text-sm), valor (text-2xl bold), ícone colorido (top-right), trend com % (bottom). Layout horizontal com `flex-1 min-w-0`. Refatorado de grid-cols-2 para flex horizontal em v8.7.2, adicionada categoria Faturamento em v8.8.0. |
| **Afeta** | Depende de `useDashboardMetrics` hook |

#### Interface DashboardMetrics (campos v8.8.0)

| Campo | Tipo | Fonte |
|-------|------|-------|
| `salesToday` / `salesYesterday` | number | `orders` where `payment_status = 'approved'` (soma de total) |
| `ordersToday` / `ordersYesterday` | number | `orders` count |
| `paidOrdersToday` / `paidOrdersYesterday` | number | `orders` where `payment_status = 'approved'` count |
| `unpaidOrdersToday` / `unpaidOrdersYesterday` | number | `orders` where `payment_status != 'approved'` count |
| `ticketToday` / `ticketYesterday` | number | salesCurrent / paidCurrent.length |
| `newCustomersToday` / `newCustomersYesterday` | number | `customers` count |
| `visitorsToday` / `visitorsYesterday` | number | `storefront_visits` (unique visitor_id) |
| `cartsToday` / `cartsYesterday` | number | `carts` (count por período) |
| `checkoutsStartedToday` / `checkoutsStartedYesterday` | number | `checkout_sessions` (count por período) |
| `abandonedCheckoutsToday` / `abandonedCheckoutsYesterday` | number | `checkout_sessions` onde `status = 'abandoned'` |
| `recoveredCheckoutsToday` | number | `checkout_sessions` onde `recovered_at IS NOT NULL` |
| `errorCheckoutsToday` | number | Abandonados sem email válido (sem `@`) E sem telefone válido (< 8 chars) |
| `totalRevenueToday` / `totalRevenueYesterday` | number | `orders` soma de total (todos, pagos e não pagos) |
| `adSpendToday` / `adSpendYesterday` | number | Soma de: `meta_ad_insights.spend_cents/100` + `google_ad_insights.cost_micros/1_000_000` + `tiktok_ad_insights.spend_cents/100` |
| `conversionRateToday` / `conversionRateYesterday` | number | `(paidOrders / visitors) * 100` — atualiza com recuperados pois usa payment_status approved |

#### Métricas de Faturamento (v8.8.0)

| Métrica | Cálculo | Ícone | Variant |
|---------|---------|-------|---------|
| **Faturamento Total** | Soma de `orders.total` (todos os pedidos, pagos e não pagos) | `DollarSign` | `primary` |
| **Faturamento Real** | Soma de `orders.total` onde `payment_status = 'approved'` | `BarChart3` | `success` |
| **Retorno Real** | Faturamento Real − Ad Spend Total (Meta + Google + TikTok) | `TrendingDown` | `info` (positivo) / `destructive` (negativo) |
| **Taxa de Conversão** | `(pedidos pagos / visitantes) × 100` — formato `X.XX%` | `Percent` | `warning` |

#### Ad Spend — Fontes de Dados

| Plataforma | Tabela | Campo | Conversão |
|------------|--------|-------|-----------|
| Meta Ads | `meta_ad_insights` | `spend_cents` | ÷ 100 |
| Google Ads | `google_ad_insights` | `cost_micros` | ÷ 1.000.000 |
| TikTok Ads | `tiktok_ad_insights` | `spend_cents` | ÷ 100 |

#### Regra de "Com erros de contato"

Checkout abandonado é classificado como "com erro" quando:
- `customer_email` não contém `@` **E** `customer_phone` tem menos de 8 caracteres (ou é nulo)
- Indica que o cliente informou dados inválidos, impossibilitando recuperação

### Visitantes (Tracking Interno)

| Regra | Descrição |
|-------|-----------|
| **Fonte de dados** | Tabela `storefront_visits` (tracking próprio via fetch+keepalive no Edge HTML) |
| **Deduplicação** | Por `visitor_id` (cookie `_sf_vid`, 365 dias) no frontend |
| **Independência** | NÃO depende de GA4, Meta Pixel ou qualquer pixel externo |
| **UI** | Não exibir rótulo de origem ("GA4", "Meta") — apenas o número |

### Formatação de Moeda

| Regra | Descrição |
|-------|-----------|
| **Função canônica** | `formatCurrency()` em `src/hooks/useDashboardMetrics.ts` |
| **Valores** | `orders.total` armazena em **Reais** (NÃO centavos). **NÃO dividir por 100.** |
| **Formato** | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` |

### Regressões Documentadas (2026-03-11)

1. **formatCurrency dividia por 100** → Vendas e ticket médio apareciam 100x menores. Corrigido removendo `/100`.
2. **Visitantes dependiam de GA4** → Label "Sincronize o GA4" bloqueava visualização. Corrigido com tracking interno próprio.
3. **sendBeacon silenciosamente falhava** → `navigator.sendBeacon` não suporta headers customizados; PostgREST requer `Authorization: Bearer`. Resultado: 0 visitantes registrados. Corrigido trocando para `fetch()` com `keepalive:true`. **REGRA: NUNCA usar sendBeacon para PostgREST.**

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar, atualizar ou "melhorar" este documento por conta própria. |
| **Alteração somente por comando explícito** | Só pode ser alterado quando o usuário pedir usando: `ATUALIZAR REGRAS: [instruções]`. |
| **Reporte de lacunas** | Se identificar inconsistência, apenas **REPORTAR** e propor texto para aprovação — **SEM ALTERAR**. |
