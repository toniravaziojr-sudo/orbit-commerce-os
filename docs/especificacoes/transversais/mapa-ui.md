# Mapa de UI — Comando Central

> **Camada:** Layer 3 — Especificação Transversal  
> **Status:** Ativo  
> **Última atualização:** 2026-04-12  
> **Fonte de verdade para:** navegação, rotas, sidebar, visibilidade de telas e regras de posicionamento de UI

---

## 1. PROPÓSITO

Este documento é a referência formal e fonte de verdade para toda a estrutura de interface do Comando Central. Define:

- Mapa completo de navegação (sidebar)
- Inventário de rotas do sistema
- Regras de visibilidade por perfil de acesso
- Guards e mecanismos de proteção de rotas
- Regras de posicionamento de UI
- Componentes de layout

**Toda entrega que adicione, remova ou altere tela, rota, item de sidebar ou regra de visibilidade deve atualizar este documento.**

---

## 2. MAPA DE NAVEGAÇÃO (SIDEBAR)

### 2.1 Navegação Completa do Tenant (`fullNavigation`)

| # | Grupo | Item | Rota | Módulo (plan) | blockedFeature | ownerOnly | Observações |
|---|-------|------|------|---------------|----------------|-----------|-------------|
| 1 | Principal | Central de Comando | `/command-center` | central | — | — | Sempre visível |
| 2 | Principal | ChatGPT | `/chatgpt` | central | `assistant` | — | Badge "Upgrade" se bloqueado |
| 3 | E-commerce | Pedidos | `/orders` | ecommerce | — | — | — |
| 4 | E-commerce | Checkout Abandonado | `/abandoned-checkouts` | ecommerce | — | — | — |
| 5 | E-commerce | Produtos | `/products` | ecommerce | — | — | — |
| 6 | E-commerce | Clientes | `/customers` | ecommerce | — | — | — |
| 6.1 | E-commerce | Link Checkout | `/checkout-links` | ecommerce | — | — | — |
| 7 | Loja Online | Loja Virtual | `/storefront` | loja_online | — | — | — |
| 8 | Loja Online | Categorias | `/categories` | loja_online | — | — | — |
| 9 | Loja Online | Menus | `/menus` | loja_online | — | — | — |
| 10 | Loja Online | Páginas da Loja | `/pages` | loja_online | — | — | — |
| 11 | Marketing Básico | Blog | `/blog` | marketing_basico | — | — | — |
| 12 | Marketing Básico | Atribuição de venda | `/marketing/atribuicao` | marketing_basico | `attribution` | — | Badge "Upgrade" se bloqueado |
| 13 | Marketing Básico | Descontos | `/discounts` | marketing_basico | — | — | — |
| 14 | Marketing Básico | Aumentar Ticket | `/offers` | marketing_basico | — | — | — |
| 15 | Marketing Avançado | Email Marketing | `/email-marketing` | marketing_avancado | `email_marketing` | — | Badge "Upgrade" se bloqueado |
| 16 | Marketing Avançado | Quizzes | `/quizzes` | marketing_avancado | `quizzes` | — | Badge "Upgrade" se bloqueado |
| 17 | Marketing Avançado | Gestor de Tráfego IA | `/ads` | marketing_avancado | — | — | — |
| 18 | Central de Conteúdo | Calendário de Conteúdo | `/media` | central_conteudo | — | — | — |
| 19 | Central de Conteúdo | Estúdio de Criativos | `/creatives` | central_conteudo | — | — | — |
| 20 | CRM | Notificações | `/notifications` | crm | `whatsapp_notifications` | — | Badge "Upgrade" se bloqueado |
| 21 | CRM | Atendimento | `/support` | crm | `support_chat` | — | Badge "Upgrade" se bloqueado |
| 22 | CRM | Emails | `/emails` | crm | `emails` | — | Badge "Upgrade" se bloqueado |
| 23 | CRM | Avaliações | `/reviews` | crm | — | — | — |
| 24 | ERP | Fiscal | `/fiscal` | erp_logistica | — | — | — |
| 25 | ERP | Financeiro | `/finance` | erp_logistica | `erp_financeiro` | — | Badge "Upgrade" se bloqueado |
| 26 | ERP | Compras | `/purchases` | erp_logistica | `erp_compras` | — | Badge "Upgrade" se bloqueado |
| 27 | ERP | Logística | `/shipping` | erp_logistica | `remessas` | — | Badge "Upgrade" se bloqueado |
| 28 | Parcerias | Influencers | `/influencers` | parcerias | `influencers` | — | Badge "Upgrade" se bloqueado |
| 29 | Parcerias | Afiliados | `/affiliates` | parcerias | — | — | — |
| 30 | Marketplaces | Mercado Livre | `/marketplaces/mercadolivre` | marketplaces | `mercadolivre` | — | Badge "Upgrade" se bloqueado |
| 31 | Marketplaces | Shopee | `/marketplaces/shopee` | marketplaces | `shopee` | — | Locked "Em breve" (exceto platform admin) |
| 32 | Marketplaces | TikTok Shop | `/marketplaces/tiktokshop` | marketplaces | `tiktokshop` | — | Badge "Upgrade" se bloqueado |
| 33 | Sistema | Integrações | `/integrations` | sistema_integracoes | — | — | — |
| 34 | Sistema | Configurações | `/system/settings` | sistema_integracoes | — | — | — |
| 35 | Sistema | Usuários e Permissões | `/system/users` | sistema_integracoes | `sistema_usuarios` | ✅ | Visível apenas para owner |
| 36 | Utilitários | Apps Externos | `/apps-externos` | central | — | — | — |
| 37 | Utilitários | Importar Dados | `/import` | central | `sistema_importacao` | — | Badge "Upgrade" se bloqueado |
| 38 | Utilitários | Meu Drive | `/files` | central | — | — | — |
| 39 | Utilitários | Relatórios | `/reports` | central | `reports` | — | Badge "Upgrade" se bloqueado |
| 40 | Suporte | Suporte | `/support-center` | suporte | — | — | — |
| 41 | Suporte | Pacotes IA | `/ai-packages` | suporte | — | — | — |

