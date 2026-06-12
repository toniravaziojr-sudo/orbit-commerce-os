# Mapa de UI — Comando Central

> **Camada:** Layer 3 — Especificação Transversal  
> **Status:** Ativo  
> **Última atualização:** 2026-05-24  
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
| 1 | Principal | Central de Comando | `/command-center` | central | — | — | Sempre visível. Abas: Dashboard, Execuções, Insights, Assistente, Agenda. **Dashboard** abre em sub-abas por canal: Geral, Loja Virtual e (condicionais à conexão ativa) Mercado Livre, Shopee, TikTok Shop (v2.2 — 2026-06-09). |
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
| 14 | Marketing Básico | Aumentar Ticket | `/offers` | marketing_basico | — | — | Inclui a aba **Conversão de Carrinho** (rev 2026-05-29), migrada do antigo módulo Logística. |
| 15 | Marketing Avançado | Email Marketing | `/email-marketing` | marketing_avancado | `email_marketing` | — | Badge "Upgrade" se bloqueado |
| 16 | Marketing Avançado | Quizzes | `/quizzes` | marketing_avancado | `quizzes` | — | Badge "Upgrade" se bloqueado |
| 17 | Marketing Avançado | Gestor de Tráfego IA | `/ads` | marketing_avancado | — | — | — |
| 18 | Central de Conteúdo | Calendário de Conteúdo | `/media` | central_conteudo | — | — | Planejamento e agenda de publicações. **Não chama** o edge `creative-image-generate` diretamente — geração visual é feita no Estúdio de Criativos. |
| 19 | Central de Conteúdo | Estúdio de Criativos | `/creatives` | central_conteudo | — | — | **3 abas:** **Vídeos** (default — edge `creative-video-generate`), **Imagens** (edge `creative-image-generate` — instrumentado pelo Motor Universal de Créditos), **Galeria** (somente leitura). Aba **Imagens** (v10.1): formatos alinhados ao catálogo Fal GPT Image 1.5 — **Quadrado (1024×1024)**, **Retrato (1024×1536)**, **Paisagem (1536×1024)**. Qualidade fixa em **Média (padrão)** com badge informativo (Low/High futuros). Labels antigos `9:16` / `16:9` foram removidos por não terem pricing correspondente. |
| 20 | CRM | Notificações | `/notifications` | crm | `whatsapp_notifications` | — | Badge "Upgrade" se bloqueado |
| 21 | CRM | Atendimento | `/support` | crm | `support_chat` | — | Badge "Upgrade" se bloqueado |
| 22 | CRM | Emails | `/emails` | crm | `emails` | — | Badge "Upgrade" se bloqueado |
| 23 | CRM | Avaliações | `/reviews` | crm | — | — | — |
| 24 | ERP | Fiscal | `/fiscal` | erp_logistica | — | — | — |
| 25 | ERP | Financeiro | `/finance` | erp_logistica | `erp_financeiro` | — | Badge "Upgrade" se bloqueado |
| 26 | ERP | Compras | `/purchases` | erp_logistica | `erp_compras` | — | Badge "Upgrade" se bloqueado |
| 26b | ERP | Fornecedores | `/suppliers` | erp_logistica | `erp_compras` | — | Cadastro único de fornecedores (rev 2026-05-21) |
| 27 | ERP | Logística | `/shipping` | erp_logistica | `remessas` | — | Abas **Dashboard**, **Objetos de postagem**, **Remessas** (agrupador) e **Rastreios** (rev 2026-06-02b). "Objetos de postagem" = unidade individual por pedido (subabas Prontos para emitir / Objetos emitidos / Pendentes). "Remessas" = lote/agrupador de N objetos enviados juntos para a transportadora, com número `Remessa_DDMMAAAA.HHMMSS`, contadores e drill-down. Meios de Transporte → `/integrations?tab=shipping`; Frete Grátis → `/system/settings?tab=shipping&aba=regras-frete-gratis`; Frete Personalizado → `/system/settings?tab=shipping&aba=frete-personalizado`. URLs antigas redirecionam. |
| 28 | Parcerias | Influencers | `/influencers` | parcerias | `influencers` | — | Badge "Upgrade" se bloqueado |
| 29 | Parcerias | Afiliados | `/affiliates` | parcerias | — | — | — |
| 30 | Marketplaces | Mercado Livre | `/marketplaces/mercadolivre` | marketplaces | `mercadolivre` | — | Badge "Upgrade" se bloqueado |
| 31 | Marketplaces | Shopee | `/marketplaces/shopee` | marketplaces | `shopee` | — | Locked "Em breve" (exceto platform admin) |
| 32 | Marketplaces | TikTok Shop | `/marketplaces/tiktokshop` | marketplaces | `tiktokshop` | — | Badge "Upgrade" se bloqueado |
| 33 | Sistema | Integrações | `/integrations` | sistema_integracoes | — | — | Inclui a aba **Meios de Envio** (rev 2026-05-29) com os cards de Frenet, Correios e Loggi (credenciais do lojista). Cards passam a abrir/fechar (recolhidos por padrão, igual aos de Pagamentos): cabeçalho mostra logo, nome, badge de status (Ativo / Configurado / Não conectado), toggle Ativo e botão Configurar/Editar — descrição, funcionalidades, modo de autenticação, campos de credenciais, link de documentação e botão Salvar ficam dentro do conteúdo expansível (rev 2026-05-29b). Card Correios exibe apenas o método **Código de Acesso às APIs** (opção legada OAuth2 com Senha removida; sem tag "Recomendado"; sem menções a outros sistemas). **Três chaves independentes por transportadora (rev 2026-05-29c):** toggle **Ativo** controla o despacho do pedido (Correios pela fila local de Remessas; Frenet pelo fluxo gateway automático — basta ativar para pedidos pagos começarem a fluir); toggle **Cotação** controla se a transportadora aparece nas opções de frete do checkout; toggle **Rastreamento** controla atualização automática de status. Desativar Cotação ou Rastreamento **não bloqueia o despacho**. |
| 34 | Sistema | Configurações | `/system/settings` | sistema_integracoes | — | — | Inclui a aba **Meios de Envio** (rev 2026-05-29) com sub-abas **Regras de Frete Grátis** (Método Padrão + Regras) e **Frete Personalizado**. |
| 35 | Sistema | Usuários e Permissões | `/system/users` | sistema_integracoes | `sistema_usuarios` | ✅ | Visível apenas para owner. Linha de membro tem dropdown com **Editar Permissões** e **Remover** (oculto na própria linha do usuário logado). Edição/remoção de owner permitida quando há mais de um owner. |
| 36 | Utilitários | Apps Externos | `/apps-externos` | central | — | — | — |
| 37 | Utilitários | Importar Dados | `/import` | central | `sistema_importacao` | — | Badge "Upgrade" se bloqueado |
| 38 | Utilitários | Meu Drive | `/files` | central | — | — | — |
| 39 | Utilitários | Relatórios | `/reports` | central | `reports` | — | Badge "Upgrade" se bloqueado |
| 40 | Suporte | Suporte | `/support-center` | suporte | — | — | Inclui aba "Funil WhatsApp" (Modo Vendas WhatsApp — Fase 5) |
| 41 | Suporte | Pacotes IA | `/ai-packages` | suporte | — | — | — |

**Grupos colapsáveis:** E-commerce, Loja Online, Marketing Básico, Marketing Avançado, Central de Conteúdo, CRM, ERP, Parcerias, Marketplaces, Sistema, Utilitários.  
**Grupos fixos (sempre abertos):** Principal, Suporte.

### 2.2 Navegação da Plataforma (`platformAdminNavigation`)

