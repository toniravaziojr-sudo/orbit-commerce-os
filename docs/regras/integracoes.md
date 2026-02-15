# Integrações — Regras e Especificações

> **STATUS:** ✅ Ready

## Visão Geral

Hub central de integrações com serviços externos: pagamentos, redes sociais, marketplaces, WhatsApp, email, domínios, ERP.

---

## ⚠️ REGRA CRÍTICA: Separação de Módulos de Integração

> **NÃO NEGOCIÁVEL** — Esta regra foi definida para evitar duplicação e confusão na navegação.

### Módulo "Integrações" (`/integrations`)

**Escopo:** Integrações que o **usuário admin** configura para **seu tenant/loja**.

| Tab | Descrição |
|-----|-----------|
| Pagamentos | Gateways de pagamento (Mercado Pago, etc) |
| Meta | Facebook/Instagram (Pixel, Catálogo) |
| Marketplaces | Mercado Livre, Shopee, etc |
| Domínio/Email | Domínio da loja + Email transacional |
| Outros | ERPs, etc |

**PROIBIDO:** Adicionar configurações de plataforma (SendGrid, Fal.AI, Loggi global, etc) neste módulo.

### Módulo "Integrações da Plataforma" (`/platform-integrations`)

**Escopo:** Configurações **globais da plataforma** (apenas para `isPlatformOperator`).

| Tab | Descrição |
|-----|-----------|
| Email e Domínios | SendGrid, Cloudflare (plataforma) |
| WhatsApp | Z-API manager, Meta Cloud API (plataforma) |
| Fiscal | Nuvem Fiscal, Focus NFe |
| Logística | Loggi OAuth global |
| IA | Fal.AI, Firecrawl |
| Mercado Livre | Meli platform config |
| Mercado Livre | Meli platform config |
| Mercado Pago | MP platform config |
| Shopee | Shopee platform config |