**Grupos colapsáveis:** E-commerce, Loja Online, Marketing Básico, Marketing Avançado, Central de Conteúdo, CRM, ERP, Parcerias, Marketplaces, Sistema, Utilitários.  
**Grupos fixos (sempre abertos):** Principal, Suporte.

### 2.2 Navegação da Plataforma (`platformAdminNavigation`)

| # | Item | Rota | Observações |
|---|------|------|-------------|
| 1 | Health Monitor | `/platform/health-monitor` | — |
| 2 | Integrações da Plataforma | `/platform/integrations` | — |
| 3 | Sugestões de Blocos | `/platform/block-suggestions` | — |
| 4 | Assinaturas | `/platform/billing` | — |
| 5 | Emails do Sistema | `/platform/emails` | — |
| 6 | Avisos da Plataforma | `/platform/announcements` | — |
| 7 | Tutoriais por Módulo | `/platform/tutorials` | — |
| 8 | Tenants | `/platform/tenants` | — |
| 9 | Ferramentas | `/platform/tools` | — |

---

## 3. SEGMENTAÇÃO POR PERFIL DE ACESSO

### 3.1 Tenant Normal (cliente)

- **Sidebar:** `fullNavigation` (13 grupos, ~41 itens)
- **Grupos colapsáveis:** estado persistido no `localStorage`
- **Itens com `blockedFeature`:** mostram badge "Upgrade" se o plano não inclui a feature
- **Itens com `ownerOnly: true`:** visíveis apenas para o owner do tenant
- **RBAC:** visibilidade controlada por role (`owner`, `manager`, `editor`, `attendant`, `assistant`, `viewer`) via `isSidebarItemVisible()`
- **Módulos bloqueados por plano:** inteiro grupo pode ser ocultado se `accessLevel === 'none'`
- **Sem indicadores de status** (✅/🟧)
- **Sem acesso a rotas** `/platform/*`
- **Informações técnicas de IA** (modelos, provedores, versões) ocultadas — exibidos rótulos genéricos ("Motor A", "Motor B")

### 3.2 Tenant Especial (ex: Respeite o Homem, Amazgan)

- **Sidebar:** mesma `fullNavigation` do tenant normal
- **`isUnlimited = true`:** sem badges "Upgrade", sem bloqueio de features por plano
- **`showStatusIndicators = true`:** mostra ✅/🟧 nos itens (via `getModuleStatus()`)
- **Visibilidade técnica de IA:** nomes de modelos, provedores e versões de pipeline visíveis (controlado por `useIsSpecialTenant`)
- **Sem acesso a rotas** `/platform/*`
- **RBAC:** mesmo sistema, porém geralmente o owner tem acesso total