| # | Item | Rota | Observações |
|---|------|------|-------------|
| 1 | Saúde do Sistema | `/platform/system-health` | Ondas 1+2 — Visibilidade & Resiliência. KPIs banco/cron/filas + KPIs WhatsApp travadas/incidentes/divergências de pagamento. Abas: Tarefas Automatizadas, Filas, WhatsApp (incidentes + mensagens órfãs com ação "Resolver"), Pagamentos (divergências 24h/7d/30d), Queries Lentas, Banco. |
| 2 | Health Monitor | `/platform/health-monitor` | — |
| 3 | Integrações da Plataforma | `/platform/integrations` | Apenas credenciais de **app integrador** (OAuth Mercado Pago, Mercado Livre, Meta, Google, Shopee, etc). **NÃO contém recebedor de pagamento** — recebedor de QUALQUER tenant (inclusive admin) é configurado via OAuth em "Minha Loja → Integrações → Pagamentos → Mercado Pago → Conectar com Mercado Pago" (botão único, sem campos manuais). Ver `mem://constraints/mercadopago-2-contextos-credentials`. |
| 4 | Sugestões de Blocos | `/platform/block-suggestions` | — |
| 5 | Assinaturas | `/platform/billing` | — |
| 6 | Emails do Sistema | `/platform/emails` | — |
| 7 | Avisos da Plataforma | `/platform/announcements` | — |
| 8 | Tutoriais por Módulo | `/platform/tutorials` | — |
| 9 | Tenants | `/platform/tenants` | — |
| 10 | Ferramentas | `/platform/tools` | — |
| 11 | Custos Externos | `/platform/external-costs` | Abas: **Custos da plataforma** (sync 6h, banner alerta) e **Catálogo de preços** (`?tab=pricing`, Fase 2B — CRUD versionado de `service_pricing`, gate `approved_for_live`, auditoria com motivo obrigatório, platform_admin only). Expansão futura prevista: Consumo por tenant/categoria/provedor, Reconciliação, Margens. Ver `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`. |
| 12 | Créditos por Tenant | `/platform/credits` | **Etapa 1D Fase A3.2 — VALIDADA (2026-05-06):** painel admin de auditoria de créditos por tenant (sidebar renomeada para "Créditos por Tenant"). Consome RPC `get_credit_history` em modo platform_admin (`showAdminColumns=true`), com seletor obrigatório de tenant, filtros (período 7d/30d/90d, tipo, status, categoria, provider, service_key), checkbox "incluir transações de plataforma" e paginação. Cards com títulos explícitos: "Créditos consumidos exibidos", "Custo dos registros exibidos", "Receita dos registros exibidos", "Margem dos registros exibidos" + label "Resumo dos registros exibidos — não representa o total do período". Sem "Todos os tenants", sem CSV, sem agregados globais nesta etapa. Protegido por `PlatformAdminGate` que confia na RPC canônica `is_platform_admin()` — não bloqueia super_admin canônico se metadata profile falhar. Validação visual concluída no tenant Respeite o Homem (provider=fal, service_key visível, custo/venda admin-only, live OFF). |

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
- `/saude-do-sistema` — **Redirect legado** → `/platform/system-health`

### 4.5.1 Rotas do Storefront Público (fora do escopo deste mapa)

O storefront público do lojista (loja virtual vista pelo consumidor) **não é coberto por este documento**. Suas rotas (`/`, `/carrinho`, `/cart`, `/checkout`, `/obrigado`, `/conta/*`, `/minha-conta/*`, `/minhas-compras`, `/conta/pedidos/:orderId`, `/busca`, `/rastreio`, `/quiz/:quizSlug`, `/avaliar/:token`, `/store/:tenantSlug`, `/store/:tenantSlug/ai-lp/:lpSlug`) estão especificadas em `docs/especificacoes/storefront/*` (ver `loja-virtual.md`, `carrinho.md`, `checkout.md`, `pagina-obrigado.md`).


### 4.6 Rotas do Painel Admin (dentro do AppShell)

**E-commerce:**
- `/orders` — Lista de pedidos. Ação **Excluir** no menu "..." abre diálogo de confirmação que explicita: remoção do pedido + rastros operacionais (histórico, rascunhos fiscais/remessa, transações de pagamento, transportes, atribuição, eventos), preservação de cliente/lead, impacto em relatórios e métricas, ação irreversível. Botão de ação rotulado *"Excluir permanentemente"*. Bloqueio servidor exibe mensagem PT-BR específica (cancelado obrigatório / NF autorizada / remessa ativa) — ver `pedidos.md` §8.2.
- `/orders/new` — Novo pedido manual. A rolagem vertical da tela deve acontecer no contêiner principal do `AppShell`; é proibido manter um segundo scroll estrutural no shell ou inflar a altura do documento com viewport fixa legado. **Campos obrigatórios (vigente desde 2026-06-03):** nome completo, e-mail, **telefone com DDD (obrigatório, não opcional)**, CPF/CNPJ válido, CEP, logradouro, número, bairro, município, UF. Validação espelhada no backend — pedido manual incompleto é rejeitado com mensagem em PT-BR.
- `/orders/:id` — Detalhe do pedido (inclui `OrderRegressionBanner` quando há NF-e/etiqueta com `requires_action = true` por regressão de status — ver `pedidos.md` §4.6). O card *Tentativas de Pagamento* exibe a ação **"Estornar pagamento"** (`RefundPaymentDialog`) apenas para `owner`/`admin` quando há transação aprovada em gateway suportado — ver `pedidos.md` §7.2.1. **Marketplace (v3.2)**: na seção "Itens do Pedido", banner amarelo + badge "Pendente de vínculo" + botão "Vincular produto" (abre `ProductSelector`) aparecem para itens com `product_id = NULL`; ver `erp/erp-fiscal.md` §"Pedidos de Marketplace na Esteira Fiscal".
- `/abandoned-checkouts` — Checkouts abandonados
- `/products` — Produtos. Na criação/edição, o formulário usa o scroll global do `AppShell`; a barra fixa inferior do formulário não pode criar área branca extra no fim do documento. **Aba "Visão IA"** (somente em edição) exibe a inteligência comercial editável da IA — papel comercial, tipo, produto-base relacionado, complementares, "quando recomendar/não recomendar". Persistida em `ai_product_commercial_payload` + `ai_product_relations`. Não afeta runtime da IA nesta onda.

**Regra estrutural do AppShell (admin):** ao montar o painel administrativo, o documento (`html`, `body` e `#root`) deve ficar com overflow bloqueado; a única rolagem vertical permitida é a do `main` interno do shell.
- `/customers` — Clientes
- `/checkout-links` — Link Checkout (links personalizados de checkout)
- `/customers/:id` — Detalhe do cliente

