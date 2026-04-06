# MANUAL DO SISTEMA

> **Status:** ✅ Ativo  
> **Versão:** 1.0.0  
> **Camada:** Layer 4 — Manual do Sistema  
> **Última atualização:** 2026-04-03  
> **Snapshot de referência:** 2026-04-03 (contagens são inventário da data, não rígidas)

---

## 1. PROPÓSITO DO MANUAL

Este documento é a **referência técnica ampla e consolidada** do Orbit Commerce OS.

Ele serve como:

- Inventário técnico do sistema
- Mapa geral de domínios, módulos, rotas, tabelas, edge functions e integrações
- Referência de arquitetura e convenções
- Apoio de consulta para entendimento global do projeto

**O que este documento NÃO faz:**

- Não governa conduta da IA (→ Layer 1)
- Não define regras estruturais canônicas (→ Layer 2)
- Não substitui especificações funcionais detalhadas (→ Layer 3)
- Não sobrescreve nenhuma camada superior

---

## 2. HIERARQUIA DOCUMENTAL

| Layer | Documento | Governa | Autoridade |
|-------|-----------|---------|------------|
| 1 — Governança | Knowledge (Custom Instructions) | Conduta da IA | Comportamento |
| 2 — Regras do Sistema | `docs/REGRAS-DO-SISTEMA.md` | Estrutura macro, contratos, fontes de verdade | Estrutural |
| 3 — Especificações | `docs/ESPECIFICACOES-DOS-MODULOS.md` + `docs/especificacoes/` | Comportamento funcional por módulo | Funcional |
| 4 — Manual do Sistema | **Este documento** | Referência ampla, inventário, arquitetura | Referência |

### Regra de Conflito

| Conflito sobre... | Quem resolve |
|--------------------|-------------|
| Como a IA age | Layer 1 |
| Regra estrutural ou contrato | Layer 2 |
| Detalhe funcional de módulo | Layer 3 |
| Contexto, inventário, arquitetura | Layer 4 (este) |

Este Manual **referencia e organiza**. Nunca sobrepõe.

---

## 3. VISÃO GERAL DO SISTEMA

**Orbit Commerce OS** é um sistema SaaS multi-tenant para e-commerce brasileiro, voltado para lojistas que vendem via loja própria e marketplaces.

### Proposta de Valor

- Loja online completa com builder visual e checkout integrado
- ERP simplificado (fiscal, estoque, logística, compras)
- CRM com atendimento multi-canal e IA
- Gestão de tráfego com IA (Meta, Google, TikTok)
- Marketplaces integrados (Mercado Livre, Shopee, TikTok Shop)
- Programa de afiliados e influencers
- Email marketing com automações
- 3 agentes de IA embutidos

### Core do Sistema

O core se apoia em três entidades:

| Entidade | Tabela | Papel |
|----------|--------|-------|
| Produtos | `products` | Catálogo, variantes, estoque, precificação |
| Clientes | `customers` | Base de clientes, métricas, tags |
| Pedidos | `orders` | Transações, estado, atribuição, fiscal |

Tudo no sistema é **tenant-scoped** — toda operação valida `tenant_id`.

---

## 4. ARQUITETURA GERAL

### 4.1 Frontend

| Item | Tecnologia |
|------|-----------|
| Framework | React 18 + TypeScript 5 |
| Build | Vite 5 (→ 7) com code splitting |
| Estilo | Tailwind CSS v3 + shadcn/ui |
| Estado | React Query (TanStack) + hooks locais |
| Roteamento | React Router v6 |
| Animações | Framer Motion (seletivo) |

**Code splitting:** O bundle é dividido em dois grandes grupos — Admin e Storefront — carregados via `lazy()`. Páginas de conteúdo público (home, categoria, produto, blog) são renderizadas via **Edge (Cloudflare Worker)**, não pelo SPA.

### 4.2 Backend

| Item | Tecnologia |
|------|-----------|
| Plataforma | Supabase (hospedado) |
| Banco | PostgreSQL com RLS |
| Auth | Supabase Auth (email/senha + OAuth) |
| Funções | Edge Functions (Deno) |
| Realtime | Supabase Realtime (canais seletivos) |
| Storage | Supabase Storage (8 buckets) |

### 4.3 Banco de Dados

- ~288 tabelas no schema `public` (snapshot da data)
- RLS ativo em tabelas sensíveis, scoped por `tenant_id`
- Triggers para métricas de clientes, estoque e auditoria
- Schema gerenciado via migrations SQL versionadas

### 4.4 Integrações Externas