### 3.3 Platform Admin (Comando Central)

- **Toggle de modo:** Plataforma vs Minha Loja (`AdminModeContext`)
  - Persistido no `localStorage` (chave `admin-mode-preference`)
  - Default: `platform` para admins
  - Ao trocar de modo, navega automaticamente para a rota padrão do modo
- **Modo Plataforma:** sidebar `platformAdminNavigation` (9 itens exclusivos da plataforma)
  - Rota padrão: `/platform/health-monitor`
- **Modo Loja:** sidebar `fullNavigation` completa, sem bloqueios de plano
  - Rota padrão: `/command-center`
- **Acesso total** a todas as rotas (bypass em `PermissionGuard` e `GatedRoute`)
- **Indicadores de status** visíveis (exceto em demo mode)
- **Informações técnicas de IA** totalmente visíveis

### 3.4 Presets de Papel RBAC

| Papel | Label | Acesso principal |
|-------|-------|-----------------|
| `owner` | Proprietário | Acesso total (permissions = null) |
| `manager` | Gerente | Todos os módulos, exceto `system.users` |
| `editor` | Editor | Produtos, loja online, conteúdo, mídia |
| `attendant` | Atendente | Pedidos, clientes, atendimento, emails |
| `assistant` | Auxiliar | Pedidos, produtos, logística, compras |
| `viewer` | Visualizador | Apenas visualização: pedidos, produtos, clientes |

---

## 4. ROTAS PROTEGIDAS E GUARDS

### 4.1 Mecanismos de Proteção

| Guard | Tipo | Função | Onde atua |
|-------|------|--------|-----------|
| `ProtectedRoute` | Wrapper de rota | Exige autenticação e (opcionalmente) tenant ativo | Nível de rota no `App.tsx` |
| `PermissionGuard` | Componente no layout | Verifica RBAC por rota via `canAccessRoute()` | Dentro do `AppShell` |
| `GatedRoute` | Wrapper de rota | Bloqueio por plano/módulo com preview mode | Rota específica |
| `FeatureGatedRoute` | Wrapper de rota | Bloqueio por feature específica com overlay | Rota específica |
| `PlatformAdminGate` | Componente inline | Renderiza conteúdo apenas para platform admins | Dentro de componentes |
| `ModuleGate` | Componente | Bloqueio de módulo com modo preview | Usado pelo `GatedRoute` |
| `FeatureGate` | Componente | Mostra/oculta feature por plano | Inline em componentes |

### 4.2 Rotas Sempre Acessíveis (whitelist)

Estas rotas **não passam** pela verificação de permissão no `PermissionGuard`:

- `/` (redirect para `/command-center`)
- `/command-center`
- `/account/*`
- `/getting-started`
- `/dev/*`

### 4.3 Rotas Públicas (sem autenticação)

- `/auth` — Login/Signup
- `/auth/aguardando-confirmacao` — Aguardando confirmação de email
- `/auth/reset-password` — Reset de senha
- `/start` — Checkout de plano (billing)
- `/start/info` — Informações do checkout
- `/start/pending` — Pagamento pendente
- `/complete-signup` — Completar cadastro pós-checkout
- `/accept-invite` — Aceitar convite de equipe
- `/demo-estrutura` — Demo de estrutura
- `/demo-lp` — Demo de landing page
- `/dev/error-test` — Teste de erros (dev)
- `/avaliar/:token` — Avaliação de produto (storefront)

### 4.4 Callbacks de OAuth (públicos)

- `/integrations/meta/callback`
- `/integrations/threads/callback`
- `/integrations/meli/callback`
- `/integrations/youtube/callback`
- `/integrations/tiktok/callback`

### 4.5 Rotas Protegidas sem Tenant

- `/create-store` — Criar loja (usuário autenticado sem tenant)
- `/no-access` — Sem acesso (convite removido)
- `/admin/qa/storefront` — QA de storefront (platform admin)

### 4.6 Rotas do Painel Admin (dentro do AppShell)

**E-commerce:**
- `/orders` — Lista de pedidos
- `/orders/new` — Novo pedido manual
- `/orders/:id` — Detalhe do pedido
- `/abandoned-checkouts` — Checkouts abandonados
- `/products` — Produtos
- `/customers` — Clientes
- `/checkout-links` — Link Checkout (links personalizados de checkout)
- `/customers/:id` — Detalhe do cliente