**Loja Online:**
- `/storefront` — Configurações da loja virtual
- `/storefront/builder` — Builder visual (fora do AppShell)
- `/categories` — Categorias
- `/menus` — Menus de navegação
- `/pages` — Páginas da loja (inclui marcação opcional de cada página como **fonte da IA**: FAQ, Política ou Nenhum — campo `store_pages.ai_role`)
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
- `/ads` — Gestor de Tráfego Meta Ads. **Propostas pendentes — captura de feedback humano (rev 2026-06-07, Subfase A.2 da Etapa 7.mem):** os botões **Aprovar** e **Recusar** de cada sugestão da IA abrem um **diálogo obrigatório de feedback** antes de concluir a decisão. O usuário precisa **selecionar ao menos um motivo** do catálogo controlado de motivos (categorias diferentes para aprovação e para recusa) — sem motivo, o botão de confirmação fica **desabilitado**. Campo de **comentário livre é opcional**. Na **aprovação**, ficam disponíveis as marcações opcionais **"eu faria isso manualmente"** e **"usar como preferência futura deste tenant"**. Na **recusa**, ficam disponíveis as marcações opcionais **"a IA ignorou contexto importante"** e **"usar como preferência futura deste tenant"**. O feedback é gravado **antes** da decisão original ser concluída; se a gravação falhar, a decisão é **bloqueada** com aviso ao usuário (sem falha silenciosa). **Nesta etapa o feedback é apenas observacional — não influencia prompts, Policy Engine, Strategist nem Guardian, e não dispara chamadas extras à Meta.** As ações **"Pedir revisão"** e **"Editar e aprovar"** ficam **fora do escopo da A.2** e serão tratadas na Subfase A.3. Detalhe em `docs/especificacoes/marketing/gestor-trafego.md`.
- `/ads` — **Labels amigáveis de funil/público nos cards e no diálogo de detalhes (rev 2026-06-08, Frente 2 da Evolução Estratégica Fase 1):** badges e linhas de detalhe nunca exibem o valor técnico cru. `cold/tof/frio/prospecting` → "Público Frio". `warm/mof/morno/remarketing` → "Remarketing". `hot/bof/quente` → "Público Quente". `customers/clientes/compradores` → "Clientes". `retention/recompra/repurchase` → "Retenção / Recompra". `test/teste` → "Teste". `leads/lead` → "Captação de Leads". Valor desconhecido/ausente → "Público não classificado". O valor técnico permanece salvo no banco/payload; a tradução acontece na camada de apresentação via helper único.
- `/ads` — **Linha de exclusões de público nos cards e no diálogo de detalhes (rev 2026-06-08, Frente 1 da Evolução Estratégica Fase 1):** propostas de **Público Frio** mostram explicitamente o público de Clientes/Compradores excluído. Badge **verde "Excluindo: Clientes"** quando a exclusão foi aplicada com sucesso. Badge **âmbar "Sem público de Clientes nesta conta"** com tooltip "Crie ou sincronize o público de Clientes antes de propor campanhas frias." quando o pré-requisito está ausente — nesse caso a proposta já chega bloqueada pelo Quality Gate. Nada disso aparece em campanhas de remarketing/quente. Detalhe em `docs/especificacoes/marketing/gestor-trafego.md` §11.
  - **Toggle "Execução automática diária" — Fase C.4 (rev 2026-06-08):** novo controle, em dois lugares e com a mesma label/propósito.
    - **Card individual de cada conta de anúncio** (logo abaixo de "IA Ativa"): switch único com badge "Ativada/Desligada". Texto auxiliar: "Permite que a IA execute automaticamente apenas ações técnicas seguras do dia a dia, como pequenos ajustes de orçamento dentro da janela permitida, pausas emergenciais e reativações operacionais. Campanhas, públicos, criativos, copys, ofertas e decisões estratégicas continuam exigindo aprovação." Fica desabilitado enquanto "IA Ativa" estiver OFF, com nota "Ative a IA desta conta para habilitar a execução automática diária."
    - **Aba "Configurações Gerais" do Gestor de Tráfego IA, logo abaixo do card "IA Global"** (rev 2026-06-08, patch de UI): card próprio "Execução automática diária (fallback global)" com o mesmo switch. Texto auxiliar: "Quando ativada, a IA pode executar automaticamente ações técnicas do dia a dia (ajustes de orçamento dentro dos limites, pausa por gasto sem retorno, retomada segura) nas contas que não tiverem regra própria. Decisões estratégicas (criação de campanha, criativos, públicos, pausa estratégica) continuam exigindo sua aprovação." Hierarquia: Individual > Global > Desligado por padrão. O card fica desabilitado enquanto "IA Global" estiver desligada. A mudança neste toggle persiste imediatamente (não espera o botão "Salvar Configuração Global"), porque é controle de segurança.
    - **Default em toda conta nova ou existente:** Desligado. Tem que ser ligado deliberadamente pelo usuário.
    - **Comportamento visual de pausa estratégica na fila de aprovação:** sugestões classificadas como pausa estratégica devem mostrar que a validade da sugestão é **somente até 00:01 BRT**; após esse horário, são removidas da fila ativa (status passa a "expirada") sem chamar nenhuma plataforma externa. Histórico/auditoria permanece. Detalhe completo em `docs/especificacoes/marketing/gestor-trafego.md` seção 10.
- `/email-marketing` — Email Marketing (abas: Campanhas, Listas, Membros, Templates, Formulários)
- `/email-marketing/list/:listId` — Detalhe de lista
- `/email-marketing/campaign/new` — Wizard unificado de campanha (Envio Único OU Automação com escolha de builder Linear/Visual)
- `/quizzes` — Quizzes interativos
- `/quizzes/:quizId` — Editor de quiz

**CRM:**
- `/notifications` — Notificações WhatsApp (FeatureGated: `whatsapp_notifications`)
- `/support` — Atendimento (FeatureGated: `support_chat`). Aba **Canais de Atendimento**: cada canal tem ações **Desativar** (toggle `is_active=false`, preserva o registro como fonte de verdade do gate) e **Reativar** (volta `is_active=true`). **Remover Permanentemente** existe como ação secundária com confirmação obrigatória. Desativar bloqueia imediatamente respostas da IA naquele canal (gate universal — ver `docs/especificacoes/crm/crm-atendimento.md` §5.1).
- `/emails` — Emails (FeatureGated: `emails`)
- `/reviews` — Avaliações