O sistema integra com provedores de pagamento, fiscal, logística, marketplaces, redes sociais e comunicação. Detalhes na Seção 10.

### 4.5 Storage (8 Buckets)

| Bucket | Conteúdo |
|--------|----------|
| `product-images` | Imagens de produtos |
| `store-assets` | Assets da loja (logo, banners, favicon) |
| `media-assets` | Mídias de campanhas e criativos |
| `tenant-files` | Arquivos gerais do tenant |
| `published-assets` | Assets publicados do storefront |
| `review-media` | Fotos de avaliações |
| `email-attachments` | Anexos de email |
| `system-voice-presets` | Presets de voz para IA |

### 4.6 IA no Sistema

| Tipo | Exemplos | Papel |
|------|----------|-------|
| **Agentes** (4) | Assistente IA (ChatGPT), Auxiliar de Comando, Gestor de Tráfego IA, Agenda | Entidades autônomas com escopo e permissões próprias |
| **Funções embutidas** | Descrições de produto, criativos, landing pages, blocos, SEO, suporte | Capacidades de IA dentro de módulos existentes |

Regras completas dos agentes → Layer 2, Seção 9.

---

## 5. GRANDES DOMÍNIOS DO PRODUTO

O sistema é organizado em **9 domínios funcionais**:

| # | Domínio | Escopo |
|---|---------|--------|
| 1 | **E-commerce** | Core transacional: produtos, clientes, pedidos, categorias, descontos |
| 2 | **Storefront** | Loja pública: builder, páginas, checkout, carrinho, blog, landing pages |
| 3 | **Marketing** | Ofertas, criativos, campanhas, tráfego pago, email marketing, quizzes |
| 4 | **CRM** | Atendimento, suporte, ChatGPT, WhatsApp, checkouts abandonados |
| 5 | **ERP** | Fiscal (NF-e), financeiro, compras, logística |
| 6 | **Marketplaces** | Mercado Livre, Shopee, TikTok Shop, extrator B2B |
| 7 | **Sistema** | Central de comando, configurações, importação, usuários, billing, domínios |
| 8 | **Plataforma** | Administração SaaS: saúde, billing da plataforma, emails, tenants |
| 9 | **Parcerias** | Afiliados e influencers |

---

## 6. MAPA DE MÓDULOS

Referência completa e detalhada → `docs/ESPECIFICACOES-DOS-MODULOS.md` (Layer 3).

### Resumo por Domínio (56 módulos)

| Domínio | Módulos | ✅ | 🟧 |
|---------|---------|----|----|
| Transversais | Padrões UI | 1 | 0 |
| E-commerce | Pedidos, Produtos, Categorias, Clientes, Descontos | 5 | 0 |
| Storefront | Builder, Header, Footer, Carrinho, Checkout, Produto, Categoria, Obrigado, Institucionais, Blog, Landing Pages, Cores, Loja Virtual | 13 | 0 |
| Marketing | Ofertas, Avaliações, Mídias, Imagens IA, Campanhas, Criativos, AI Criativos, **Gestor Tráfego IA**, Integrações, Email Marketing, Quizzes | 9 | 2 |
| CRM | Atendimento, Suporte, Pacotes IA, ChatGPT, Checkouts Abandonados | 3 | 2 |
| ERP | Fiscal, Logística, PagBank | 2 | 1 |
| Marketplaces | Mercado Livre, Shopee, TikTok Shop, Extrator B2B | 2 | 2 |
| Sistema | Central, Auxiliar, Usuários, Planos, Configurações, Importação, Integrações, Domínios, Tenants, Edge Functions | 9 | 1 |
| Plataforma | Admin, Emails | 2 | 0 |
| Parcerias | Afiliados, Influencers | 0 | 2 |
| **Total** | | **44** | **12** |

---

## 7. MAPA DE ROTAS PRINCIPAIS

### 7.1 Rotas Admin (Protegidas)