**Loja Online:**
- `/storefront` — Configurações da loja virtual
- `/storefront/builder` — Builder visual (fora do AppShell)
- `/categories` — Categorias
- `/menus` — Menus de navegação
- `/pages` — Páginas da loja
- `/pages/:pageId/builder` — Builder de página (fora do AppShell)
- `/page-templates` — Templates de páginas
- `/page-templates/:templateId/builder` — Builder de template (fora do AppShell)
- `/landing-pages/:id` — Editor de landing page

**Marketing Básico:**
- `/blog` — Blog
- `/blog/:postId/editor` — Editor de post (fora do AppShell)
- `/blog/campaigns/:campaignId` — Detalhe de campanha do blog
- `/marketing/atribuicao` — Atribuição de vendas (FeatureGated: `attribution`)
- `/discounts` — Descontos
- `/offers` — Aumentar ticket

**Marketing Avançado (GatedRoute: `marketing_avancado`):**
- `/media` — Calendário de conteúdo
- `/media/campaign/:campaignId` — Detalhe de campanha de mídia
- `/campaigns` — Gestor de tráfego IA
- `/creatives` — Estúdio de criativos
- `/ads` — Gestor de Tráfego Meta Ads
- `/email-marketing` — Email Marketing (abas: Campanhas, Listas, Membros, Templates, Formulários)
- `/email-marketing/list/:listId` — Detalhe de lista
- `/email-marketing/campaign/new` — Wizard unificado de campanha (Envio Único OU Automação com escolha de builder Linear/Visual)
- `/quizzes` — Quizzes interativos
- `/quizzes/:quizId` — Editor de quiz

**CRM:**
- `/notifications` — Notificações WhatsApp (FeatureGated: `whatsapp_notifications`)
- `/support` — Atendimento (FeatureGated: `support_chat`)
- `/emails` — Emails (FeatureGated: `emails`)
- `/reviews` — Avaliações

**ERP:**
- `/fiscal` — Fiscal (abas: Pedidos em Aberto, Notas Fiscais)
- `/fiscal/configuracoes` — Configurações Fiscais (página dedicada — abas: Configurações Fiscais, Natureza Jurídica, Outros). **Casa oficial:** `Sistema → Configurações → aba Fiscal` (conteúdo embutido na aba — sem redirecionamento desde rev 2026-04-17c). **Atalho:** botão "Configurações" em `/fiscal` abre `/fiscal/configuracoes?from=fiscal`. **Botão "Voltar" contextual via `?from=`:** `?from=fiscal` retorna para `/fiscal?tab=pedidos`; `?from=settings` (ou sem param) retorna para `/system/settings?tab=fiscal`. Não aparece como item próprio na sidebar.
- `/fiscal/products` — Config fiscal de produtos
- `/fiscal/operation-natures` — **Redirect legado** → `/fiscal/configuracoes?aba=natureza`
- `/finance` — Financeiro (GatedRoute: `erp_financeiro`)
- `/purchases` — Compras (GatedRoute: `erp_compras`)
- `/shipping` — Dashboard de logística
- `/shipping/shipments` — Remessas (FeatureGated: `remessas`) — filtros: busca, data, status, **Transportadora** (Correios/Loggi/Frenet/Fallback/Sem) e **Serviço** (PAC, Sedex, Loggi Express — dinâmico). Coluna Transportadora exibe badge + serviço (ex: "Correios · PAC"). Detalhe em `docs/especificacoes/erp/rascunhos-logisticos.md` v2.5.0.
- `/shipping/settings` — Config de frete

**Parcerias (GatedRoute: `parcerias`):**
- `/influencers` — Influencers
- `/affiliates` — Afiliados

**Marketplaces:**
- `/marketplaces` — Hub de marketplaces
- `/marketplaces/mercadolivre` — Mercado Livre (FeatureGated)
- `/marketplaces/shopee` — Shopee (FeatureGated)
- `/marketplaces/tiktokshop` — TikTok Shop (FeatureGated)