**ERP:**
- `/fiscal` — Fiscal (abas: **Pedidos de Venda**, **Notas Fiscais**). Separadas por `fiscal_stage`: Pedidos de Venda lista `pedido_venda`; Notas Fiscais lista `pronta_emitir`, `pendencia` e `emitida`. **Resumo superior — 6 cards centralizados (rev 2026-05-19):** "Em aberto" (azul), "Pendente" (amarelo), "Concluído" (verde), "Chargeback em andamento" (laranja), "Chargeback perdido" (vermelho), "Cancelado" (cinza) — cada card é também filtro clicável. Status do PV é **espelho vivo** do status do pedido no core (campo `pedido_status` derivado por `derive_pv_pedido_status` + gatilho de propagação `orders_sync_pv_status`). Ver `ecommerce/pedidos.md` §14. **Aba Pedidos de Venda:** **filtro padrão "Em aberto" pré-selecionado ao montar (rev 2026-05-21)** — ao abrir o módulo Fiscal, o lojista vê primeiro só os pedidos que precisam de ação; filtro pode ser ajustado livremente. Ação "Criar Nota Fiscal" (singular) / "Criar Notas Fiscais (N)" (plural) executa `fiscal-prepare-invoice` (validação local, sem transmissão) e move o registro para Notas Fiscais. Após criação, redirecionamento automático para a aba Notas Fiscais. **Declaração de Conteúdo dos Correios (rev 2026-05-15 — motor único, PDF completo + multipágina):** disponível na aba Pedidos de Venda em duas modalidades — ação individual **"Gerar Declaração de Conteúdo"** no menu da linha e ação em massa **"Gerar Declarações de Conteúdo (N)"** na barra de seleção. Ambas abrem **modal obrigatório de responsabilidade** com: (a) aviso forte de que a Declaração de Conteúdo **não é NF-e/DANFE/DC-e Sefaz** e **não substitui Nota Fiscal** quando obrigatória; (b) **seleção obrigatória do motivo** em lista pronta (Venda/remessa sem NF-e por decisão do remetente · Devolução de consumidor final · Troca · Amostra sem valor comercial · Brinde · Bem pessoal · Outro). Selecionando "Outro", exibe campo de texto obrigatório para detalhar. O motivo escolhido é registrado no histórico e impresso no PDF. **No fluxo em massa, o mesmo motivo se aplica a todos os pedidos selecionados;** (c) **Peso total (kg) por pedido — obrigatório** (pré-preenchido com peso bruto quando disponível, editável; nunca permite gerar PDF com peso vazio); (d) **Quantidade de volumes** (padrão 1, editável); em massa há ações rápidas "aplicar peso a todos" e "aplicar volumes a todos"; (e) checkbox obrigatório de aceite de responsabilidade. Sem motivo + peso válido + checkbox marcados, o botão "Gerar" fica desabilitado. Ao confirmar: **individual** = 1 PDF; **em massa (2+ pedidos)** = **um único PDF multipágina** com nome `Declaracoes-Conteudo-YYYY-MM-DD.pdf`, uma Declaração completa por página. PDF traz cabeçalho, nº interno próprio (`DC-...`), data/hora BRT, remetente e destinatário completos (endereço, município/UF, CEP, telefone/e-mail), tabela de itens, valor total declarado, **peso total em kg**, volumes, motivo informado, **texto de responsabilidade neutro** (sem afirmar automaticamente que o remetente não é contribuinte) e avisos legais. **Histórico permanece individual** por pedido em `shipping_content_declarations`, com numeração interna independente da NF-e. **Não altera `fiscal_stage`**, **não aparece na aba Notas Fiscais**, **não chama Focus/Sefaz**, **não gera XML, DANFE, chave de acesso nem protocolo SEFAZ**, **não cria NF-e**. O **gateway logístico** (Frenet e demais transportadoras) usa o **mesmo motor único** quando a remessa precisa partir sem NF-e — não existe caminho paralelo. Detalhe completo em `docs/especificacoes/fiscal/declaracao-de-conteudo-correios.md`. **Aba Notas Fiscais:** **filtro "Tipo" pré-selecionado em "Todos os tipos" ao montar (rev 2026-05-25)** — Saída/Entrada/Transferência/Remessa/Devolução/Todos, com fallback automático para registros antigos sem `tipo_nota` persistido (deriva por natureza+CFOP). badges "Pronta para Emitir" (laranja), "Pendência Identificada" (amarelo), "Processando" (amarelo), "Autorizada" (azul), **"Impressa" (verde — substitui "Autorizada" quando a DANFE já foi impressa; rev 2026-05-21 — 1 pílula por linha, estado mais recente vence)**, "Rejeitada" (vermelho), "Cancelada" (vermelho), "Erro" (vermelho). Ação **"Emitir Nota Fiscal"** é a única que transmite para SEFAZ via `fiscal-submit`/`fiscal-emit` com confirmação obrigatória (sistema 100% em produção). **Feedback visual de envio (rev 2026-05-21):** ao disparar emissão (individual ou em lote), abre modal central **"Enviando nota(s) fiscal(is) para a Receita"** (`SendingInvoiceModal`) não-dismissível com contador "X de Y" no caso de lote; fecha sozinho quando a Sefaz responde. A pílula "Processando…" na linha permanece como reforço. **Quando houver reenvio ou atualização manual, o loading aparece na própria coluna de status da linha.** **Imprimir DANFE (rev 2026-05-21):** abre **uma única aba** com o PDF e dispara o diálogo de impressão. A marcação da nota como impressa acontece no banco em paralelo. Em nota rejeitada, o menu mostra **"Reenviar para SEFAZ"**, **"Editar"** e **"Duplicar como rascunho"**. **O editor não transmite mais diretamente**; ele salva e revalida, deixando a transmissão concentrada na lista da aba Notas Fiscais. Pendência bloqueia emissão; editor revalida automaticamente ao salvar. **Editor — hierarquia de severidade de alertas (rev 2026-05-20):** alertas dentro do editor de Pedido de Venda / NF seguem 2 níveis visuais: **VERMELHO (destrutivo)** para pendências que **bloqueiam emissão** — dados obrigatórios faltando (peso do produto, NCM, origem, GTIN, CPF do cliente, endereço incompleto, rejeição SEFAZ); **AMARELO/ÂMBAR** apenas para **avisos não-bloqueantes** (ex.: revisar dados do destinatário antes de despachar). É proibido usar amarelo para pendência obrigatória. Ver `mem://constraints/fiscal-severity-hierarchy`. **Excluir NF (rev 2026-05-19):** item **"Excluir"** (vermelho, com confirmação) aparece no menu da linha apenas para Proprietário/Administrador e apenas em notas sem efeito fiscal — **Pronta para Emitir, Rejeitada e Cancelada**. Em **Autorizada** e demais status com efeito fiscal o item Excluir **não aparece** — usar "Cancelar NF-e" dentro do prazo legal. Regra também aplicada via RLS no banco (policy `Owners and admins delete non-fiscal invoices`). **Duplicar:** "Duplicar Pedido de Venda" mantém em Pedidos de Venda; "Duplicar NF" valida via `fiscal-prepare-invoice` e coloca em `pronta_emitir`/`pendencia` na aba Notas Fiscais — nunca volta para Pedidos de Venda. **Não confundir com o módulo `/orders` da loja**. **Editor de NF de Entrada — cartão Fornecedor/Remetente unificado (rev 2026-05-24):** no editor de notas de Entrada, Compra, Remessa, Transferência, Devolução e Outros, a aba Dest. exibe um único cartão "Fornecedor / Remetente". A ordem visual é: **(1) busca na base** no topo; **(2) identificação completa** (Razão Social, CNPJ/CPF, IE, tipo de contribuinte), **endereço completo** (CEP, logradouro, número, complemento, bairro, cidade, UF, IBGE) e **contato** (e-mail, telefone) no meio; **(3) botão "Salvar na base"** no rodapé, após todos os campos, persistindo tudo de uma só vez. Se já vinculado, o botão muda para "Atualizar cadastro com estes dados". Ver `docs/especificacoes/erp/fornecedores.md` §"UI unificada". Detalhe em `docs/especificacoes/erp/erp-fiscal.md`.
- `/fiscal/configuracoes` — Configurações Fiscais (página dedicada — abas: **Configurações Fiscais**, Natureza Jurídica, Outros). **Casa oficial:** `Sistema → Configurações → aba Fiscal` (conteúdo embutido — sem redirecionamento desde rev 2026-04-17c). **Atalho:** botão "Configurações" em `/fiscal` abre `/fiscal/configuracoes?from=fiscal`. **Voltar contextual via `?from=`:** `?from=fiscal` → `/fiscal?tab=pedidos`; `?from=settings` (ou sem param) → `/system/settings?tab=fiscal`. **UI rev 2026-05-14b — Fonte única de readiness fiscal e automação total de tokens:** o **card superior "Pronto para emitir NF-e?"** e o **card "Validação Fiscal"** agora consomem a **mesma fonte de prontidão** (`useFiscalReadiness` → `fiscal-integration-validate`). É proibido manter checklist paralelo no frontend; nunca pode haver contradição entre os dois cards. Estados em linguagem de negócio: **Verificando**, **Configuração pendente**, **Pronto para teste** (homologação), **Pronto para emitir NF-e** (produção), **Configuração com erro**, **Produção bloqueada**. Cada item da lista superior tem botão "Ir para" que ancora no cartão correspondente (Identidade, Certificado, Validação Fiscal ou Ambiente). **Tokens da empresa** (`token_homologacao` / `token_producao`) deixaram de ser input manual: são **capturados automaticamente** do retorno da Focus por `fiscal-sync-focus-nfe` ao salvar Configurações Fiscais ou enviar certificado, e gravados de forma segura por tenant. A **seção "Credenciais do provedor fiscal" foi removida da UI comum** — o lojista nunca vê, digita ou cola tokens. O recebimento automático de retornos é ativado pelo backend quando os pré-requisitos estão completos. Botões de "Tentar novamente" só aparecem como fallback de erro real, com linguagem de negócio. Termos proibidos no fluxo comum: token, webhook, hook, API, Focus NFe, sincronizar empresa, cadastrar empresa no provedor. Token principal da conta Focus (`FOCUS_NFE_TOKEN`) continua exclusivo de **Plataforma → Integrações → Fiscal** e nunca aparece nesta tela. Barra de Salvar fixa no rodapé. Não aparece como item próprio na sidebar.
- `/fiscal/products` — Cadastro fiscal de produtos. Campos: NCM, CEST, Origem, GTIN, Unidade Comercial. **CFOP foi removido (rev 2026-05-25)** — agora vem da Natureza de Operação selecionada na nota. Em Configurações Fiscais, os campos "CFOP padrão dentro/fora do estado" também foram removidos e substituídos pelo seletor **"Natureza padrão para vendas automáticas"**. No editor de NF, ao escolher/trocar a Natureza ou alterar a UF do destinatário, o CFOP de todos os itens é recalculado automaticamente (intra 5xxx vs inter 6xxx). Override manual por item permitido, com badge "manual" e botão "Restaurar".
- `/fiscal/operation-natures` — **Redirect legado** → `/fiscal/configuracoes?aba=natureza`
- `/finance` — Financeiro (GatedRoute: `erp_financeiro`)
- `/purchases` — Compras (GatedRoute: `erp_compras`)
- `/suppliers` — **Fornecedores** (GatedRoute: `erp_compras`) — cadastro único de fornecedores, fonte de verdade usada por Compras, Fiscal e demais módulos do ERP. Lista com busca/filtros (status, tipo), cadastro em 4 abas (Dados básicos, Endereço, Fiscal, Comercial). Documento (CPF/CNPJ) único por tenant. Sem exclusão dura — apenas inativação (soft delete). Detalhe em `docs/especificacoes/erp/fornecedores.md`. Adicionado em rev 2026-05-21.
- `/shipping` — Dashboard de logística
- `/shipping/shipments` — Remessas (FeatureGated: `remessas`) — filtros: busca, data, status, **Transportadora** (Correios/Loggi/Frenet/Fallback/Sem) e **Serviço** (PAC, Sedex, Loggi Express — dinâmico). Coluna Transportadora exibe badge + serviço (ex: "Correios · PAC"). **Pedidos com transportadora gateway (`resolved_shipping_provider_kind = 'gateway'`) são excluídos automaticamente da fila local de remessas** — o despacho é feito pela própria transportadora via `gateway-sync-order`. **Aba "Prontos para emitir remessa" (rev 2026-06-08):** ações por linha **Editar** (peso, dimensões, transportadora, serviço, destinatário, valor declarado) e **Excluir**. **O botão "Criar novo objeto" foi removido** — todo Objeto de Postagem nasce a partir de um Pedido de Venda (manual, duplicado ou criado por pedido pago). **Numeração própria (rev 2026-06-08):** cada Objeto de Postagem tem `shipments.numero` sequencial por loja, exibido em destaque na coluna "Objeto" (que substituiu "Pedido"); o Pedido (`Pedido #X`) ou PV (`PV X`) vinculado aparece como texto secundário. Listas ordenadas por `shipments.numero DESC` — objetos recriados por reconciliação voltam ao lugar numérico correto. Qualquer edição manual marca o rascunho como ajustado manualmente — a partir daí o espelhamento automático não recalcula nem apaga aquele registro. **Aba "Pendentes" (rev 2026-06-02):** botão **Reenviar** mostra estado visível de processamento na própria linha enquanto a tentativa está em andamento, evitando clique duplicado e deixando claro que o sistema está reenviando a remessa. Detalhe em `docs/especificacoes/erp/rascunhos-logisticos.md` v2.5.0 e `docs/especificacoes/erp/logistica.md`.
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
- `/command-center?tab=executions` (ExecutionsQueue) — Card **Pedidos** inclui stat `Etiquetas a reverter` (count de `shipments.requires_action = true`); card **Notas Fiscais** inclui stat `NF-e a cancelar (regressão)` (count de `fiscal_invoices.requires_action = true`). Ver `pedidos.md` §4.6.
- `/apps-externos` — Apps externos
- `/system/settings` — Configurações do sistema (abas: **Pagamentos**, **Fiscal** — conteúdo embutido com sub-abas Emitente/Natureza/Outros, sem redirecionamento desde rev 2026-04-17c; **Meios de Envio** — sub-abas Regras de Frete Grátis e Frete Personalizado, rev 2026-05-29)
- `/system/users` — Usuários e permissões (owner only, GatedRoute: `sistema_usuarios`)
- `/settings` — Configurações gerais
- `/settings/domains` — Domínios
- `/settings/billing` — Cobrança
- `/settings/add-payment-method` — Adicionar método de pagamento