| Grupo | Rotas Principais | Descrição |
|-------|------------------|-----------|
| **Dashboard** | `/command-center`, `/chatgpt`, `/getting-started` | Central de comando, assistente, onboarding |
| **E-commerce** | `/orders`, `/orders/:id`, `/products`, `/categories`, `/customers`, `/customers/:id` | Core transacional |
| **Storefront** | `/storefront`, `/storefront/builder`, `/pages`, `/menus`, `/blog` | Gestão da loja |
| **Marketing** | `/offers`, `/discounts`, `/reviews`, `/media`, `/campaigns`, `/creatives`, `/ads` | Marketing e vendas |
| **CRM** | `/notifications`, `/support`, `/emails`, `/abandoned-checkouts`, `/email-marketing` | Atendimento e retenção |
| **ERP** | `/fiscal`, `/fiscal/products`, `/finance`, `/purchases`, `/shipping` | Operações |
| **Marketplaces** | `/marketplaces`, `/marketplaces/mercadolivre`, `/marketplaces/shopee`, `/marketplaces/tiktokshop` | Canais de venda |
| **Sistema** | `/settings`, `/integrations`, `/import`, `/system/users`, `/files`, `/reports` | Configuração |
| **Plataforma** | `/platform/health-monitor`, `/platform/billing`, `/platform/emails`, `/platform/tenants` | Admin SaaS |
| **Parcerias** | `/affiliates`, `/influencers` | Programas |
| **Builders** | `/storefront/builder`, `/pages/:id/builder`, `/blog/:id/editor`, `/landing-pages/:id` | Editores visuais |

### 7.2 Rotas Storefront (Loja Pública)

| Tipo | Rotas | Renderização |
|------|-------|-------------|
| **Edge (SSR)** | `/` (home), `/categoria/:slug`, `/produto/:slug`, `/blog/*`, páginas | Cloudflare Worker |
| **SPA interativas** | `/cart`, `/checkout`, `/obrigado`, `/busca`, `/quiz/:slug` | React SPA |
| **Área do cliente** | `/conta`, `/conta/login`, `/conta/pedidos`, `/conta/pedidos/:id` | React SPA |
| **Rastreio** | `/rastreio` | React SPA |

> Rotas SPA funcionam em dois modos: domínio do tenant (raiz) ou `/store/:tenantSlug` (fallback).

### 7.3 Rotas Públicas (Não-protegidas)

| Rota | Função |
|------|--------|
| `/auth` | Login e cadastro |
| `/start`, `/start/info`, `/start/pending` | Fluxo de onboarding/billing |
| `/complete-signup` | Conclusão de cadastro |
| `/integrations/*/callback` | OAuth callbacks (Meta, Meli, TikTok, YouTube, Threads) |

---

## 8. MAPA DE DADOS — TABELAS PRINCIPAIS POR DOMÍNIO

O banco possui ~288 tabelas. Abaixo, as principais agrupadas por domínio funcional.

### 8.1 E-commerce (Core)

| Tabela | Função |
|--------|--------|
| `products`, `product_variants`, `product_images` | Catálogo e variantes |
| `product_categories`, `categories` | Categorização |
| `product_components` | Kits e combos |
| `customers`, `customer_addresses`, `customer_tags`, `customer_tag_assignments` | Base de clientes |
| `orders`, `order_items`, `order_history`, `order_attribution` | Pedidos |
| `payment_transactions`, `payment_providers`, `payment_methods` | Pagamentos |
| `discounts`, `discount_redemptions` | Cupons e promoções |
| `offer_rules`, `buy_together_rules`, `related_products` | Ofertas |
| `product_reviews`, `review_tokens` | Avaliações |

### 8.2 Storefront

| Tabela | Função |
|--------|--------|
| `storefront_global_layout` | Layout e configurações do builder |
| `storefront_templates`, `storefront_template_sets` | Templates e conjuntos |
| `storefront_page_templates` | Templates de páginas |
| `store_pages`, `store_page_versions` | Páginas e versionamento |
| `store_settings` | Configurações visuais da loja |
| `menu_items`, `menus` | Menus de navegação |
| `blog_posts` | Blog |
| `ai_landing_pages`, `ai_landing_page_versions` | Landing pages IA |
| `checkout_sessions`, `checkout_testimonials` | Checkout |
| `carts`, `cart_items` | Carrinho |
| `newsletter_popup_configs` | Popups de newsletter |
| `custom_blocks`, `block_implementation_requests` | Blocos customizados |

### 8.3 Marketing e Tráfego

| Tabela | Função |
|--------|--------|
| `meta_ad_campaigns`, `meta_ad_adsets`, `meta_ad_ads`, `meta_ad_insights` | Meta Ads |
| `google_ad_campaigns`, `google_ad_insights`, `google_ad_keywords` | Google Ads |
| `tiktok_ad_campaigns`, `tiktok_ad_insights` | TikTok Ads |
| `ads_autopilot_configs`, `ads_autopilot_sessions`, `ads_autopilot_actions` | IA de tráfego |
| `ads_creative_assets`, `creative_jobs` | Criativos |
| `media_campaigns`, `media_library`, `media_asset_generations` | Mídias |
| `marketing_integrations`, `marketing_events_log` | Integrações e tracking |
| `email_marketing_campaigns`, `email_marketing_lists`, `email_marketing_subscribers` | Email marketing |
| `quizzes`, `quiz_questions`, `quiz_responses` | Quizzes |