**NUNCA** criar aba "Plataforma" dentro do módulo `/integrations`. Use `/platform-integrations`.

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Integrations.tsx` | Página principal de integrações (tenant) |
| `src/pages/PlatformIntegrations.tsx` | Página de integrações (operador) |
| `src/pages/marketplaces/Olist.tsx` | Página dedicada da Olist |
| `src/components/marketplaces/OlistConnectionCard.tsx` | Card de conexão Olist (ERP/E-commerce) |
| `src/components/integrations/DomainAndEmailSettings.tsx` | Aba unificada Domínio/Email |
| `src/components/settings/DomainSettingsContent.tsx` | Configuração de domínios da loja |
| `src/components/payments/PaymentGatewaySettings.tsx` | Config de gateways |
| `src/components/integrations/WhatsAppProviderTabs.tsx` | Config WhatsApp |
| `src/components/integrations/MarketplacesIntegrationTab.tsx` | Marketplaces |
| `src/components/integrations/MetaConnectionSettings.tsx` | Meta/Facebook |
| `src/components/emails/EmailDnsSettings.tsx` | DNS de email |

---

## Estrutura de Abas (Tenant - `/integrations`)

| Tab | Valor | Componente | Descrição |
|-----|-------|------------|-----------|
| Pagamentos | `payments` | `PaymentGatewaySettings` | Gateways de pagamento |
| Meta | `social` | `MetaUnifiedSettings` | Meta (WhatsApp + Publicação FB/IG) |
| YouTube (legado) | `youtube` | `YouTubeSettings` | Apenas para platform operators (será removida) |
| **Google** | `google` | `GoogleUnifiedSettings` | Hub centralizado Google (YouTube, Ads, Analytics, etc.) |
| Marketplaces | `marketplaces` | `MarketplacesIntegrationTab` | Mercado Livre, etc |
| **Domínio/Email** | `domain-email` | `DomainAndEmailSettings` | Domínio da loja + Email |
| Outros | `outros` | Cards ERP | Integrações ERP (em breve) |

> **NOTA:** A aba "Plataforma" foi **REMOVIDA** deste módulo. Use `/platform-integrations`.

---

## Aba Domínio/Email

A aba `domain-email` unifica duas seções:

### 1. Domínio da Loja
- **Componente:** `DomainSettingsContent`
- **Funcionalidades:**
  - URL padrão (grátis): `{tenantSlug}.shops.comandocentral.com.br`
  - Domínios personalizados (custom domains)
  - Verificação DNS (TXT)
  - Provisionamento SSL (Cloudflare Custom Hostnames)
  - Definir domínio principal
- **Referência completa:** `docs/regras/dominios.md`

### 2. Domínio de Email
- **Componente:** `EmailDnsSettings`
- **Funcionalidades:**
  - Configuração de DNS para email (SPF, DKIM, DMARC)
  - Verificação de domínio de envio
  - Integração com SendGrid

---

## Categorias de Integração

### 1. Pagamentos
| Gateway | Status | Descrição |
|---------|--------|-----------|
| Mercado Pago | ✅ Ready | Principal gateway |
| PagSeguro | 🟧 Pending | Em desenvolvimento |
| Stripe | 🟧 Pending | Planejado |
| PIX direto | ✅ Ready | Via gateways |

### 2. Redes Sociais / Mídias
| Plataforma | Status | Descrição |
|------------|--------|-----------|
| Meta (FB/IG) | ✅ Ready | Publicação Feed/Stories/Reels, WhatsApp, Catálogo, Pixel |
| Instagram | ✅ Ready | Via Meta Graph API (container flow) |
| **YouTube** | ✅ Ready | Upload, agendamento, analytics (via Hub Google) |
| TikTok Ads | 🟧 Pending | Pixel/Conversions |
| **Google Hub** | ✅ Ready | YouTube, Ads, Merchant, Analytics, Search Console, Business, Tag Manager |

### 3. Marketplaces
| Marketplace | Status | Descrição |
|-------------|--------|-----------|
| Mercado Livre | ✅ Ready | Sincronização de produtos |
| Shopee | ✅ Ready | Sincronização de pedidos e OAuth |
| Olist | ✅ Ready | ERP (Tiny) + E-commerce (Vnda) via token |
| TikTok Shop | 🟧 Em Cadastro | Marketplace integrado |
| Amazon | 🟧 Pending | Planejado |

### 4. WhatsApp
| Provider | Status | Descrição |
|----------|--------|-----------|
| WhatsApp Cloud API | ✅ Modo Teste Ready | Oficial Meta |
| Z-API | 🟧 Pending | Não-oficial |
| Evolution API | 🟧 Pending | Self-hosted |

#### Modo Teste – WhatsApp Cloud API (Meta)

Disponível em **Integrações → WhatsApp → Meta Oficial** (apenas platform admin).

| Campo | Descrição |
|-------|-----------|
| `phone_number_id` | ID do número de teste (Meta for Developers) |
| `access_token` | Token temporário (NÃO salvo, NÃO logado) |
| `to_phone` | Telefone destinatário (formato E.164) |
| `template_name` | Nome do template (ex: `hello_world`) |

**Edge Function:** `meta-whatsapp-test-send`

**Segurança:**
- Token temporário NUNCA é salvo no banco
- Token NUNCA aparece em logs
- Apenas `is_platform_admin = true` pode usar

**Checklist de Validação:**
- [ ] Envio de mensagem via Cloud API
- [ ] Webhook verificado pelo Meta
- [ ] Evento recebido no Atendimento
- [ ] Conversa criada automaticamente no módulo Suporte

**Integração Completa:**
- **Atendimento (Suporte):** `support-send-message` roteia automaticamente para `meta-whatsapp-send` quando `provider=meta`
- **Notificações (Pedidos):** `run-notifications` detecta o provider e usa Meta ou Z-API conforme config
- **Webhook Inbound:** `meta-whatsapp-webhook` cria conversas e mensagens no módulo de Atendimento

### 5. Email
| Serviço | Status | Descrição |
|---------|--------|-----------|
| Resend | ✅ Ready | Transacional |
| SendGrid | ✅ Ready | Transacional + Inbound |
| SMTP | 🟧 Pending | Genérico |
| DNS/SPF/DKIM | ✅ Ready | Configuração |

### 6. ERP
| Sistema | Status | Descrição |
|---------|--------|-----------|
| Bling | 🟧 Coming Soon | Sincronização |
| Olist ERP (Tiny) | ✅ Ready | Via `OlistConnectionCard` com API token |
| Olist E-commerce (Vnda) | ✅ Ready | Via `OlistConnectionCard` com API token |

---

## Estrutura de Credenciais

```typescript
// Tabela: integration_credentials
{
  tenant_id: uuid,
  provider: string,      // 'mercadopago', 'meta', etc
  credentials: jsonb,    // Criptografado
  is_enabled: boolean,
  metadata: jsonb,
  created_at: timestamptz,
  updated_at: timestamptz,
}
```

---

## Área de Plataforma (Admin)

Disponível apenas para `isPlatformOperator`:

| Tab | Descrição |
|-----|-----------|
| Resumo | Dashboard de status geral |
| Email e Domínios | SendGrid + Cloudflare |
| WhatsApp | Z-API manager account |
| Fiscal | Focus NFe |
| Logística | Loggi OAuth |
| IA | Firecrawl e AI config |
| Mercado Livre | Meli platform config |
| Mercado Livre | Meli platform config |

---

## Fluxo OAuth (Marketplaces)

```
1. Usuário clica "Conectar"
2. Redireciona para oauth do provider
3. Provider redireciona de volta com code
4. Edge function troca code por tokens
5. Tokens armazenados (criptografados)
6. Status atualizado para "connected"
```

---

## URLs de Integração (Domínio Público)

> **IMPORTANTE:** Todos os endpoints de webhook e callback devem usar o domínio público `app.comandocentral.com.br`, 
> **NUNCA** o domínio interno do Supabase (`ojssezfjhdvvncsqyhyq.supabase.co`).
>
> O Cloudflare Worker faz proxy automático dessas rotas para as Edge Functions correspondentes.

### Mapeamento de URLs

| Integração | Tipo | URL Pública (usar esta) | Edge Function |
|------------|------|-------------------------|---------------|
| **Meta** | Deauthorize Callback | `https://app.comandocentral.com.br/integrations/meta/deauthorize` | `meta-deauthorize-callback` |
| **Meta** | Data Deletion | `https://app.comandocentral.com.br/integrations/meta/deletion-status` | `meta-deletion-status` |
| **Meta** | WhatsApp Onboarding | `https://app.comandocentral.com.br/integrations/meta/whatsapp-callback` | `meta-whatsapp-onboarding-callback` |
| **Shopee** | OAuth Callback | `https://app.comandocentral.com.br/integrations/shopee/callback` | `shopee-oauth-callback` |
| **Shopee** | Webhook | `https://app.comandocentral.com.br/integrations/shopee/webhook` | `shopee-webhook` |
| **TikTok Shop** | OAuth Callback | `https://app.comandocentral.com.br/integrations/tiktok/callback` | `tiktok-oauth-callback` |
| **TikTok Shop** | Webhook | `https://app.comandocentral.com.br/integrations/tiktok/webhook` | `tiktok-webhook` |
| **Mercado Pago** | Billing Webhook | `https://app.comandocentral.com.br/integrations/billing/webhook` | `billing-webhook` |
| **SendGrid** | Inbound Parse | `https://app.comandocentral.com.br/integrations/emails/inbound` | `support-email-inbound` |
| **Mercado Livre** | OAuth Callback | `https://app.comandocentral.com.br/integrations/meli/callback` | `meli-oauth-callback` |
| **Mercado Livre** | Webhook | `https://app.comandocentral.com.br/integrations/meli/webhook` | `meli-webhook` |

### Configuração no Cloudflare Worker

O Worker `shops-router` deve ter a rota configurada:
```
app.comandocentral.com.br/integrations/* → shops-router
```

O mapeamento está definido em `docs/cloudflare-worker-template.js` na constante `EDGE_FUNCTION_ROUTES`.

---

## Webhooks

---

## Componentes Relacionados

| Componente | Descrição |
|------------|-----------|
| `DomainAndEmailSettings` | Container unificado para domínio + email |
| `DomainSettingsContent` | Lógica extraída de `Domains.tsx` para reutilização |
| `AddDomainDialog` | Dialog para adicionar domínio personalizado |
| `DomainInstructionsDialog` | Instruções de configuração DNS |

---

## Credenciais de Plataforma (Meta)

Para o OAuth da Meta funcionar, as seguintes credenciais devem estar na tabela `platform_credentials`:

| Credential Key | Descrição | Onde Obter |
|----------------|-----------|------------|
| `META_APP_ID` | ✅ Configurado | App ID do Meta for Developers |
| `META_APP_SECRET` | ❌ **PENDENTE** | App Secret do Meta for Developers |

### Como Obter o META_APP_SECRET