**Utilitários:**
- `/import` — Importação de dados (GatedRoute: `sistema_importacao`)
- `/files` — Meu Drive
- `/reports` — Relatórios (FeatureGated: `reports`). Abas via `?tab=overview|products|payments|regions|channels|coupons|affiliates|customers|ga4` e sub-toggle de Regiões `?view=states|cities`. Doc: `docs/especificacoes/sistema/relatorios.md`. Deep-link a partir do bloco "Preview de Vendas" no Dashboard.

**Conta:**
- `/account/data` — Dados da conta
- `/account/billing` — Minha assinatura (foco em plano/faturas) + seção **Extrato de Créditos** (Etapa 1C Fase A3.2: cards Disponível/Reservado/Consumido + histórico via RPC `get_credit_history`, filtros período/tipo, paginação, mascaramento server-side de custo/margem para tenant). Etapa 1C.1: bloco antigo "Uso de Créditos de IA" removido por contradizer o Extrato; descrição das linhas agora exibe "Categoria — Detalhe". Hub completo de créditos segue planejado em `/account/credits`.
- `/account/credits` — **Hub de créditos do tenant (especificado, ainda não implementado).** Abas previstas: Visão geral (default), Comprar créditos (`?tab=buy`), **Extrato de uso** (`?tab=ledger` — histórico oficial de gastos de créditos do tenant), Estimador (`?tab=estimator`). Header global passará a exibir um **chip de saldo de créditos** clicável que navega para esta rota. `/ai-packages` será futuramente redirecionado/incorporado em `/account/credits?tab=buy`. Ver `docs/especificacoes/sistema/ux-creditos-lojista.md`.

**IA e Suporte:**
- `/chatgpt` — ChatGPT (FeatureGated: `assistant`)
- `/ai-memories` — Memórias de IA
- `/ai-packages` — Pacotes IA (rota legada — futuramente redirect/incorporação em `/account/credits?tab=buy`)
- `/support-center` — Central de suporte. **Abas oficiais:** Tickets, AI Config (com toggle Modo Vendas; **rev Onda 1A.1 2026-05-03:** painel reorganizado em **5 abas** — Essencial (contexto do negócio, regras gerais, claims/promessas proibidas), Conhecimento (fontes automáticas, conhecimento adicional, vocabulário e linguagem do nicho), Atendimento (identidade, objeções, regras condicionais, transferência, mídia, tópicos proibidos), Vendas (Modo Vendas), Avançado (modelo de IA, limites, metas, prompt do sistema legado colapsado). Card de **Diagnóstico do contexto da IA** no topo, agora compacto e expansível. Claims gravam em `tenant_brand_context`; `custom_knowledge` aparece em um único lugar (Conhecimento)), Conversas, **Funil WhatsApp** (`WhatsappSalesFunnel.tsx`, consome `whatsapp_sales_funnel_view`: carrinhos, convertidos, handoffs, pedidos, receita, taxa de conversão), **IA Teste** (`AISandboxChat.tsx` — chat sandbox que invoca a IA de Atendimento de produção, conversa em memória, cleanup automático ao fechar; ver `mem://constraints/ai-test-sandbox-mirror-only`). Doc funcional: `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md`. **Histórico de diagnósticos e correções da IA:** `docs/especificacoes/whatsapp/ia-atendimento-changelog.md`.
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
- `/platform/external-costs` — Custos externos e catálogo de preços
- `/platform/credits` — Auditoria de créditos por tenant (Etapa 1D Fase A3.2)

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
- **Card "Catálogos" do Meta (rev 2026-06-12):** ao selecionar um catálogo, o sistema sincroniza os produtos imediatamente. Abaixo do catálogo escolhido aparece um indicador com `X sincronizado(s) · Último envio há Y` e o botão **"Atualizar agora"** para forçar nova sincronização manual. Cron diário às 05:00 UTC mantém o catálogo atualizado e falhas aparecem na Central de Execuções (categorias `integracao_meta_catalogo` e `integracao_meta_catalogo_parcial`). Detalhe em `docs/especificacoes/marketplaces/meta-catalogo.md`.
- Referência: memória `integration-hub-ui-standard`, memória `meta-token-lifecycle`, memória `meta-catalog-canonical-id-and-autosync`

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