### 8.4 CRM e Comunicação

| Tabela | Função |
|--------|--------|
| `conversations`, `messages`, `message_attachments` | Inbox unificado |
| `support_tickets`, `support_ticket_messages` | Suporte |
| `chatgpt_conversations`, `chatgpt_messages` | ChatGPT |
| `command_conversations`, `command_messages` | Auxiliar de Comando |
| `whatsapp_configs`, `whatsapp_messages` | WhatsApp |
| `notifications`, `notification_rules`, `notification_logs` | Notificações |
| `ai_support_config`, `ai_channel_config` | Config IA de atendimento |
| `ai_memories`, `ai_conversation_summaries` | Memória e contexto IA |
| `knowledge_base_docs`, `knowledge_base_chunks` | Base de conhecimento |

### 8.5 ERP

| Tabela | Função |
|--------|--------|
| `fiscal_invoices`, `fiscal_invoice_items`, `fiscal_invoice_events` | NF-e |
| `fiscal_settings`, `fiscal_products`, `fiscal_operation_natures` | Config fiscal |
| `finance_entries`, `finance_entry_types` | Financeiro |
| `purchases`, `purchase_items`, `suppliers` | Compras |
| `shipments`, `shipment_events` | Remessas |
| `shipping_providers`, `shipping_quotes` | Frete |

### 8.6 Marketplaces

| Tabela | Função |
|--------|--------|
| `marketplace_connections`, `marketplace_sync_logs` | Hub de conexões |
| `meli_listings` | Mercado Livre |
| `tiktok_shop_products`, `tiktok_shop_orders` | TikTok Shop |
| `external_entity_mappings` | Mapeamento de entidades externas |

### 8.7 Sistema

| Tabela | Função |
|--------|--------|
| `tenants`, `special_tenants` | Multi-tenancy |
| `profiles`, `user_roles`, `tenant_invites` | Usuários e permissões |
| `import_jobs`, `import_items` | Importação |
| `files` | Gestão de arquivos |
| `credit_wallet`, `credit_ledger`, `credit_packages` | Créditos IA |
| `events_inbox` | Fila de eventos |

### 8.8 Plataforma

| Tabela | Função |
|--------|--------|
| `platform_admins`, `platform_credentials` | Admin da plataforma |
| `tenant_subscriptions`, `tenant_invoices` | Billing do tenant |
| `billing_plans`, `billing_checkout_sessions` | Planos e checkout SaaS |
| `tenant_domains` | Domínios customizados |
| `system_health_checks` | Monitoramento |

### 8.9 Parcerias

| Tabela | Função |
|--------|--------|
| `affiliates`, `affiliate_links`, `affiliate_clicks`, `affiliate_conversions`, `affiliate_payouts` | Afiliados |
| `affiliate_programs` | Config do programa |
| `influencer_leads`, `influencer_interactions` | Influencers |

---

## 9. MAPA DE EDGE FUNCTIONS

O sistema possui ~320 edge functions (snapshot da data), agrupadas por domínio.

### 9.1 Checkout e Pagamentos

| Função | Papel |
|--------|-------|
| `checkout-create-order` | Criação atômica do pedido |
| `pagarme-create-charge`, `mercadopago-create-charge`, `pagbank-create-charge` | Cobranças por gateway |
| `pagarme-webhook`, `mercadopago-storefront-webhook`, `pagbank-webhook` | Webhooks de pagamento |
| `retry-card-payment` | Retentativa de cartão |
| `checkout-session-*` | Gestão de sessões de checkout |
| `reconcile-payments` | Reconciliação de pagamentos |
| `discount-validate` | Validação de cupons |

### 9.2 Core e Operações

| Função | Papel |
|--------|-------|
| `core-products`, `core-orders`, `core-customers` | APIs core |
| `order-lookup`, `tracking-lookup`, `tracking-poll` | Consultas e rastreio |
| `shipping-quote`, `shipping-create-shipment`, `shipping-get-label` | Logística |
| `import-products`, `import-customers`, `import-orders` | Importação |
| `database-export`, `database-import` | Backup e restauração |

### 9.3 Fiscal

| Grupo | Funções |
|-------|---------|
| Emissão e eventos | `fiscal_invoices`, `fiscal_invoice_items`, `fiscal_invoice_events` (via core) |
| Operações | `fiscal_inutilizacoes`, `fiscal_invoice_cces` |