1. Acesse [Meta for Developers](https://developers.facebook.com/apps/)
2. Selecione seu App
3. Vá em **Configurações do App → Básico**
4. Copie o **Chave Secreta do Aplicativo** (App Secret)

### Como Adicionar

Inserir diretamente no banco via SQL:

```sql
INSERT INTO platform_credentials (credential_key, credential_value, is_active)
VALUES ('META_APP_SECRET', 'seu_app_secret_aqui', true)
ON CONFLICT (credential_key) 
DO UPDATE SET credential_value = EXCLUDED.credential_value, updated_at = now();
```

Ou via Edge Function `platform-credentials-update` (requer `is_platform_admin`).

---

## Integração Olist

### Fluxo de Conexão (Token-based)

```
1. Usuário acessa /marketplaces/olist
2. Seleciona tipo de conta (ERP ou E-commerce)
3. Insere token de API
4. Clica "Testar" → Edge function valida token
5. Clica "Conectar" → Token salvo em marketplace_connections
6. Status atualizado para "connected"
```

### Componentes

| Componente | Descrição |
|------------|-----------|
| `OlistConnectionCard` | Card de conexão com seleção de tipo (ERP/E-commerce) |
| `useOlistConnection` | Hook para gerenciar estado da conexão |

### Edge Functions

| Function | Descrição |
|----------|-----------|
| `olist-connect` | Testa token e salva conexão |
| `olist-disconnect` | Remove conexão |
| `olist-test-connection` | Valida token sem salvar |
| `olist-connection-status` | Retorna status da conexão |

### APIs Utilizadas

| Tipo | Base URL | Autenticação |
|------|----------|--------------|
| Olist ERP (Tiny) | `https://api.tiny.com.br/api2` | Token via FormData |
| Olist E-commerce (Vnda) | `https://api.vnda.com.br/api/v2` | Bearer token |

### Tabela de Armazenamento

Conexões são salvas em `marketplace_connections` com:
- `marketplace: 'olist'`
- `metadata: { accountType: 'erp' | 'ecommerce' }`

---

## Integração YouTube (Gestor de Mídias IA)

### Visão Geral

O YouTube está integrado ao **Gestor de Mídias IA** para upload, agendamento e monitoramento de vídeos.

### ⚠️ REGRA DE ROLLOUT (CRÍTICA)

> **NÃO NEGOCIÁVEL** — O YouTube segue rollout controlado por feature flag.

| Status | Descrição |
|--------|-----------|
| `testing` | OAuth Consent Screen em "Testing" no Google Cloud |
| `in_production_unverified` | Publicado mas aguardando verificação |
| `verified` | Verificado pelo Google, liberado para todos |

**Feature Flag:** `youtube_enabled_for_all_tenants`

Enquanto `is_enabled = false`:
- ✅ Platform admins têm acesso
- ✅ Tenant admin (owner é platform admin) tem acesso
- ❌ Demais tenants NÃO têm acesso

**Como liberar para todos:**
1. Publicar app no Google Cloud (OAuth consent screen → Publish app)
2. Submeter para verificação se usar escopos sensíveis
3. Após aprovação: `UPDATE billing_feature_flags SET is_enabled = true WHERE flag_key = 'youtube_enabled_for_all_tenants'`

### Funcionalidades

| Feature | Status | Descrição |
|---------|--------|-----------|
| OAuth Connect | ✅ Ready | Conexão via Google OAuth 2.0 |
| Upload de Vídeos | ✅ Ready | Upload resumable com metadados |
| Agendamento | ✅ Ready | PublishAt para publicação futura |
| Thumbnails | ✅ Ready | Upload de thumbnail customizada |
| Analytics | 🟧 Pending | Views, watch time, CTR |
| Legendas | 🟧 Pending | Auto-captions via YouTube |

### Agendamento de Publicação (publishAt)

Para agendar publicação, o YouTube exige:
1. `privacyStatus` DEVE ser `"private"`
2. `publishAt` em formato ISO 8601 UTC (ex: `2026-01-30T15:00:00Z`)
3. Data/hora DEVE ser pelo menos 1 hora no futuro

A Edge Function `youtube-upload` valida automaticamente e força `privacyStatus: 'private'` quando `publishAt` está presente.

**Erros comuns:**
- `invalidPublishAt`: Horário muito próximo ou no passado
- Vídeo não vai público se `publishAt` estiver no passado

### Tratamento de Erros OAuth

| Código | Descrição | Ação |
|--------|-----------|------|
| `testing_mode_restriction` | Email não é test user | Adicionar email no Google Cloud Console |
| `unverified_app_cap` | Limite de 100 usuários | Submeter app para verificação |
| `access_denied` | Usuário cancelou | Tentar novamente |
| `consent_required` | Permissões recusadas | Aceitar todas as permissões |
| `quota_exceeded` | Quota diária esgotada | Aguardar reset (PT: meia-noite) |
| `no_channel` | Usuário sem canal | Criar canal no YouTube |

### Tabelas do Banco

| Tabela | Descrição |
|--------|-----------|
| `youtube_connections` | Conexões OAuth por tenant (inclui `oauth_error_code` para debug) |
| `youtube_uploads` | Fila de uploads com status e `scheduled_publish_at_utc` |
| `youtube_analytics` | Cache de métricas |
| `youtube_oauth_states` | Estados temporários do OAuth |

### Consumo de Créditos

O YouTube utiliza o sistema de créditos IA para gerenciar a quota da API do Google:

| Operação | Créditos | Justificativa |
|----------|----------|---------------|
| Upload base | 16 | 1600 unidades de quota |
| +Thumbnail | 1 | 50 unidades extras |
| +Captions | 2 | 100 unidades extras |
| +1GB de vídeo | 1 | Overhead de transferência |

**Fórmula:** `calculate_youtube_upload_credits(file_size_bytes, has_thumbnail, has_captions)`

**Limite diário:** ~6 uploads por canal (quota Google: 10.000 unidades/dia)

### Edge Functions

| Function | Descrição |
|----------|-----------|
| `youtube-oauth-start` | Inicia fluxo OAuth |
| `youtube-oauth-callback` | Processa callback com tratamento de erros detalhado |
| `youtube-upload` | Upload assíncrono com validação de `publishAt` |

### Fluxo de Upload com Agendamento

```
1. Usuário seleciona vídeo + data/hora de publicação
2. Converte horário local → UTC ISO 8601
3. Valida: publishAt > now() + 1h
4. Verifica saldo de créditos
5. Reserva créditos necessários
6. Cria job em youtube_uploads:
   - status: 'pending'
   - privacy_status: 'private' (obrigatório para agendamento)
   - publish_at: <UTC ISO>
7. Background:
   - Download vídeo
   - Upload para YouTube com publishAt
   - YouTube agenda automaticamente
8. Ao concluir:
   - Consume créditos
   - status: 'completed'
   - publish_status: 'scheduled'
9. YouTube publica automaticamente no horário
```

### Hooks e Componentes

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useYouTubeConnection.ts` | Gerencia conexão OAuth |
| `src/hooks/useYouTubeAvailability.ts` | Verifica se YouTube está disponível para o tenant |
| `src/components/integrations/YouTubeSettings.tsx` | UI de configuração com controle de rollout |
| `src/pages/integrations/YouTubeCallback.tsx` | Handler do callback OAuth com mensagens de erro |

### Configuração no Google Cloud Console

**Redirect URIs obrigatórias:**
```
https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/youtube-oauth-callback
```

**Escopos mínimos para MVP (Agendamento):**
```
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.readonly
```

---

## Google — Hub Centralizado (Scope Packs + OAuth Incremental)

> **STATUS:** ✅ Ready (Fase 1)  
> **Adicionado em:** 2026-02-14

### Visão Geral

Hub centralizado Google na aba "Google" de `/integrations`. Uma conexão por tenant (admin-driven) com consentimento incremental via Scope Packs. O admin conecta e todos os usuários do tenant usam a mesma conexão.

### Arquitetura

- **1 conexão por tenant** — `google_connections` com `UNIQUE(tenant_id)`
- **OAuth incremental** — `include_granted_scopes=true`, `access_type=offline`, `prompt=consent`
- **refresh_token é o ativo real** — nunca perdê-lo; `access_token` renovado via `google-token-refresh`
- **Cache híbrido** — tabelas locais + fallback API em tempo real
- **Feature flag por pack** — cada pack funciona isolado

### Scope Packs

| Pack | Label | Escopos OAuth | Módulo | Sensibilidade |
|------|-------|---------------|--------|---------------|
| `youtube` | YouTube | `youtube.upload`, `youtube`, `youtube.force-ssl`, `youtube.readonly`, `yt-analytics.readonly` | Mídias `/media` | Sensível |
| `ads` | Google Ads | `adwords` | Tráfego `/ads` | Sensível + Dev Token |
| `merchant` | Merchant Center | `content` | Catálogos `/products` | Normal |
| `analytics` | Analytics GA4 | `analytics.readonly` | Relatórios `/analytics` | Normal |
| `search_console` | Search Console | `webmasters.readonly` | SEO `/seo` | Normal |
| `business` | Meu Negócio | `business.manage` | CRM `/reviews` | Sensível |
| `tag_manager` | Tag Manager | `tagmanager.edit.containers`, `tagmanager.readonly` | Utilidades `/integrations` | Normal |

**Escopos base** (sempre incluídos): `openid`, `userinfo.email`, `userinfo.profile`

### Consentimento Incremental

```text
1. Tenant conecta com packs ["youtube"]
2. Token salvo com scope_packs: ["youtube"]
3. Tenant quer adicionar "analytics"
4. UI mostra "Adicionar permissões"
5. google-oauth-start recebe scopePacks: ["youtube", "analytics"] (união)
6. Google pede autorização APENAS dos novos escopos
7. google-oauth-callback faz merge: scope_packs finais = ["youtube", "analytics"]
8. Novo token substitui o anterior (com todos os escopos)
```

### Descoberta de Ativos (Callback)

| Ativo | API | Campo em `assets` |
|-------|-----|-------------------|
| Canais YouTube | YouTube Data API v3 | `youtube_channels[]` |
| Contas Ads | Google Ads API | `ad_accounts[]` |
| Merchant Center | Content API | `merchant_accounts[]` |
| Propriedades GA4 | Analytics Admin API | `analytics_properties[]` |
| Sites Search Console | Search Console API | `search_console_sites[]` |
| Localizações Business | Business Profile API | `business_locations[]` |
| Contas Tag Manager | Tag Manager API | `tag_manager_accounts[]` |

### Tabelas do Banco

| Tabela | Descrição |
|--------|-----------|
| `google_connections` | Conexão OAuth por tenant (UNIQUE), tokens, scope_packs, assets descobertos |
| `google_oauth_states` | Estados temporários do OAuth (expira em 10min) |
| `google_merchant_products` | Cache de status de sincronização com Merchant Center |

### Credenciais

| Credencial | Tipo | Onde fica |
|------------|------|-----------|
| `GOOGLE_CLIENT_ID` | Plataforma | Secrets |
| `GOOGLE_CLIENT_SECRET` | Plataforma | Secrets |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Plataforma | `platform_credentials` |
| `login_customer_id` (MCC) | Plataforma (opcional) | `platform_credentials` |
| OAuth tokens | Tenant | `google_connections` |

### Edge Functions

| Function | Descrição |
|----------|-----------|
| `google-oauth-start` | Gera URL OAuth com escopos por pack, salva state |
| `google-oauth-callback` | Troca code por tokens, descobre ativos, upsert em `google_connections` |
| `google-token-refresh` | Renova `access_token` usando `refresh_token` |
| `google-merchant-sync` | Sincroniza produtos com Google Merchant Center (Content API for Shopping) |
| `google-merchant-status` | Consulta status de aprovação dos produtos no Merchant Center |

### Hooks e Componentes

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useGoogleConnection.ts` | Hook com tipos `GoogleScopePack` e `GoogleAssets` |
| `src/hooks/useMerchantSync.ts` | Hook para sincronização e status do Merchant Center |
| `src/components/integrations/GoogleUnifiedSettings.tsx` | UI principal com scope packs + consentimento incremental |

### Tipos TypeScript

```typescript
type GoogleScopePack = "youtube" | "ads" | "merchant" | "analytics" | "search_console" | "business" | "tag_manager";

interface GoogleAssets {
  youtube_channels?: Array<{ id: string; title: string; thumbnail_url?: string; subscriber_count?: number }>;
  ad_accounts?: Array<{ id: string; name: string }>;
  merchant_accounts?: Array<{ id: string; name: string }>;
  analytics_properties?: Array<{ id: string; name: string; measurement_id?: string | null }>;
  search_console_sites?: Array<{ url: string; permission_level?: string }>;
  business_locations?: Array<{ name: string; location_id: string }>;
  tag_manager_accounts?: Array<{ id: string; name: string }>;
}
```

### URLs de Integração

| Tipo | URL | Edge Function |
|------|-----|---------------|
| OAuth Callback | `{SUPABASE_URL}/functions/v1/google-oauth-callback` | `google-oauth-callback` |

### Configuração no Google Cloud Console

**Redirect URIs obrigatórias:**
```
https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/google-oauth-callback
```

**APIs a ativar:** YouTube Data API v3, Google Ads API, Content API for Shopping, Analytics Admin API, Search Console API, Business Profile API, Tag Manager API.

### Fases de Implementação

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Hub Base (OAuth + DB + UI) | ✅ Concluída |
| 2 | Migração YouTube → Hub Google | ✅ Concluída |
| 3 | Google Merchant Center | ✅ Concluída |
| 4 | Google Ads Manager | 🟧 Pendente |
| 5 | Google Analytics (GA4) | 🟧 Pendente |
| 6 | Search Console | 🟧 Pendente |
| 7 | Google Meu Negócio | 🟧 Pendente |
| 8 | Google Tag Manager | 🟧 Pendente |

---

## Meta — Scope Packs e OAuth Incremental (Fase 1)

> **STATUS:** ✅ Ready  
> **Adicionado em:** 2026-02-14

### Visão Geral

A integração Meta usa **Scope Packs** para consentimento incremental. O tenant conecta apenas os packs que precisa e pode adicionar novos depois sem perder o token existente.

### Scope Packs Disponíveis

| Pack | Label | Escopos Graph API |
|------|-------|-------------------|
| `whatsapp` | WhatsApp | `whatsapp_business_management`, `whatsapp_business_messaging` |
| `publicacao` | Publicação | `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish` |
| `atendimento` | Atendimento | `pages_messaging`, `instagram_manage_messages`, `pages_manage_engagement`, `pages_read_user_content`, `pages_read_engagement` |
| `ads` | Anúncios | `ads_management`, `ads_read`, `pages_manage_ads`, `leads_retrieval` |
| `leads` | Leads | `leads_retrieval`, `pages_manage_ads` |
| `catalogo` | Catálogo | `catalog_management` |
| `threads` | Threads | `threads_content_publish`, `threads_manage_replies`, `threads_manage_insights`, `threads_basic`, `threads_read_replies` |
| `live_video` | Lives | `publish_video`, `pages_manage_posts` |
| `pixel` | Pixel + CAPI | Configuração via token de sistema (sem OAuth) |
| `insights` | Insights | `read_insights`, `pages_read_engagement` |

**Escopos base** (sempre incluídos): `public_profile`, `pages_show_list`

### Consentimento Incremental

```text
1. Tenant conecta com packs ["publicacao", "whatsapp"]
2. Token salvo com scope_packs: ["publicacao", "whatsapp"]
3. Tenant quer adicionar "ads"
4. UI mostra botão "Adicionar permissões"
5. meta-oauth-start recebe scopePacks: ["publicacao", "whatsapp", "ads"] (união)
6. Meta pede autorização APENAS dos novos escopos
7. meta-oauth-callback faz merge: scope_packs finais = ["publicacao", "whatsapp", "ads"]
8. Novo token substitui o anterior (com todos os escopos)
```

### Descoberta de Ativos

O callback OAuth descobre automaticamente:

| Ativo | Endpoint | Campo em `metadata.assets` |
|-------|----------|---------------------------|
| Páginas | `GET /me/accounts` | `pages[]` |
| Instagram | `GET /{page_id}?fields=instagram_business_account` | `instagram_accounts[]` |
| WhatsApp | `GET /me/businesses` → `/{biz_id}/owned_whatsapp_business_accounts` | `whatsapp_business_accounts[]` |
| Contas de Anúncio | `GET /me/adaccounts` | `ad_accounts[]` |
| Catálogos | `GET /me/businesses` → `/{biz_id}/owned_product_catalogs` | `catalogs[]` |
| Threads | `GET /me/threads?fields=id,username` | `threads_profile` |

### Mapeamento: Pack → Módulo do Sistema

| Pack | Módulo | Rota |
|------|--------|------|
| `whatsapp` | Atendimento | `/support` |
| `atendimento` | Atendimento | `/support` |
| `publicacao` | Gestor de Mídias IA | `/media` |
| `threads` | Gestor de Mídias IA | `/media` |
| `ads` | Gestor de Tráfego IA | `/campaigns` |
| `leads` | CRM / Clientes | `/customers` |
| `catalogo` | Marketing / Integrações | `/marketing` |
| `live_video` | Lives | `/lives` |
| `pixel` | Loja Online (Storefront) | `/integrations` (config) |
| `insights` | Gestor de Mídias IA | `/media` |

### Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useMetaConnection.ts` | Hook com tipos `MetaScopePack` e `MetaAssets` |
| `src/components/integrations/MetaUnifiedSettings.tsx` | UI principal com scope packs + consentimento incremental |
| `src/components/integrations/MetaConnectionSettings.tsx` | Card alternativo de conexão |
| `supabase/functions/meta-oauth-start/index.ts` | Gera URL OAuth com escopos por pack |
| `supabase/functions/meta-oauth-callback/index.ts` | Callback com descoberta de ativos + merge de packs |
| `supabase/functions/meta-page-webhook/index.ts` | Webhook para Messenger + comentários FB |
| `supabase/functions/meta-instagram-webhook/index.ts` | Webhook para Instagram DM + comentários IG |
| `supabase/functions/meta-send-message/index.ts` | Envio unificado Messenger/IG DM via Graph API |
| `supabase/functions/support-send-message/index.ts` | Roteamento de canais (inclui fb_messenger, ig_dm) |
| `supabase/functions/meta-leads-webhook/index.ts` | Webhook para Lead Ads → customers + tag + notificação |

### Tipos TypeScript

```typescript
type MetaScopePack = "atendimento" | "publicacao" | "ads" | "leads" | "catalogo" | "whatsapp" | "threads" | "live_video" | "pixel" | "insights";

interface MetaAssets {
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string }>;
  ad_accounts: Array<{ id: string; name: string }>;
  catalogs: Array<{ id: string; name: string }>;
  threads_profile: { id: string; username: string } | null;
}
```

---

## Meta — Catálogo de Produtos (Fase 5)

> **STATUS:** ✅ Ready  
> **Adicionado em:** 2026-02-14

### Visão Geral

Sincroniza produtos locais com catálogos do Meta Commerce Manager via Graph API v21.0. Permite criar novos catálogos e enviar produtos em lote.

### Tabela

| Tabela | Descrição |
|--------|-----------|
| `meta_catalog_items` | Rastreia status de sincronização por produto/catálogo |

**Colunas principais:**
- `tenant_id` — Isolamento multi-tenant
- `product_id` — FK para `products`
- `catalog_id` — ID do catálogo Meta
- `meta_product_id` — ID retornado pela Meta após sync
- `status` — `pending`, `synced`, `error`
- `last_synced_at` — Timestamp do último sync
- `last_error` — Mensagem de erro (se houver)
- **Unique:** `(tenant_id, product_id, catalog_id)`

### Edge Functions

| Function | Ações | Descrição |
|----------|-------|-----------|
| `meta-catalog-sync` | `sync` | Envia produtos ativos para o catálogo Meta |
| `meta-catalog-create` | `list`, `create` | Lista catálogos existentes / Cria novo catálogo |

### Formato de Produto (Commerce API)

```json
{
  "retailer_id": "product-uuid",
  "name": "Nome do Produto",
  "description": "Descrição",
  "url": "https://loja.com/produto/slug",
  "image_url": "https://...",
  "additional_image_urls": ["https://..."],
  "price": 9990,
  "currency": "BRL",
  "availability": "in stock",
  "brand": "Nome da Loja",
  "sale_price": 7990,
  "gtin": "7891234567890"
}
```

**Notas:**
- Preço em **centavos** (ex: R$ 99,90 → `9990`)
- `sale_price` só incluído se `compare_at_price > price`
- `gtin` só incluído se produto tiver GTIN/EAN cadastrado
- Imagens adicionais vindas de `product_images` (até 10)

### Hook Frontend

| Hook | Descrição |
|------|-----------|
| `useMetaCatalog` | Queries: `catalogs`, `syncStatus`. Mutations: `createCatalog`, `syncProducts` |

### Fluxo de Sincronização

```text
1. Tenant seleciona catálogo (ou cria novo)
2. Clica "Sincronizar Produtos"
3. meta-catalog-sync busca produtos ativos do tenant
4. Converte para formato Commerce API
5. POST /{catalog_id}/batch para Meta
6. Registra resultado em meta_catalog_items
7. Produtos com erro ficam com status 'error' + mensagem
```

---

## Meta — Threads (Fase 6)

> **STATUS:** ✅ Ready  
> **Adicionado em:** 2026-02-14

### Visão Geral

Publicação de conteúdo e consulta de métricas no Threads (Meta) via Threads API v21.0.

### Edge Functions

| Function | Ações | Descrição |
|----------|-------|-----------|
| `meta-threads-publish` | `publish`, `list` | Publica texto/imagem/vídeo + lista posts recentes |
| `meta-threads-insights` | `post`, `profile` | Métricas por post ou do perfil |

### Tipos de Post Suportados

| Tipo | `media_type` | Campos obrigatórios |
|------|-------------|---------------------|
| Texto | `TEXT` | `text` |
| Imagem | `IMAGE` | `image_url`, `text` (opcional) |
| Vídeo | `VIDEO` | `video_url`, `text` (opcional) |

### Container Flow (Vídeos)

Para vídeos, a Threads API usa um fluxo assíncrono:

```text
1. POST /{user_id}/threads → cria container (status: IN_PROGRESS)
2. Polling: GET /{container_id}?fields=status
3. Aguarda status = FINISHED (retry com backoff: 5s, 10s, 20s)
4. POST /{user_id}/threads_publish → publica container
5. Retorna creation_id do post publicado
```

**Timeout:** 3 retries, máximo ~35 segundos de polling.

### Métricas Disponíveis

**Por Post:**

| Métrica | Descrição |
|---------|-----------|
| `views` | Visualizações |
| `likes` | Curtidas |
| `replies` | Respostas |
| `reposts` | Repostagens |
| `quotes` | Citações |

**Por Perfil (Período):**

| Métrica | Descrição |
|---------|-----------|
| `views` | Views no período |
| `likes` | Curtidas no período |
| `replies` | Respostas no período |
| `reposts` | Repostagens no período |
| `quotes` | Citações no período |
| `followers_count` | Total de seguidores |

### Hook Frontend

| Hook | Descrição |
|------|-----------|
| `useMetaThreads` | Queries: `posts`, `profileInsights`. Mutation: `publish` |

### Escopos Necessários

Pack `threads` requer:
- `threads_content_publish`
- `threads_manage_replies`
- `threads_manage_insights`
- `threads_basic`
- `threads_read_replies`

### Endpoints da API Utilizados

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/{user_id}/threads` | POST | Criar container de mídia |
| `/{user_id}/threads_publish` | POST | Publicar container |
| `/{user_id}/threads` | GET | Listar posts recentes |
| `/{container_id}` | GET | Verificar status do container |
| `/{post_id}/insights` | GET | Métricas de um post |
| `/{user_id}/threads_insights` | GET | Métricas do perfil |

---

## Meta — oEmbed (Fase 7)

> **STATUS:** ✅ Ready  
> **Adicionado em:** 2026-02-14

### Visão Geral

Incorpora posts públicos do Facebook, Instagram e Threads diretamente nas páginas da loja via oEmbed API oficial da Meta.

### Edge Function

| Function | Descrição |
|----------|-----------|
| `meta-oembed` | Busca HTML de incorporação por URL (detecção automática de plataforma) |

### Bloco no Builder

| Bloco | Tipo | Props |
|-------|------|-------|
| `EmbedSocialPost` | Interactive | `url` (URL do post), `maxWidth` (default: 550) |

### Plataformas Suportadas

| Plataforma | Endpoint oEmbed |
|------------|-----------------|
| Instagram | `graph.facebook.com/v21.0/instagram_oembed` |
| Facebook | `graph.facebook.com/v21.0/oembed_post` |
| Threads | `graph.facebook.com/v21.0/threads_oembed` |

### Autenticação

Usa **App Token** (`APP_ID|APP_SECRET`) para maior taxa de requisições. Funciona sem token para posts públicos.

### Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/meta-oembed/index.ts` | Edge function oEmbed |
| `src/components/builder/blocks/interactive/EmbedSocialPostBlock.tsx` | Bloco do Builder |

---

## Meta — Lives (Fase 8)

> **STATUS:** ✅ Ready  
> **Adicionado em:** 2026-02-14

### Visão Geral

Gerenciamento de transmissões ao vivo via Facebook Live Video API. O lojista cria/agenda a live pela plataforma e usa software externo (OBS, StreamYard) para transmitir o sinal via RTMP.

### Tabela

| Tabela | Descrição |
|--------|-----------|
| `meta_live_streams` | Transmissões com status, stream URL, métricas e metadata |

**Status possíveis:** `scheduled`, `live`, `ended`

### Edge Functions

| Function | Ações | Descrição |
|----------|-------|-----------|
| `meta-live-create` | `create`, `list` | Criar transmissão + listar existentes |
| `meta-live-manage` | `go_live`, `end`, `status` | Iniciar, encerrar e verificar métricas |

### Fluxo Completo

```text
1. Lojista seleciona página e cria transmissão (título, descrição, horário)
2. Graph API retorna: live_video_id, stream_url (RTMP), secure_stream_url
3. Lojista configura OBS/StreamYard com a stream URL + key
4. Quando pronto, clica "Iniciar" → go_live muda status para LIVE_NOW
5. Durante a live: status verifica métricas (viewers, embed_html)
6. Ao finalizar: end encerra a transmissão
```

### Hook Frontend

| Hook | Descrição |
|------|-----------|
| `useMetaLives` | Queries: `streams`. Mutations: `create`, `goLive`, `endStream`, `checkStatus` |

### Escopos Necessários

Pack `live_video` requer:
- `publish_video`
- `pages_manage_posts`

### Endpoints da API

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/{page_id}/live_videos` | POST | Criar transmissão |
| `/{live_video_id}` | POST | Atualizar status (LIVE_NOW / end) |
| `/{live_video_id}?fields=status,live_views,embed_html` | GET | Verificar status e métricas |

### Fase 9 — Page Insights

#### Edge Function: `meta-page-insights`

| Action | Descrição | Métricas |
|--------|-----------|----------|
| `page_overview` | Insights da página FB | `page_impressions`, `page_engaged_users`, `page_fans`, `page_views_total` |
| `page_demographics` | Demográficos FB (lifetime) | `page_fans_gender_age`, `page_fans_city`, `page_fans_country` |
| `ig_overview` | Insights da conta IG | `impressions`, `reach`, `accounts_engaged`, `total_interactions` |
| `ig_demographics` | Demográficos IG (lifetime) | `engaged_audience_demographics` (breakdown: age, gender, city, country) |
| `list_pages` | Listar páginas e contas IG | — |

#### Parâmetros

| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `tenantId` | UUID | ✅ | ID do tenant |
| `action` | string | ✅ | Ação a executar |
| `pageId` | string | ❌ | ID da página (default: primeira) |
| `period` | string | ❌ | `day`, `week`, `days_28` (default: `day`) |
| `metric` | string | ❌ | Override de métricas separadas por vírgula |
| `since` | string | ❌ | Data início (Unix timestamp) |
| `until` | string | ❌ | Data fim (Unix timestamp) |

#### Hook: `useMetaPageInsights`

```typescript
import { useMetaPageInsights } from "@/hooks/useMetaPageInsights";

const {
  pages, igAccounts,
  pageOverview, pageDemographics,
  igOverview, igDemographics,
  refetchAll
} = useMetaPageInsights(selectedPageId);
```

#### Endpoints Graph API v21.0

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/{page_id}/insights` | GET | Métricas da página FB |
| `/{ig_user_id}/insights` | GET | Métricas da conta IG |

---

## Google Hub — Fase 4: Google Ads Manager

### Tabelas

| Tabela | Descrição | UNIQUE |
|--------|-----------|--------|
| `google_ad_campaigns` | Cache local de campanhas | `(tenant_id, google_campaign_id)` |
| `google_ad_insights` | Métricas diárias por campanha | `(tenant_id, google_campaign_id, date)` |
| `google_ad_audiences` | Listas de público/remarketing | `(tenant_id, google_audience_id)` |

### Campos: `google_ad_campaigns`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `google_campaign_id` | TEXT | ID da campanha no Google Ads |
| `ad_account_id` | TEXT | Customer ID (sem hífens) |
| `name` | TEXT | Nome da campanha |
| `status` | TEXT | `ENABLED`, `PAUSED`, `REMOVED` |
| `campaign_type` | TEXT | `SEARCH`, `DISPLAY`, `VIDEO`, `SHOPPING`, `PERFORMANCE_MAX` |
| `bidding_strategy_type` | TEXT | `TARGET_CPA`, `TARGET_ROAS`, `MAXIMIZE_CONVERSIONS`, etc. |
| `budget_amount_micros` | BIGINT | Orçamento em micros (÷ 1.000.000 = valor real) |
| `budget_type` | TEXT | `DAILY` ou `TOTAL` |
| `optimization_score` | NUMERIC | Score 0-1 de otimização |

### Campos: `google_ad_insights`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `date` | DATE | Data da métrica |
| `impressions` | BIGINT | Total de impressões |
| `clicks` | BIGINT | Total de cliques |
| `cost_micros` | BIGINT | Custo em micros |
| `conversions` | NUMERIC | Total de conversões |
| `conversions_value` | NUMERIC | Valor das conversões |
| `ctr` | NUMERIC | Click-through rate |
| `average_cpc_micros` | BIGINT | CPC médio em micros |
| `video_views` | BIGINT | Visualizações de vídeo |

### Edge Functions

#### `google-ads-campaigns`

| Action | Descrição | API |
|--------|-----------|-----|
| `sync` | Puxa campanhas via GAQL searchStream | Google Ads API v18 |
| `list` | Lista do cache local | Supabase |

**Parâmetros sync:** `tenant_id` (obrigatório), `customer_id` (opcional, default primeiro da lista de assets)

#### `google-ads-insights`

| Action | Descrição | API |
|--------|-----------|-----|
| `sync` | Puxa métricas diárias via GAQL | Google Ads API v18 |
| `list` | Lista do cache com filtros | Supabase |
| `summary` | Agregação (impressões, cliques, gasto, ROAS) | Supabase |

**Parâmetros sync:** `tenant_id`, `customer_id`, `date_from`, `date_to` (default últimos 30 dias)

#### `google-ads-audiences`

| Action | Descrição | API |
|--------|-----------|-----|
| `sync` | Puxa user lists via GAQL | Google Ads API v18 |
| `list` | Lista do cache local | Supabase |

### Credenciais necessárias

| Credencial | Onde | Obrigatória |
|------------|------|-------------|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | `platform_credentials` | ✅ |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | `platform_credentials` | ❌ (só MCC) |
| `GOOGLE_CLIENT_ID` | Secrets | ✅ (já existe) |
| `GOOGLE_CLIENT_SECRET` | Secrets | ✅ (já existe) |

### Hook: `useGoogleAds`

```typescript
import { useGoogleAds } from "@/hooks/useGoogleAds";

const {
  campaigns, campaignsLoading, syncCampaigns, isSyncingCampaigns,
  summary, summaryLoading, syncInsights, isSyncingInsights,
  audiences, audiencesLoading, syncAudiences, isSyncingAudiences,
  syncAll, isSyncingAll,
} = useGoogleAds();
```

### Mapeamento Tabela → Edge Function

| Tabela | Edge Functions |
|--------|----------------|
| `google_ad_campaigns` | `google-ads-campaigns` |
| `google_ad_insights` | `google-ads-insights` |
| `google_ad_audiences` | `google-ads-audiences` |

---

## Google Hub — Fase 5: Google Analytics GA4

### Tabela

| Tabela | Descrição | UNIQUE |
|--------|-----------|--------|
| `google_analytics_reports` | Cache de métricas diárias GA4 | `(tenant_id, property_id, report_type, date, dimensions)` |

### Campos: `google_analytics_reports`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `property_id` | TEXT | ID da propriedade GA4 (sem prefixo `properties/`) |
| `report_type` | TEXT | `daily_overview` (padrão) |
| `date` | DATE | Data da métrica |
| `dimensions` | JSONB | Dimensões do relatório |
| `metrics` | JSONB | `sessions`, `totalUsers`, `newUsers`, `screenPageViews`, `bounceRate`, `averageSessionDuration`, `conversions`, `totalRevenue` |

### Edge Function: `google-analytics-report`

| Action | Descrição | API |
|--------|-----------|-----|
| `sync` | Puxa métricas diárias via GA4 Data API | `runReport` |
| `realtime` | Usuários ativos em tempo real | `runRealtimeReport` |
| `list` | Lista do cache com filtros | Supabase |
| `summary` | Agregação (sessões, users, conversões, receita) | Supabase |

**Parâmetros sync:** `tenant_id`, `property_id` (opcional), `date_from`, `date_to`

**Métricas realtime:** `activeUsers`, `screenPageViews`, `conversions`

### Hook: `useGoogleAnalytics`

```typescript
import { useGoogleAnalytics } from "@/hooks/useGoogleAnalytics";

const {
  summary, summaryLoading,
  realtime, realtimeLoading,
  reports, reportsLoading,
  sync, isSyncing,
} = useGoogleAnalytics(selectedPropertyId);
```

**Nota:** `realtimeQuery` auto-refetch a cada 60s com staleTime de 30s.

### Mapeamento Tabela → Edge Function

| Tabela | Edge Functions |
|--------|----------------|
| `google_analytics_reports` | `google-analytics-report` |

### Fase 6: Google Search Console (✅ Concluída)

#### Tabela: `google_search_console_data`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `site_url` | TEXT | URL do site verificado |
| `report_type` | TEXT | Tipo de relatório (`search_analytics`) |
| `date` | DATE | Data do dado |
| `query` | TEXT | Termo de busca |
| `page` | TEXT | URL da página |
| `country` | TEXT | País |
| `device` | TEXT | Dispositivo (DESKTOP, MOBILE, TABLET) |
| `clicks` | INTEGER | Cliques |
| `impressions` | INTEGER | Impressões |
| `ctr` | NUMERIC(6,4) | Taxa de cliques |
| `position` | NUMERIC(6,2) | Posição média |

#### Edge Function: `google-search-console`

| Action | Descrição | API |
|--------|-----------|-----|
| `sync` | Busca dados via Search Analytics API e upsert | `searchAnalytics/query` |
| `list` | Lista dados do cache local | DB |
| `summary` | Resumo agregado (cliques, impressões, CTR, posição, top queries/pages) | DB |
| `sites` | Lista sites verificados | `webmasters/v3/sites` |

#### Hook: `useGoogleSearchConsole(siteUrl?, dateRange?)`

| Query | Descrição |
|-------|-----------|
| `summaryQuery` | Resumo agregado |
| `dataQuery` | Dados detalhados |
| `sitesQuery` | Sites verificados |
| `syncMutation` | Sincroniza dados da API |

#### Mapeamento Tabela → Edge Functions

| Tabela | Edge Functions |
|--------|----------------|
| `google_search_console_data` | `google-search-console` |

---

## Pendências

- [ ] Implementar integrações ERP (Bling)
- [ ] Sincronização de pedidos Olist → Sistema
- [ ] Sincronização de estoque Sistema → Olist
- [ ] Emissão de NF-e via Olist
- [x] ~~Melhorar UX de reconexão OAuth~~ (mensagens de erro detalhadas)
- [ ] Logs de erro por integração
- [ ] YouTube Analytics sync
- [ ] YouTube auto-captions
- [ ] YouTube: sync job para verificar status de vídeos agendados
- [x] ~~Meta Scope Packs + OAuth Incremental~~ (Fase 1 concluída)
- [x] ~~Meta Atendimento: Messenger + Instagram DM + Comentários~~ (Fase 2 concluída)
- [x] ~~Meta Catálogo: Sincronização de produtos~~ (Fase 5 concluída)
- [x] ~~Meta Threads: Publicação + Insights~~ (Fase 6 concluída)
- [x] ~~Meta Ads Manager: Gestor de Tráfego~~ (Fase 3 concluída)
- [x] ~~Meta Lead Ads: Captura automática~~ (Fase 4 concluída)
- [x] ~~Meta oEmbed: Bloco no Builder~~ (Fase 7 concluída)
- [x] ~~Meta Lives: Módulo de transmissões~~ (Fase 8 concluída)
- [x] ~~Meta Page Insights: Métricas agregadas~~ (Fase 9 concluída)
- [x] ~~Google Hub Base: OAuth + DB + UI~~ (Fase 1 concluída)
- [x] ~~Google Hub: Migração YouTube~~ (Fase 2 concluída)
- [x] ~~Google Merchant Center~~ (Fase 3 concluída)
- [x] ~~Google Ads Manager~~ (Fase 4 concluída)
- [x] ~~Google Analytics GA4~~ (Fase 5 concluída)
- [x] ~~Google Search Console~~ (Fase 6 concluída)
- [ ] Google Meu Negócio (Fase 7)
- [ ] Google Tag Manager (Fase 8)