### 7.2.1 Contrato de rolagem do Admin

- O `AppShell` é a única área rolável vertical padrão do painel admin (`main` com `overflow-y-auto`).
- Páginas internas como `/orders/new` e `/products` não devem adicionar padding inferior extra na raiz apenas para “dar respiro” visual.
- Quando houver barra de ação fixa dentro da própria tela, a compensação inferior deve existir somente no container do conteúdo realmente coberto por essa barra, nunca duplicada na página pai.
- Em layouts com grid, colunas laterais resumidas devem usar altura intrínseca (`self-start`) quando o estiramento da grid aumentar artificialmente a área visual vazia.

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


### Sistema → Configurações → Fiscal → Configurações Fiscais — Ambiente de Emissão

- Bloco passa a ser somente leitura para o lojista (status informativo).
- Sem dropdown Homologação/Produção na UI comum. Troca é controle técnico/admin.

### Sistema → Configurações → Fiscal → Configurações Fiscais — Regime Tributário (rev 2026-05-19)

- Seletor "Regime Tributário (CRT)" em Parâmetros Fiscais passa a oferecer **4 opções** (antes eram 3):
  1. `1 - Simples Nacional`
  2. `2 - Simples Nacional (excesso de sublimite)`
  3. `3 - Regime Normal (Lucro Presumido/Real)`
  4. **`4 - Simples Nacional - MEI (Microempreendedor Individual)`** ← nova
- Selecionar CRT=4 auto-define internamente `regime_tributario='mei'` e envia para a SEFAZ o código fiscal correto (4), eliminando rejeição por divergência cadastral em CNPJs MEI. Tratamento na NF é idêntico ao Simples Nacional (sem destaque de PIS/COFINS/ICMS, CSOSN padrão 102). Ver `docs/especificacoes/erp/erp-fiscal.md` §"Cálculo Automático de Impostos por Regime".

### Fiscal → Notas Fiscais → Menu da linha — NF rejeitada (rev 2026-05-20)

Reordenado para separar reenvio puro de edição. Notas em status **Rejeitada** passam a oferecer, nesta ordem:

1. **Reenviar para SEFAZ** (verde, ícone Send) — reenvia a mesma NF sem abrir editor. Cobre rejeições não causadas pelo conteúdo da nota (SEFAZ fora do ar, regime tributário corrigido nas Configurações Fiscais, certificado renovado, etc.).
2. **Editar e Reemitir** — abre o editor completo para alterar dados antes de reenviar.
3. **Duplicar como rascunho** — clona em novo rascunho preservando o original.
4. **Excluir** (vermelho, no rodapé do menu).

Antes, o menu obrigava o usuário a abrir o editor (`Editar e Reemitir`) mesmo quando a nota estava correta, gerando atrito e risco de alteração indevida. Detalhe em `docs/especificacoes/erp/erp-fiscal.md` §"Ações para NF rejeitada".



### Gestor de Tráfego IA — Fluxo de duas etapas (Frente 4, rev 2026-06-09)

- `/ads` — aba **Propostas pendentes**:
  - **Etapa 1 (status `pending_approval` de propostas novas com marcador `two_step_v1`):** o card mostra um bloco **"Prompt do criativo"** com o prompt aprovado e o formato sugerido, mais o aviso *"Nenhum crédito será consumido até você aprovar a geração dos criativos."*. O botão principal é **"Aprovar e gerar criativos"** (substitui o "Aprovar" tradicional somente para propostas novas).
  - **Etapa 2 (status `creative_pending`):** o card exibe a faixa "Gerando criativos…" e o botão "Acompanhar geração" abre o **diálogo da Etapa 2** (`CreativeGenerationStepDialog`).
  - **Aguardando aprovação final (status `final_pending_approval`):** o card exibe "Criativos prontos — aguardando aprovação final" e o botão "Revisar e aprovar campanha" abre o mesmo diálogo, agora com galeria dos criativos, prompt usado e resumo final (objetivo, público, exclusões, copy, headline, CTA, orçamento, link).
  - **Diálogo da Etapa 2:** botões **"Aprovar campanha final"**, **"Reprovar"** e **"Fechar"**. A aprovação final segue para o fluxo de publicação atual; a reprovação registra `rejection_reason`.
  - **Propostas legadas** (sem marcador `two_step_v1`) **mantêm o card e o botão "Aprovar" originais** — nenhum retrofit obrigatório.
  - Fila reconhece os 3 estados ativos (`pending_approval`, `creative_pending`, `final_pending_approval`) — contadores e badges não escondem mais propostas em geração ou aguardando aprovação final.

### Gestor de Tráfego IA — Inteligência produto×funil e modal por blocos (Frente 4.1, rev 2026-06-09)

- `/ads` — aba **Propostas pendentes**:
  - **Badge de adequação produto×público** no cabeçalho do card e no topo do modal da Etapa 1, com 5 estados: **Adequação alta** (verde), **média** (azul), **baixa** (âmbar), **Bloqueada** (vermelho), **Composição incerta** (âmbar).
  - **Soft-block:** quando o gate bloqueia (ex.: kit de quantidade em Público Frio), aparece um **alerta vermelho** dentro do card com a mensagem amigável e a lista de ações sugeridas (trocar produto / mover para Remarketing / revisar cadastro). O botão "Aprovar e gerar criativos" fica **desabilitado** e troca o rótulo para **"Ajuste necessário antes de aprovar"**. Os botões "Ajustar" e "Rejeitar" continuam disponíveis.
  - **Modal "Ver conteúdo completo" — Etapa 1 do `two_step_v1`** abandona as abas e passa a usar **blocos verticais empilhados**: (1) Adequação produto×público, (2) Resumo da recomendação, (3) Produto e oferta (com tipo comercial, composição e preço), (4) Público e exclusões, (5) Prompt & Copy (aviso amarelo + prompt limpo + "Formato sugerido: 1:1" + headlines + textos principais + miniatura "Referência visual do produto"), (6) Riscos e validações, (7) **Detalhes técnicos** num `<details>` recolhido por padrão (contém `flow_version`, `product_id`, `creative_brief` cru, `reason_codes`, `classification_signals`).
  - **Imagem do produto** continua aparecendo apenas como miniatura rotulada "Referência visual do produto" e nunca é contada como criativo final.
  - Etapa 2 (`creative_pending` / `final_pending_approval`) e propostas legacy seguem usando o layout de abas atual — não há retrofit.
  - Detalhe operacional e regras anti-regressão em `docs/especificacoes/marketing/gestor-trafego.md` §13.