### 9.4 Storefront

| Função | Papel |
|--------|-------|
| `storefront-html` | Renderização Edge (SSR) de páginas |
| `storefront-bootstrap` | Bootstrap da loja |
| `storefront-prerender` | Pré-renderização |
| `storefront-cache-purge`, `cache-purge-internal` | Invalidação de cache |
| `resolve-domain` | Resolução de domínio customizado |
| `domains-*` | Provisionamento e verificação de domínios |

### 9.5 IA

| Função | Papel |
|--------|-------|
| `ai-product-description` | Descrições de produto |
| `ai-generate-offers`, `ai-generate-related-products` | Sugestões de ofertas |
| `ai-landing-page-generate`, `ai-landing-page-generate-html` | Landing pages |
| `ai-block-fill`, `ai-block-fill-visual` | Preenchimento de blocos |
| `ai-page-architect`, `ai-analyze-page`, `ai-import-page` | Análise e importação |
| `ai-support-chat`, `ai-support-vision`, `ai-support-transcribe` | Suporte IA |
| `ai-kb-ingest`, `ai-generate-embedding` | Base de conhecimento |
| `ai-memory-manager` | Gestão de memória |
| `chatgpt-chat` | Assistente ChatGPT |
| `command-assistant-chat`, `command-assistant-execute` | Auxiliar de Comando |

### 9.6 Ads e Tráfego

| Grupo | Funções Principais |
|-------|-------------------|
| Meta Ads | `meta-ads-campaigns`, `meta-ads-adsets`, `meta-ads-ads`, `meta-ads-insights`, `meta-ads-creatives`, `meta-ads-audiences` |
| Google Ads | `google-ads-campaigns`, `google-ads-adgroups`, `google-ads-ads`, `google-ads-keywords`, `google-ads-assets`, `google-ads-insights`, `google-ads-audiences` |
| TikTok Ads | `tiktok-ads-campaigns`, `tiktok-ads-insights` |
| Autopilot IA | `ads-autopilot-guardian`, `ads-autopilot-strategist`, `ads-autopilot-execute-approved`, `ads-autopilot-creative`, `ads-autopilot-weekly-insights`, `ads-autopilot-experiments-run`, `ads-autopilot-generate-prompt` |
| Chat IA Tráfego | `ads-chat-v2`, `ads-chat` |
| Criativos | `creative-generate`, `creative-process`, `creative-image-generate`, `creative-video-generate` |
| CAPI/Feed | `marketing-capi-track`, `marketing-feed`, `marketing-send-meta`, `marketing-send-google`, `marketing-send-tiktok` |

### 9.7 Marketplaces

| Grupo | Funções Principais |
|-------|-------------------|
| Mercado Livre | `meli-sync-listings`, `meli-sync-orders`, `meli-publish-listing`, `meli-webhook`, `meli-oauth-*` |
| Shopee | `shopee-sync-orders`, `shopee-webhook`, `shopee-oauth-*` |
| TikTok Shop | `tiktok-shop-catalog-sync`, `tiktok-shop-orders-sync`, `tiktok-shop-fulfillment`, `tiktok-shop-oauth-*` |

### 9.8 Comunicação e Social

| Grupo | Funções Principais |
|-------|-------------------|
| WhatsApp | `meta-whatsapp-send`, `meta-whatsapp-webhook`, `whatsapp-connect`, `whatsapp-enable` |
| Email | `send-system-email`, `send-auth-email`, `process-scheduled-emails`, `send-test-email` |
| Social | `meta-publish-post`, `meta-threads-publish`, `tiktok-content-publish`, `youtube-upload` |
| Mídia | `media-generate-image`, `media-generate-video`, `media-social-publish-worker` |

### 9.9 Billing e Plataforma

| Grupo | Funções Principais |
|-------|-------------------|
| Billing | `billing-create-checkout`, `billing-activate-subscription`, `billing-webhook`, `billing-generate-invoice` |
| Plataforma | `health-check-run`, `health-monitor-admin`, `platform-credentials-update` |
| Auth/Tenant | `complete-signup`, `tenant-user-invite`, `tenant-user-accept-invite`, `auth-email-hook` |

---

## 10. MAPA DE INTEGRAÇÕES EXTERNAS

### 10.1 Pagamentos (Loja)

| Provedor | Métodos | Papel |
|----------|---------|-------|
| Pagar.me | Pix, Boleto, Cartão | Gateway primário |
| Mercado Pago | Pix, Boleto, Cartão | Gateway alternativo |
| PagBank | Pix, Boleto, Cartão | Gateway alternativo |