**Sistema:**
- `/integrations` — Hub de integrações (cards de status; card WhatsApp inclui `WhatsAppChannelStatusCard` (v2: 3 sinais + Validar agora + wizard cross-business) + `WhatsAppActivationGuide` full + `WhatsAppDiagnosticCard` + `WhatsAppPinManager` + `WhatsAppOnboardingPinDialog`). **Status do WhatsApp v2 (2026-04-21):** card mostra estado de negócio + 3 sinais separados (Conexão técnica / Autorização administrativa / Recepção real comprovada). 6 estados oficiais: desconectado, conectado tecnicamente, recepção real pendente, operacional validado, sem evidência recente, degradado após validação. Linguagem sempre "hipótese principal" — nunca afirmar causa.
- `/index` (Dashboard) / `/command-center` (DashboardTab) — Inclui `WhatsAppRealReceptionPendingBanner` (só aparece em `real_reception_pending` há > 24h e com rollout v2 ativo) + `WhatsAppActivationGuide` (compact) + Card "Saúde do WhatsApp".
- `/apps-externos` — Apps externos
- `/system/settings` — Configurações do sistema (abas: **Pagamentos**, **Fiscal** — conteúdo embutido com sub-abas Emitente/Natureza/Outros, sem redirecionamento desde rev 2026-04-17c)
- `/system/users` — Usuários e permissões (owner only, GatedRoute: `sistema_usuarios`)
- `/settings` — Configurações gerais
- `/settings/domains` — Domínios
- `/settings/billing` — Cobrança
- `/settings/add-payment-method` — Adicionar método de pagamento

**Utilitários:**
- `/import` — Importação de dados (GatedRoute: `sistema_importacao`)
- `/files` — Meu Drive
- `/reports` — Relatórios (FeatureGated: `reports`)

**Conta:**
- `/account/data` — Dados da conta
- `/account/billing` — Minha assinatura

**IA e Suporte:**
- `/chatgpt` — ChatGPT (FeatureGated: `assistant`)
- `/ai-memories` — Memórias de IA
- `/ai-packages` — Pacotes IA
- `/support-center` — Central de suporte
- `/getting-started` — Guia inicial

**Dev:**
- `/dev/url-diagnostics` — Diagnóstico de URLs

### 4.7 Rotas da Plataforma (Platform Admin only)

- `/platform/health-monitor` — Health Monitor
- `/platform/integrations` — Integrações da plataforma
- `/platform/block-suggestions` — Sugestões de blocos
- `/platform/billing` — Assinaturas
- `/platform/emails` — Emails do sistema
- `/platform/announcements` — Avisos da plataforma
- `/platform/tutorials` — Tutoriais por módulo
- `/platform/tenants` — Gerenciamento de tenants
- `/platform/tools` — Ferramentas da plataforma

### 4.8 Redirects e Rotas Legadas

| De | Para | Motivo |
|----|------|--------|
| `/` | `/command-center` | Root sempre redireciona |
| `/executions` | `/command-center?tab=executions` | Rota legada |
| `/landing-pages` | `/pages` | Consolidação |
| `/buy-together` | `/offers` | Consolidação |
| `/marketing` | `/integrations?tab=social` | Redirecionamento |
| `/payments` | `/integrations` | Consolidação |
| `/shipments` | `/shipping/shipments` | Reorganização |
| `/storefront/conversao` | `/abandoned-checkouts` | Consolidação |
| `/cart-checkout` | `/abandoned-checkouts` | Consolidação |
| `/health-monitor` | `/platform/health-monitor` | Prefixo platform |
| `/settings/emails` | `/platform/integrations` | Reorganização |
| `/settings/fiscal` | `/fiscal/configuracoes` | Página dedicada (rev 2026-04-17) |
| `/fiscal?tab=configuracoes` | `/fiscal/configuracoes` | Substituição do modal por página (rev 2026-04-17) |
| `/fiscal/operation-natures` | `/fiscal/configuracoes?aba=natureza` | Consolidação na página de configurações |
| `/system/settings?tab=fiscal` | `/fiscal/configuracoes?from=settings` | Casa oficial em Sistema→Configurações com Voltar contextual (rev 2026-04-17b) |
| `/system/settings?tab=fiscal` (redirect) | `/system/settings?tab=fiscal` (conteúdo embutido) | Aba Fiscal passa a renderizar conteúdo na própria página, sem redirecionamento (rev 2026-04-17c) |
| `/account/personal` | `/account/data` | Consolidação |
| `/account/company` | `/account/data` | Consolidação |

### 4.9 Rotas da Storefront (SPA interativo)

Rotas servidas via SPA quando no host do tenant (domínio customizado ou subdomínio da plataforma):