### Gestor de Tráfego IA — Editor estruturado, versionamento e feedback (Frentes 4.2/4.3/4.4, rev 2026-06-09)

**Frente 4.2 — Modal completo.** O modal "Ver conteúdo completo" da Etapa 1 do `two_step_v1` agora abre com um bloco **"Campanha"** dedicado (nome, objetivo, canal, orçamento diário, link de destino como hyperlink, CTA). Os demais blocos verticais e o "Detalhes técnicos" recolhido seguem inalterados. Payload técnico bruto continua proibido fora de "Detalhes técnicos".

**Frente 4.3 — Editor estruturado.** O botão **"Ajustar"** em propostas `two_step_v1 strategy` abre um **drawer lateral à direita** (`sm:max-w-xl`, fullscreen em mobile) com formulário em blocos (Campanha / Produto / Público / Criativo / Feedback). Canal e referência visual são **somente leitura**. Botões do rodapé:

- **Descartar** — apaga o rascunho salvo.
- **Salvar rascunho** — persiste em banco (`action_data.draft_patch`), **sem chamar IA**.
- **Gerar proposta revisada** — abre confirmação e dispara **uma única** chamada à IA. Bloqueado quando há erro de validação local, Fit Gate `soft_block`, ou nenhum campo alterado.

A proposta antiga vira `superseded` e a nova vira filha (`parent_action_id` + `superseded_by_action_id`). A versão antiga **some** automaticamente da fila "Aguardando Ação". O histórico fica preservado em `action_data.adjustment_history` da versão arquivada e em `action_data.revision_source` da nova.

Propostas legacy (sem `flow_version='two_step_v1'`) continuam usando o "Sugerir Ajuste" textual antigo como fallback.

**Frente 4.4 parcial — Feedback.** O gate de feedback (`useAdsAutopilotFeedbackGate`) já interceptava Aprovar e Rejeitar com chips de motivo + textarea — sem mudança nesta entrega. No editor estruturado o feedback de ajuste (motivo, chips, observação) vai junto com o patch para a IA, mas ainda **não altera** o Strategist (entrega futura).

### Gestor de Tráfego IA — Visualização Estruturada de Propostas (rev 2026-06-10, v6.13.0)

**Card da fila "Aguardando Ação" — propostas de campanha estruturadas.** Para Nova Campanha (`create_campaign`), Etapa 1 do `two_step_v1` e payloads legacy que o adapter classifica como campanha (Campanha → Conjunto(s) → Anúncio(s)), o card passa a ter **um único CTA: "Visualizar proposta"**. Os botões **Aprovar / Ajustar / Rejeitar não aparecem mais no card** — só dentro do modal. O resumo do card continua exibindo: tipo da ação, nome da campanha, funil, adequação produto×público, orçamento, produto/oferta, selo "Etapa 1 — estratégia" quando aplicável, aviso "Nenhum criativo final foi gerado ainda" quando aplicável. Propostas operacionais legacy (pausa, ajuste de orçamento, plano estratégico, conjuntos órfãos) mantêm o card antigo com 3 botões.

**Modal "Visualizar proposta".** Abre em tela cheia (`max-w-5xl`, `90vh`) com **árvore lateral no desktop** e **lista empilhada horizontal no mobile**. Nós: Visão Geral · Campanha · Conjuntos (1..N) · Anúncios (1..N) · Validações · Histórico. Bloco "Detalhes técnicos" recolhido por padrão em todos os nós.

**Rodapé fixo do modal — único local das decisões.** Ordem: **Recusar proposta** (esquerda, ghost vermelho) · **Ajustar proposta** (centro, outline) · **Aprovar estratégia e gerar criativos** (direita, primary). Em propostas legacy não-two_step o rótulo do primário vira "Aprovar". O botão de aprovação fica **desabilitado** quando o Product/Funnel Fit Gate sinaliza bloqueio, com tooltip explicando o motivo.

**Editor estruturado.** Continua sendo o drawer da Frente 4.3, agora aberto pelo "Ajustar proposta" de dentro do modal. Seções renomeadas para refletir a hierarquia: **Campanha** · **Conjunto de anúncios** (engloba Público + Segmentação + Exclusões) · **Anúncio** (engloba Produto + Copy + Criativo) · **Feedback para a IA**. Mutations, rascunho, versionamento e feedback permanecem idênticos.

**Anti-regressão.** Card de proposta estruturada **não pode** voltar a exibir Aprovar/Ajustar/Rejeitar diretamente. Modal **não pode** voltar a exibir payload bruto no corpo principal — apenas em "Detalhes técnicos" recolhido. Adapter `normalizeCampaignStructure` **não pode** mutar `action_data`. Compatibilidade com payload legacy é obrigatória. Detalhe operacional, regras anti-processamento (0 chamadas IA ao abrir/navegar/editar/salvar) e contrato `campaign_structure` em `docs/especificacoes/marketing/gestor-trafego.md` "Visualização Estruturada de Propostas (v6.13.0)".

### Gestor de Tráfego IA — Validações de completude e compatibilidade (Onda 0 + A + B mínima, rev 2026-06-10)

- `/ads` — modal estruturado de proposta:
  - Aba **Visão Geral** ganha bloco **"Validações"** que lista bloqueios em vermelho (com nome do nó: Campanha, Conjunto 1, Anúncio 2…) e alertas em cinza. Campo obrigatório ausente **nunca** aparece como `—` silencioso — vira bloqueio amigável em PT-BR. Quando a IA não consegue preencher um campo crítico (ex.: evento de conversão sem Pixel confirmado), o registro vem como `requires_user_input` e o gate explica "Confirme o evento de conversão antes de aprovar".
  - **Rodapé fixo** mostra uma faixa amarela com a razão do bloqueio quando o botão de aprovação está desabilitado. O botão **"Aprovar estratégia e gerar criativos"** fica **bloqueado** sempre que houver qualquer bloqueio do Structure Completeness Gate, do Platform Compatibility Gate (inicial) ou do Product/Funnel Fit Gate. "Ajustar proposta" e "Recusar proposta" continuam disponíveis.
  - Plataformas marcadas como **não verificadas** (Google Ads e TikTok Ads nesta entrega) sempre bloqueiam aprovação e geração de criativo até verificação humana. Meta Ads opera normalmente enquanto a baseline estiver dentro de 60 dias.
- Detalhe e fontes oficiais em `docs/especificacoes/marketing/gestor-trafego.md` (seção "Motor de Propostas — Onda 0 + A + B mínima") e `docs/especificacoes/marketing/plataformas-baseline.md`.

### Gestor de Tráfego IA — Ownership de campos por nível (Onda C, rev 2026-06-10)

- `/ads` — modal estruturado de proposta:
  - **Aba Campanha** deixa de exibir "Link de destino" e "Botão de ação" como configurações principais. Esses campos pertencem ao Anúncio/Criativo. Quando o payload legado guardou os dois no topo, surge um bloco secundário **"Resumo herdado dos anúncios"** apenas em leitura.
  - **Aba Conjunto** mostra **selo "Pendente · Obrigatório"** (vermelho) no lugar de `—` para campos obrigatórios pendentes (região, idade, gênero, posicionamentos, meta de otimização, evento de conversão).
  - **Aba Anúncio** passa a separar visualmente dois blocos: **Anúncio** (nome, conjunto vinculado, status) e **Criativo do anúncio** (CTA, link, tracking, copy, formato). A árvore lateral mantém um único item "Anúncio N".
  - Botão **"Ajustar proposta"** rola o editor estruturado direto para a seção correta (campanha / conjunto / anúncio) com base no `node_type` do primeiro blocker.
  - Erros de objetivo (ex.: `SALES`) deixam de aparecer como texto técnico. Mensagem é em PT-BR amigável e o gate passa a usar o mapper canônico ↔ Meta antes de comparar.
