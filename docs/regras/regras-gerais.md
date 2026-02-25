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
| **Presets** | Hoje, Últimos 7 dias, Últimos 14 dias, Últimos 30 dias, Últimos 90 dias, Este mês, Mês passado |
| **Ícone** | `CalendarIcon` do lucide-react |

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Criar calendário customizado com `Calendar` + `Popover` | Usar `DateRangeFilter` |
| Criar constantes `DATE_PRESETS` locais | Usar presets nativos do componente |
| Implementar lógica própria de seleção de range | Usar `onChange(start, end)` do componente |
| Usar `react-day-picker` diretamente para filtros | Usar `DateRangeFilter` que encapsula o picker |

---

## Regra de Imutabilidade

| Regra | Descrição |
|-------|-----------|
| **Proibição de edição autônoma** | A Lovable **NÃO PODE** editar, atualizar ou "melhorar" este documento por conta própria. |
| **Alteração somente por comando explícito** | Só pode ser alterado quando o usuário pedir usando: `ATUALIZAR REGRAS: [instruções]`. |
| **Reporte de lacunas** | Se identificar inconsistência, apenas **REPORTAR** e propor texto para aprovação — **SEM ALTERAR**. |