### 10.2 Billing (SaaS)

| Provedor | Papel |
|----------|-------|
| Mercado Pago | Assinatura da plataforma SaaS |

> Billing da plataforma e pagamentos da loja são **fluxos isolados** (→ Layer 2, Seção 8.1).

### 10.3 Fiscal

| Provedor | Papel |
|----------|-------|
| Provedor NF-e | Emissão de notas fiscais eletrônicas |

### 10.4 Logística

| Provedor | Papel |
|----------|-------|
| Correios | Cotação e rastreio |
| Melhor Envio / Frenet | Cotação multi-transportadora |
| Loggi | Entregas expressas |

### 10.5 Marketing e Social

| Provedor | Tipo | Papel |
|----------|------|-------|
| Meta (Facebook/Instagram) | Ads + Social + WhatsApp | Tráfego, publicação, messaging |
| Google | Ads + Analytics + Merchant + Tag Manager + Search Console | Tráfego, tracking, feed |
| TikTok | Ads + Content + Shop | Tráfego, social, marketplace |
| YouTube | Content | Upload e analytics de vídeo |
| Threads | Social | Publicação |

### 10.6 Marketplaces

| Provedor | Papel |
|----------|-------|
| Mercado Livre | Listagem, pedidos, mensagens, perguntas |
| Shopee | Listagem, pedidos |
| TikTok Shop | Catálogo, pedidos, fulfillment |

### 10.7 Comunicação

| Provedor | Canal | Papel |
|----------|-------|-------|
| WhatsApp (via Meta) | Messaging | Notificações, atendimento |
| SendGrid | Email | Inbound e transacional |
| SMTP | Email | Envio de emails |
| Cloudflare | CDN/Worker | Edge rendering, domínios |

---

## 11. PIPELINES TÉCNICOS IMPORTANTES

### 11.1 Checkout → Pedido → Pós-venda

```
Carrinho → Checkout (dados + frete + pagamento)
  → checkout-create-order (validação + pedido + estoque reservado)
    → gateway-create-charge (Pagar.me / MP / PagBank)
      → webhook confirma pagamento
        → pedido approved → baixa estoque → métricas cliente → NF-e → notificações
        → pedido recusado → libera estoque → fluxo de retry
```

### 11.2 Builder → Publicação → Edge

```
Builder (Admin) → edição em draft (storefront_global_layout)
  → Publicar → snapshot gravado como published
    → storefront-cache-purge → CDN invalidado
      → storefront-html (Edge Worker) → renderiza HTML com dados published
```

### 11.3 Importação de Dados

```
Upload (CSV/JSON/plataforma) → import-jobs
  → Edge function de importação (products/customers/orders)
    → Validação → Criação/atualização de registros
      → import_items com status por item
```

### 11.4 Ads Autopilot (IA de Tráfego — Motor Duplo)

```
Motor Guardião (diário 4x: 12h/13h/16h/00h01 BRT)
  → Coleta métricas recentes por conta
    → Pause/adjust_budget/reativação (proteção de orçamento)

Motor Estrategista (trigger: start/weekly/monthly)
  → Fase 0: Planejamento (IA analisa orçamento + configs + produtos + histórico)
  → Fase 1: Criativos (gera imagens + copys via ads-autopilot-creative)
  → Fase 2: Públicos (Lookalike, Custom, Interesses)
  → Fase 3: Montagem (Campanha → Ad Set → Ad, tudo PAUSED)
  → Fase 4: Publicação (agenda ativação 00:01 BRT)
    → Aprovação (auto/manual conforme config)
      → ads-autopilot-execute-approved (execução direta nas APIs)

Complementares (semanais):
  → ads-autopilot-weekly-insights (seg) → insights semanais
  → ads-autopilot-experiments-run (ter) → avaliação A/B
  → ads-autopilot-creative (qua) → curadoria de criativos
```

### 11.5 Checkout Abandonado

```
checkout-session-start → heartbeat periódico
  → Sem conclusão? → checkout-session-end (abandono)
    → Sequência de recuperação (email, WhatsApp)
      → checkout-session-complete (se convertido)
```

### 11.6 Domínios Customizados

```
Lojista adiciona domínio → domains-create
  → domains-verify (DNS verificado)
    → domains-provision (TLS via Cloudflare)
      → resolve-domain (mapeamento tenant ↔ domínio)
```

---

## 12. CONCEITOS E CONVENÇÕES DO PROJETO

### 12.1 Multi-Tenancy