| Rota | Página | Observação |
|------|--------|------------|
| `/cart`, `/carrinho` | Carrinho | — |
| `/checkout` | Checkout | — |
| `/obrigado` | Obrigado | — |
| `/rastreio` | Rastreio | — |
| `/minhas-compras` | Minhas compras | — |
| `/conta` | Conta | — |
| `/conta/login` | Login | — |
| `/conta/esqueci-senha` | Esqueci senha | — |
| `/conta/redefinir-senha` | Redefinir senha | — |
| `/conta/pedidos` | Pedidos | — |
| `/conta/pedidos/:orderId` | Detalhe do pedido | — |
| `/quiz/:quizSlug` | Quiz | — |
| `/avaliar/:token` | Avaliação | — |
| `/busca` | Busca | — |
| `/ai-lp/:lpSlug` | Landing page IA | Sem layout (full-page) |
| `*` (catch-all) | EdgeContentReload | Devolve para Edge/Worker |

**Rotas Edge-only** (não renderizadas pelo SPA): Home, Categorias, Produtos, Blog, Páginas estáticas, Landing Pages de conteúdo.

---

## 5. STATUS DOS MÓDULOS (INDICADORES)

Os indicadores ✅ (ready) e 🟧 (pending) são mostrados **apenas** para tenants especiais (`showStatusIndicators = true`) e **ocultados** em demo mode.

Configurados em `src/config/module-status.ts`. Referência rápida:

| Status | Módulos |
|--------|---------|
| ✅ Ready | Pedidos, Produtos, Categorias, Clientes, Link Checkout, Loja Virtual, Checkout Abandonado, Menus, Páginas, Blog, Descontos, Ofertas, Calendário de Conteúdo, Notificações, Emails, Avaliações, Fiscal, Compras, Importar, ChatGPT, Drive, Relatórios, Emails do Sistema, Usuários |
| 🟧 Pending | Central de Comando, Landing Pages, Marketing, Atribuição, Email Marketing, Quizzes, Campanhas, Criativos, Atendimento, Pacotes IA, Financeiro, Logística, Integrações, Configurações, Marketplaces, Health Monitor, Integrações da Plataforma, Sugestões de Blocos |

---

## 6. REGRAS DE POSICIONAMENTO DE UI

### 6.1 Hub de Integrações (`/integrations`)

- **Permitido:** gestão de conexões (status, conectar/reconectar/desconectar) e configurações técnicas fundamentais (Pixel, CAPI)
- **Proibido:** painéis operacionais (campanhas de ads, catálogos de shop, gerenciamento de conteúdo)
- Painéis operacionais devem residir em seus respectivos módulos (Marketing, Marketplaces, Publicações)
- **Botões válidos no card de conexão Meta:** `Reconectar` (OAuth com `auth_type=reauthorize`) e `Desconectar`. O antigo botão `Atualizar` foi removido em 2026-04-18 — apenas recarregava cache local React Query, sem comunicação real com a Meta. Renovação real é automática via cron `meta-token-refresh-daily` e detecção de invalidação via cron `meta-token-health-check-daily`.
- Referência: memória `integration-hub-ui-standard`, memória `meta-token-lifecycle`

### 6.2 Sidebar: Sistema vs Utilitários

- **Sistema:** Integrações, Configurações, Usuários e Permissões (configurações estruturais do lojista)
- **Utilitários:** Apps Externos, Importar Dados, Meu Drive, Relatórios (ferramentas de produtividade e análise)
- Referência: memória `sidebar-hierarchy-standard`

### 6.3 Visibilidade Técnica de IA

- Nomes de modelos (Kling, Veo, Wan, Flux), provedores (fal.ai, ElevenLabs) e versões de pipeline são **ocultados** para tenants comuns
- Tenants comuns veem rótulos genéricos ("Motor A", "Motor B") ou descrições funcionais
- Visibilidade técnica total apenas para tenants especiais e Platform Admin
- Controlado por `useIsSpecialTenant`
- Referência: memória `special-tenant-ui-visibility`

### 6.4 "Em breve" vs "Upgrade"

- **"Em breve" (locked):** módulo ainda não lançado. Sidebar mostra tag amarela, sem navegação. Lista: `/marketplaces/shopee` (exceto platform admin)
- **"Upgrade" (blockedFeature):** módulo existe mas não está no plano do tenant. Sidebar mostra badge "Upgrade", navegação é permitida mas conteúdo exibido em modo preview com overlay de bloqueio

---

## 7. COMPONENTES DE LAYOUT

### 7.1 Estrutura Principal