- Detalhe da Platform Field Ownership Matrix, Objective Mapper e GateIssue v2 em `docs/especificacoes/marketing/gestor-trafego.md` (seção "Motor de Propostas — Onda C").

### Gestor de Tráfego IA — Status técnico Meta na UI estratégica (rev 2026-06-10, correção Onda D→F)

- `/ads` → aba **Configurações Gerais** é dedicada às **diretrizes estratégicas do usuário**: ativação da IA, execução automática diária, orçamento, ROI ideal, ROI mínimo por funil, estratégia geral, splits de funil, prompt estratégico e botão de geração de prompt com IA.
- **Removido da UI principal:** o formulário manual "Configuração de Criação Meta" (Página do Facebook, Conta do Instagram, Pixel/Dataset, evento de conversão padrão, IDs técnicos, públicos personalizados, posicionamentos, CTA/formato padrão etc.). Esses ativos são responsabilidade da **integração Meta** e devem ser coletados via sincronização read-only, não digitados pelo usuário na tela estratégica.
- **No card de cada conta Meta** passa a aparecer apenas um **status inline somente leitura**:
  - **OK:** "Meta conectada. Ativos técnicos sincronizados pela integração." (quando Página, Pixel e evento de conversão estão disponíveis na configuração interna).
  - **Pendência:** alerta curto listando o que a integração não detectou (ex.: "Pixel não detectado") com link para **Integrações**. Nunca pede ao usuário para digitar IDs técnicos nessa tela.
- **Backend preservado:** a tabela `ads_meta_production_config` e o hook `useAdsMetaProductionConfig` continuam existindo como **estrutura operacional interna** — preenchidos por integração/sync ou ajuste técnico avançado, e consumidos pelo Strategist e pelos gates. O componente `MetaProductionConfigCard` deixa de ser renderizado na UI principal; eventual fallback manual fica restrito à área técnica de integração (não é o fluxo principal).
- **Gates por etapa:**
  - **Análise/estratégia:** não é bloqueada por ausência de Pixel/Página/Instagram — ausência vira `limitations` no `ads_ai_analysis_runs`.
  - **Proposta/criativo:** usa diretrizes estratégicas + dados do produto.
  - **Publicação (futura):** exigirá Página, identidade do anúncio, Pixel/dataset (quando objetivo demandar conversão), evento e permissões.
- Detalhe técnico em `docs/especificacoes/marketing/gestor-trafego.md` (seção "Configurações Gerais — separação estratégia × ativos técnicos") e baseline em `docs/especificacoes/marketing/plataformas-baseline.md`.

### Integrações Meta — Identidade dos Anúncios (rev 2026-06-10)

- `/integrations` → card **Meta → grupo Marketing & Conversão → linha Anúncios**: ao ativar a integração, o usuário primeiro seleciona uma ou mais **Contas de Anúncio** (multi-seleção). Logo abaixo, uma seção expansível **"Identidade dos Anúncios"** permite escolher a **Página do Facebook** (obrigatória) e, opcionalmente, a **conta do Instagram** que serão usadas como identidade de publicação dos anúncios criados nessa conta Meta.
- Página e Instagram para anúncios passam a viver **dentro da própria integração de Anúncios** — não são derivados das integrações de **Publicações**, **Comentários**, **Messenger**, **Direct** ou **Leads**, que tratam de fluxo orgânico/atendimento e podem perfeitamente estar desligadas.
- O **status técnico Meta** no Gestor de Tráfego IA (`/ads`) passa a exigir: Conta de Anúncio + Página vinculada aos anúncios + Pixel + API de Conversões — todos lidos de `tenant_meta_integrations`. Ausência de Página dentro de Anúncios mantém o alerta de pendência com link para Integrações.




### Gestor de Tráfego IA — Ativação por modos e análise inicial (Onda E, rev 2026-06-10)

- `/ads` → ao **ligar o switch da IA** de uma conta Meta pela primeira vez, abre um diálogo com duas opções:
  - **Modo Piloto:** ativa a IA e segue o fluxo normal. Não chama IA no momento da ativação. Não cria execução de análise.
  - **Modo Piloto Inicial (Recomendado):** ativa a IA e roda uma análise estratégica inicial da conta. Avalia configurações, orçamento, ROI, diretrizes e campanhas atuais. Cria propostas na fila "Aguardando Ação". Não publica campanha, não gera criativo final automaticamente.
- `/ads` → no card da conta Meta com IA ativa, novo bloco **"Análise inicial estratégica"** com botão **"Rodar análise inicial agora"**.
  - Exige confirmação explícita antes de executar.
  - Bloqueia execução se já existir análise em andamento para o mesmo escopo.
  - Se a última análise foi concluída há menos de 24h, abre confirmação extra para evitar consumo desnecessário de IA.
  - Mostra data/hora da última análise concluída.
- `/ads` → topo do **Gerenciador de Anúncios**, novo bloco **"Análise inicial global"** (correção 2026-06-10):
  - Roda a análise inicial em todas as contas Meta com IA ativada de uma vez.
  - Mostra contagem de contas Meta elegíveis.
  - Mesmas travas: confirmação explícita, bloqueio se há análise global em andamento, confirmação extra se concluída há menos de 24h.
  - Se o tenant tem contas Google/TikTok configuradas, exibe limitação amigável: "Google Ads e TikTok Ads ainda não estão operacionais nesta etapa e serão ignorados." Não bloqueia a análise da Meta.
  - Se uma conta específica já está em análise individual, é pulada do lote sem quebrar as demais.
  - Cada conta gera uma run filha (`scope=account`) com seu próprio resumo de contexto; o painel mostra um resumo global consolidado.
- Histórico das análises é persistido em tabela própria (`ads_ai_analysis_runs`) para auditoria, com snapshot do contexto usado, diagnóstico, estratégia, limitações e IDs das propostas criadas.
- Detalhe em `docs/especificacoes/marketing/gestor-trafego.md` seção "Onda E — Modo Piloto vs Modo Piloto Inicial".


### `/ads` — Configurações Gerais → Aprendizados da IA (Onda F, 2026-06-12)

Nova área dentro de **Gestor de Tráfego IA → Configurações Gerais**, abaixo do bloco de Regras Globais.

- Lista os aprendizados específicos do Gestor de Tráfego com filtros por status (Todos · Sugeridos · Ativos · Pausados · Arquivados).
- Cada item mostra: título, categoria, descrição, origem, data, quantidade de evidências e confiança.
- Ações por item: Ativar / Pausar / Editar / Arquivar / Remover.
- Botão "Novo aprendizado" abre diálogo para criação manual (já nasce ativo).
- Aprendizados gerados a partir de feedback nascem como **Sugeridos** — usuário decide se ativa.
- **Somente aprendizados Ativos entram nas próximas análises da IA.**
- Esta área é exclusiva do Gestor de Tráfego e não compartilha dados com a área genérica "Memórias da IA" de outros agentes.
- Detalhe em `docs/especificacoes/marketing/gestor-trafego.md` seção "F — Onda F".

### `/ads` — Gate de UTM no nível Anúncio/Criativo (Onda F, 2026-06-12)

- O modal de proposta detalhada passa a bloquear a aprovação do Anúncio quando o link final não contém UTMs obrigatórias (`utm_source`, `utm_medium`, `utm_campaign`).
- A mensagem é amigável: "Este anúncio precisa de UTM no link final antes de ser aprovado." e aponta para o nó do Anúncio/Criativo (não para a Campanha).
- O Strategist passa a aplicar automaticamente o modelo padrão interno de UTM ao gerar a proposta — não há campo configurável de UTM na UI nesta entrega.