- Todo dado é isolado por `tenant_id`
- RLS garante isolamento no banco
- Edge functions validam tenant via auth ou contexto de domínio
- Nunca criar solução específica por tenant sem instrução explícita

### 12.2 Draft vs Published

- Todo conteúdo editável (builder, páginas, landing pages) segue o padrão draft/published
- Draft = edição em tempo real no admin, sem efeito público
- Published = snapshot ativo na loja, criado por ação explícita

### 12.3 Edge vs SPA

- Páginas de conteúdo público (home, categoria, produto, blog) → Edge rendering (SSR via Cloudflare Worker)
- Páginas interativas (checkout, carrinho, conta, busca) → SPA (React)
- Admin → SPA (React), sempre protegido por autenticação

### 12.4 Admin vs Storefront

- **Admin:** tema fixo (azul marinho), roteamento `/command-center`, `/orders`, etc.
- **Storefront:** tema customizável pelo tenant, roteamento por domínio ou `/store/:slug`
- Componentes compartilhados exigem auditoria de impacto cruzado

### 12.5 Convenções de Código

| Convenção | Padrão |
|-----------|--------|
| Datas | `date-fns`, timezone America/Sao_Paulo |
| Moeda | Centavos (`price_cents`) para cálculo, formatação `R$ X,XX` na UI |
| Slugs | Lowercase, hifenizados, únicos por tenant |
| IDs | UUID v4 |
| Timestamps | ISO 8601 com timezone |
| Feature flags | `plan_module_access` + `tenant_feature_overrides` + `billing_feature_flags` |
| Status de módulo | `module-status.ts` para sidebar visual |
| Loading | Skeletons (não spinners) para tabelas e listas |

### 12.6 Gateway vs Método de Pagamento

- **Gateway** = provedor de infraestrutura (Pagar.me, MP, PagBank)
- **Método** = forma de pagamento (Pix, Boleto, Cartão)
- Um gateway pode processar múltiplos métodos
- O lojista configura qual gateway processa qual método

### 12.7 Trigger vs Cron

- Trigger/evento = caminho principal para fluxos assíncronos
- Cron = fallback para reconciliação, retentativa e correção
- Nunca usar cron como muleta para trigger quebrado

---

## 13. MAPA DE DEPENDÊNCIAS ENTRE ÁREAS

```
                    ┌──────────────────┐
                    │    PLATAFORMA    │
                    │ (billing, saúde, │
                    │  admin, tenants) │
                    └────────┬─────────┘
                             │ governa
                    ┌────────▼─────────┐
                    │     SISTEMA      │
                    │ (auth, config,   │
                    │  imports, users) │
                    └────────┬─────────┘
                             │ suporta
            ┌────────────────┼────────────────┐
            │                │                │
   ┌────────▼───────┐ ┌─────▼──────┐ ┌───────▼──────┐
   │   E-COMMERCE   │ │ STOREFRONT │ │     ERP      │
   │ (produtos,     │ │ (builder,  │ │ (fiscal,     │
   │  clientes,     │◄┤  checkout, │ │  logística,  │
   │  pedidos)      │ │  carrinho) │ │  compras)    │
   └───┬───┬───┬────┘ └────────────┘ └───────┬──────┘
       │   │   │                              │
       │   │   └──────────┐                   │
       │   │              │                   │
 ┌─────▼───┤    ┌─────────▼────┐    ┌─────────▼────┐
 │MARKETING│    │ MARKETPLACES │    │     CRM      │
 │(ads, IA,│    │ (Meli, Shopee│    │ (suporte,    │
 │criativos│    │  TikTok Shop)│    │  WhatsApp,   │
 │email mkt│    └──────────────┘    │  chatgpt)    │
 └─────────┘                        └──────────────┘
       │
 ┌─────▼─────┐
 │ PARCERIAS │
 │(afiliados,│
 │influencers│
 └───────────┘
```

**Dependências macro:**
- Storefront consome dados do E-commerce (produtos, categorias, preços)
- ERP depende de Pedidos para fiscal e logística
- Marketing depende de Produtos e Clientes para campanhas e segmentação
- Marketplaces sincronizam bidirecionalmente com E-commerce
- CRM depende de Clientes e Pedidos para atendimento
- Parcerias depende de Pedidos para atribuição de comissões
- Tudo depende de Sistema (auth, tenant, config)

---

## 14. GLOSSÁRIO TÉCNICO