```
AppShell
├── AppSidebar (navegação lateral)
│   ├── Logo + TenantSwitcher
│   ├── NavGroups (colapsáveis)
│   │   └── NavItems (com badges, locks, status)
│   └── Botão de colapsar sidebar
├── AppHeader (barra superior)
│   ├── AdminModeToggle (plataforma/loja)
│   ├── PlatformAlerts
│   ├── ModuleTutorialLink
│   └── Menu do usuário (avatar, role, logout)
└── Main Content
    └── PermissionGuard → Outlet (rotas filhas)
```

### 7.2 Componentes-chave

| Componente | Arquivo | Função |
|------------|---------|--------|
| `AppShell` | `src/components/layout/AppShell.tsx` | Shell principal (sidebar + header + content) |
| `AppSidebar` | `src/components/layout/AppSidebar.tsx` | Navegação lateral com grupos, badges e status |
| `AppHeader` | `src/components/layout/AppHeader.tsx` | Header com toggle de modo, alertas e menu do usuário |
| `TenantSwitcher` | `src/components/layout/TenantSwitcher.tsx` | Troca de tenant (multi-tenant) |
| `AdminModeToggle` | `src/components/layout/AdminModeToggle.tsx` | Toggle Plataforma vs Minha Loja |
| `PermissionGuard` | `src/components/auth/PermissionGuard.tsx` | Guard RBAC por rota |
| `PlatformAdminGate` | `src/components/auth/PlatformAdminGate.tsx` | Gate para conteúdo exclusivo de platform admin |
| `GatedRoute` | `src/components/layout/GatedRoute.tsx` | Wrapper de rota com bloqueio por plano |
| `FeatureGatedRoute` | `src/components/layout/GatedRoute.tsx` | Wrapper de rota com bloqueio por feature |
| `ModuleGate` | `src/components/layout/ModuleGate.tsx` | Bloqueio de módulo com modo preview |
| `FeatureGate` | `src/components/layout/FeatureGate.tsx` | Gate inline para features |

### 7.3 Providers

| Provider | Contexto | Função |
|----------|----------|--------|
| `AdminModeProvider` | `AdminModeContext` | Gerencia modo plataforma/loja para platform operators |
| `AuthProvider` | `useAuth` | Autenticação, tenant ativo, user roles |
| `CommandAssistantProvider` | — | Assistente de comandos (Cmd+K) |

### 7.4 Hooks de Acesso

| Hook | Função |
|------|--------|
| `usePermissions` | RBAC: `canAccess()`, `canAccessRoute()`, `isSidebarItemVisible()` |
| `usePlatformOperator` | Verifica se usuário é platform admin |
| `useTenantAccess` | Tipo de tenant, `isUnlimited`, `showStatusIndicators` |
| `useIsSpecialTenant` | (Deprecated) Redireciona para `useTenantAccess` |
| `useModuleAccess` | Acesso a módulo por plano: `hasAccess`, `accessLevel`, `blockedFeatures` |
| `useAllModuleAccess` | Acesso a todos os módulos de uma vez |
| `useAdminMode` / `useAdminModeSafe` | Modo admin: platform vs store |
| `useDemoMode` | Modo demo (oculta status indicators) |

---

## 8. MAPA DE PERMISSÕES RBAC → ROTAS

Mapeamento completo em `src/config/rbac-modules.ts` (`ROUTE_TO_PERMISSION`).

Rotas **não listadas** no mapa são **bloqueadas por padrão** (segurança).

Exceções (sempre acessíveis): `/`, `/command-center`, `/account/*`, `/getting-started`, `/dev/*`.

Rotas `/platform/*` verificam `module: 'platform'` → apenas platform operators.

Rota `/system/users` verifica `module: 'system', submodule: 'users'` → apenas owner.

---

## 9. REGRAS DE MANUTENÇÃO

1. **Toda nova rota** deve ser adicionada a este documento e ao `ROUTE_TO_PERMISSION` em `rbac-modules.ts`
2. **Todo novo item de sidebar** deve ser adicionado à tabela da Seção 2
3. **Todo novo guard** deve ser documentado na Seção 4.1
4. **Todo novo componente de layout** deve ser documentado na Seção 7
5. **Toda mudança de visibilidade** (perfil, plano, role) deve atualizar a Seção 3
6. **Toda rota redirect** nova deve ser adicionada à tabela de redirects (Seção 4.8)
7. **Toda mudança de status de módulo** deve atualizar a Seção 5