| Termo | Definição |
|-------|-----------|
| **Tenant** | Loja/empresa cliente da plataforma SaaS |
| **Core trio** | Produtos + Clientes + Pedidos |
| **Draft** | Versão de trabalho não publicada (builder, páginas) |
| **Published** | Snapshot ativo visível na loja pública |
| **Edge rendering** | Renderização server-side via Cloudflare Worker |
| **SPA** | Single Page Application (React no browser) |
| **Gateway** | Provedor de infraestrutura de pagamento |
| **Soft lock** | Reserva de estoque na criação do pedido |
| **Order bump** | Oferta adicional exibida no checkout |
| **Upsell** | Oferta pós-compra na página de obrigado |
| **RLS** | Row Level Security (PostgreSQL) |
| **Contrato** | Interface formal entre módulos (Layer 2) |
| **Edge function** | Função serverless Deno no Supabase |
| **Builder** | Editor visual WYSIWYG de páginas e layout |
| **CAPI** | Conversions API (tracking server-side de plataformas de ads) |
| **Reconciliação** | Processo de sincronização entre fonte interna e externa |
| **Slug** | Identificador legível em URL (lowercase, hifenizado) |
| **Feature flag** | Controle de acesso a funcionalidade por plano/config |
| **Webhook** | Callback HTTP de sistemas externos |
| **service_role** | Chave com acesso privilegiado ao Supabase (bypass RLS) |
| **Ghost order** | Pedido sem pagamento aprovado (abandonado no pipeline) |
| **Canonical total** | Total recalculado no servidor para auditoria de preço |
| **Attribution** | Rastreamento de origem da venda (UTM, afiliado, canal) |
| **Heartbeat** | Sinal periódico de sessão ativa (checkout) |
| **Backfill** | Processo de preenchimento retroativo de dados |

---

## 15. ONDE ENCONTRAR CADA ASSUNTO

| Assunto | Onde procurar |
|---------|--------------|
| Como a IA deve agir e responder | Layer 1 — Knowledge |
| Regras estruturais, contratos, fontes de verdade | Layer 2 — `docs/REGRAS-DO-SISTEMA.md` |
| Comportamento funcional de um módulo | Layer 3 — `docs/especificacoes/<dominio>/<modulo>.md` |
| Índice de todos os módulos e status | Layer 3 — `docs/ESPECIFICACOES-DOS-MODULOS.md` |
| Arquitetura, inventário, contexto geral | Layer 4 — **Este documento** |
| Schema de tabelas (tipo, colunas) | `src/integrations/supabase/types.ts` |
| Rotas do sistema | `src/App.tsx` |
| Status dos módulos na sidebar | `src/config/module-status.ts` |
| Configurações de auth/RLS | `supabase/config.toml` + migrations |
| Código de edge functions | `supabase/functions/<nome>/` |
| Docs legados (transição) | `docs/regras/*.md` |

---

## 16. LIMITES DESTE MANUAL

1. Este documento **não substitui** o Layer 1, Layer 2 ou Layer 3.
2. Em caso de conflito, a autoridade segue a camada competente (→ Seção 2).
3. Contagens de tabelas, edge functions e módulos são **inventário de referência na data do snapshot**, não contagens rígidas eternas.
4. Este Manual **resume e referencia** — nunca define regra canônica.
5. Detalhes funcionais de telas, botões e estados ficam nos docs de especificação (Layer 3).
6. Regras de segurança, contratos e fontes de verdade ficam no Doc de Regras (Layer 2).

---

## PONTOS QUE PODEM SER REFINADOS DEPOIS

1. **Seção 9 (Edge Functions):** Algumas funções fiscais operam via triggers/RPCs, não como edge functions standalone. O mapeamento pode ser refinado quando o módulo fiscal for auditado.
2. **Seção 8.3 (Tabelas de Marketing):** O domínio de marketing tem muitas tabelas de integrações sociais (meta_*, google_*, tiktok_*). Um agrupamento mais fino pode ser feito quando essas integrações forem consolidadas.
3. **Seção 10.3 (Fiscal):** O provedor fiscal específico pode ser documentado quando a integração for estabilizada.
4. **Seção 11 (Pipelines):** Pipelines de email marketing e sincronização de marketplaces podem ser detalhados quando esses módulos saírem de 🟧 para ✅.
5. **Seção 13 (Dependências):** O diagrama é intencionalmente macro. Dependências mais granulares podem ser adicionadas conforme o sistema evolui.
6. **Hooks transversais:** Hooks como `useCheckoutPayment`, `useTenantContext`, `useGlobalLayout` são relevantes para entender a arquitetura mas não foram listados individualmente. Podem ser adicionados em versão futura se útil.

---

*Fim do Manual do Sistema — V1.0.0*
