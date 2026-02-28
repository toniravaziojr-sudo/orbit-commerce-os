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
| Resumo | Dashboard de status geral |
| Email e Domínios | SendGrid, Cloudflare (plataforma) |
| WhatsApp | Z-API manager, Meta Cloud API (plataforma) |
| Fiscal | Nuvem Fiscal, Focus NFe |
| Logística | Loggi OAuth global |
| IA | Gemini Nativa, OpenAI Nativa, Lovable AI Gateway (fallback), Firecrawl |
| **Meta** | Meta Ads/Pixel (APP_ID, APP_SECRET) — GRAPH_API_VERSION e WEBHOOK_VERIFY_TOKEN são internos |
| **Google** | Google OAuth (CLIENT_ID, CLIENT_SECRET) |
| **TikTok Ads** | TikTok Ads (APP_ID, APP_SECRET) — Business Developer Portal |
| **TikTok Shop** | TikTok Shop (SHOP_APP_KEY, SHOP_APP_SECRET) — Shop Partner Center |
| Mercado Livre | Meli platform config |
| Mercado Pago | MP Billing platform config |
| Shopee | Shopee platform config |

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
| **TikTok** | `tiktok` | `TikTokUnifiedSettings` | Hub TikTok multi-conexão (Ads, Shop, Content) |
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
| **TikTok Hub** | ✅ Ready (Fase 6) | Hub multi-conexão: Ads (Pixel/CAPI) ✅, Shop (OAuth+Catálogo+Pedidos+Fulfillment) ✅, Content (Login Kit) ✅ |
| **Google Hub** | ✅ Ready | YouTube, Ads, Merchant, Analytics, Search Console, Business, Tag Manager |

### 3. Marketplaces
| Marketplace | Status | Descrição |
|-------------|--------|-----------|
| Mercado Livre | ✅ Ready | Sincronização de produtos |
| Shopee | ✅ Ready | Sincronização de pedidos e OAuth |
| Olist | ✅ Ready | ERP (Tiny) + E-commerce (Vnda) via token |
| TikTok Shop | ✅ Ready | Marketplace integrado (via Hub TikTok, tabela `tiktok_shop_connections`). Módulo de gestão em `/marketplaces/tiktokshop` |
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

| Tab | Descrição | Credenciais |
|-----|-----------|-------------|
| Resumo | Dashboard de status geral | — |
| Email e Domínios | SendGrid + Cloudflare | `SENDGRID_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID` |
| WhatsApp | Z-API manager account | `ZAPI_MANAGER_TOKEN` |
| Fiscal | Focus NFe | `FOCUS_NFE_TOKEN` |
| Logística | Loggi OAuth | `LOGGI_CLIENT_ID`, `LOGGI_CLIENT_SECRET` |
| IA | Firecrawl e AI config | `FIRECRAWL_API_KEY` |
| **Meta** | Meta Ads/Pixel platform config | `META_APP_ID`, `META_APP_SECRET` (+ `META_GRAPH_API_VERSION` e `META_WEBHOOK_VERIFY_TOKEN` internos, não editáveis na UI) |
| **Google** | Google OAuth platform config | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **TikTok Ads** | TikTok Ads platform config (Pixel, CAPI, Campanhas) | `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` |
| **TikTok Shop** | TikTok Shop platform config (Catálogo, Pedidos, Fulfillment) | `TIKTOK_SHOP_APP_KEY`, `TIKTOK_SHOP_APP_SECRET` |
| Mercado Livre | Meli platform config | `MELI_APP_ID`, `MELI_CLIENT_SECRET` |
| Mercado Pago | MP Billing platform config | `MP_ACCESS_TOKEN` |
| Shopee | Shopee platform config | `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY` |

### ⚠️ REGRA: Padrão Visual Obrigatório — CredentialEditor

> **NÃO NEGOCIÁVEL** — Todas as abas de credenciais em `/platform-integrations` DEVEM usar o componente `CredentialEditor` (`src/components/integrations/CredentialEditor.tsx`).

**Proibido:**
- Criar cards com `<Input>` + `<Button Save>` manuais para editar credenciais
- Criar lógica própria de `useMutation` para `platform-credentials-update` dentro do componente da aba
- Criar estados `values`, `visibleKeys`, `showSecret` etc. manuais para gerenciar visibilidade

**Obrigatório:**
- Usar `<CredentialEditor credentialKey="..." label="..." ... />` para CADA credencial
- Buscar dados via `useQuery` com key `["platform-secrets-status", "<provider>"]`
- Layout padrão: Header com ícone + título + badge → Alert informativo → Card com CredentialEditors empilhados
- Seções adicionais (URLs, webhooks) ficam em Cards separados abaixo

**Exemplo de estrutura:**
```tsx
<div className="space-y-6">
  {/* Header com ícone */}
  {/* Alert informativo */}
  <Card>
    <CardHeader> {/* Badge Configurado/Pendente */} </CardHeader>
    <CardContent className="space-y-4">
      <CredentialEditor credentialKey="KEY_1" ... />
      <CredentialEditor credentialKey="KEY_2" ... />
    </CardContent>
  </Card>
  {/* Card de URLs (se aplicável) */}
</div>
```

---

## Fluxo OAuth (Marketplaces)

```
1. Usuário acessa Integrações → aba Marketplaces
2. Clica "Conectar" no card do marketplace (OAuth inicia direto, sem redirecionar)
3. Popup abre para provider
4. Provider redireciona de volta com code para callback page
5. Callback page chama edge function via POST (JSON) para trocar code por tokens
6. Edge function retorna JSON com status (não redireciona no modo popup)
7. Callback page envia postMessage para janela principal e fecha popup
8. Tokens armazenados no banco
9. Status atualizado para "connected"
10. Se desconectado, módulo do marketplace exibe botão para /integrations?tab=marketplaces (sem redirect automático)
```

### Regra: Local de Conexão (OBRIGATÓRIO)

> A conexão/desconexão de marketplaces **DEVE acontecer em `/integrations` (aba Marketplaces)**.
> Os módulos individuais (`/marketplaces/mercadolivre`, `/marketplaces/shopee`, etc.) são exclusivos para **gestão**.
> Se o usuário acessar o módulo sem conexão ativa, exibir **botão/link para `/integrations?tab=marketplaces`** (NÃO redirecionar automaticamente).

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
> **Atualizado em:** 2026-02-16 — Consolidação Pixel/CAPI/Catálogo + Seleção de Ativos

### Visão Geral

A integração Meta usa **Scope Packs** para consentimento incremental. O tenant conecta apenas os packs que precisa e pode adicionar novos depois sem perder o token existente.

**Hub centralizado** — Todas as funcionalidades Meta (Pixel, CAPI, Catálogo, Publicação, Atendimento, Ads, etc.) ficam **exclusivamente** em `/integrations?tab=social` (MetaUnifiedSettings). O módulo legado `/marketing` foi removido.

### Scope Packs Disponíveis

| Pack | Label | Escopos Graph API |
|------|-------|-------------------|
| `whatsapp` | WhatsApp | `whatsapp_business_management`, `whatsapp_business_messaging` |
| `publicacao` | Publicação | `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish` |
| `atendimento` | Atendimento | `pages_messaging`, `instagram_manage_messages`, `pages_manage_engagement`, `pages_read_user_content`, `pages_read_engagement` |
| `ads` | Anúncios | `ads_management`, `ads_read`, `pages_manage_ads`, `leads_retrieval` |
| `leads` | Leads | `leads_retrieval`, `pages_manage_ads` |
| `catalogo` | Catálogo | `catalog_management` |
| `threads` | Threads | ⚠️ **OAuth separado** via `threads.net` — NÃO incluído no fluxo Facebook. Escopos: `threads_content_publish`, `threads_manage_replies`, `threads_manage_insights`, `threads_basic`, `threads_read_replies` |
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

### Seleção Granular de Ativos (DURANTE o OAuth)

> **Adicionado em:** 2026-02-16

Após o OAuth, o callback descobre os ativos disponíveis mas **NÃO os salva automaticamente**. Em vez disso, redireciona para uma tela de seleção onde o lojista escolhe quais ativos conectar.

#### Fluxo

```text
1. Usuário clica "Conectar" → popup Meta OAuth
2. Autoriza permissões no Meta
3. meta-oauth-callback troca code por token
4. Callback descobre todos os ativos disponíveis
5. Salva em metadata com `pending_asset_selection: true`
6. Redireciona para MetaOAuthCallback.tsx (tela de seleção)
7. Lojista seleciona quais Pages, Instagram, Ad Accounts, Catalogs, etc. deseja
8. Clica "Confirmar seleção"
9. meta-save-selected-assets salva apenas os ativos selecionados
10. `pending_asset_selection` → false, conexão ativa
```

#### Edge Function: `meta-save-selected-assets`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenantId` | uuid | ID do tenant |
| `selectedAssets` | MetaAssets | Ativos selecionados pelo usuário |

**Resposta:** `{ success: true }` ou `{ success: false, error: string }`

#### Campos de controle em `marketplace_connections.metadata`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `pending_asset_selection` | boolean | `true` = aguardando seleção do lojista |
| `available_assets` | MetaAssets | Todos os ativos encontrados (para exibir na tela de seleção) |
| `assets` | MetaAssets | Ativos efetivamente selecionados pelo lojista |
| `asset_selection_completed_at` | string | Timestamp da seleção |
| `asset_selection_by` | uuid | ID do usuário que selecionou |

### Descoberta de Ativos

O callback OAuth descobre automaticamente:

| Ativo | Endpoint | Campo em `metadata.available_assets` |
|-------|----------|--------------------------------------|
| Páginas | `GET /me/accounts` | `pages[]` |
| Instagram | `GET /{page_id}?fields=instagram_business_account` | `instagram_accounts[]` |
| WhatsApp | `GET /me/businesses` → `/{biz_id}/owned_whatsapp_business_accounts` | `whatsapp_business_accounts[]` |
| Contas de Anúncio | `GET /me/adaccounts` | `ad_accounts[]` |
| Catálogos | `GET /me/businesses` → `/{biz_id}/owned_product_catalogs` | `catalogs[]` |
| Threads | `GET /me/threads?fields=id,username` | `threads_profile` |

### Consolidação Pixel/CAPI/Catálogo

> **Adicionado em:** 2026-02-16

| Funcionalidade | Localização Anterior | Localização Atual |
|----------------|---------------------|-------------------|
| Meta Pixel ID | `/marketing` (MarketingIntegrationsSettings) | `/integrations?tab=social` (MetaUnifiedSettings) |
| Conversions API (CAPI) | `/marketing` (MarketingIntegrationsSettings) | `/integrations?tab=social` (MetaUnifiedSettings) |
| Catálogo de Produtos | `/marketing` (MarketingIntegrationsSettings) | `/integrations?tab=social` (MetaUnifiedSettings) |

**Compatibilidade com Storefront:** O MetaUnifiedSettings ao salvar Pixel/CAPI atualiza tanto `marketplace_connections` quanto `marketing_integrations` para manter o `MarketingTrackerProvider` funcionando.

### Mapeamento: Pack → Módulo do Sistema

| Pack | Módulo | Rota |
|------|--------|------|
| `whatsapp` | Atendimento | `/support` |
| `atendimento` | Atendimento | `/support` |
| `publicacao` | Gestor de Mídias IA | `/media` |
| `threads` | Gestor de Mídias IA | `/media` |
| `ads` | Gestor de Tráfego IA | `/campaigns` |
| `leads` | CRM / Clientes | `/customers` |
| `catalogo` | Hub Meta / Integrações | `/integrations?tab=social` |
| `live_video` | Lives | `/lives` |
| `pixel` | Hub Meta / Integrações | `/integrations?tab=social` |
| `insights` | Gestor de Mídias IA | `/media` |

### Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useMetaConnection.ts` | Hook com tipos `MetaScopePack` e `MetaAssets` |
| `src/components/integrations/MetaUnifiedSettings.tsx` | UI principal com scope packs + consentimento incremental + Pixel/CAPI/Catálogo |
| `src/components/integrations/MetaConnectionSettings.tsx` | Card alternativo de conexão |
| `src/pages/MetaOAuthCallback.tsx` | **Tela de seleção de ativos** (pós-OAuth) |
| `supabase/functions/meta-oauth-start/index.ts` | Gera URL OAuth com escopos por pack |
| `supabase/functions/meta-oauth-callback/index.ts` | Callback com descoberta de ativos + `pending_asset_selection: true` |
| `supabase/functions/meta-save-selected-assets/index.ts` | Salva apenas os ativos selecionados pelo lojista |
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

### Fase 7: Google Meu Negócio / Business Profile (✅ Concluída)

> **Nota:** Este pack requer escopos sensíveis (`business.manage`) que podem exigir aprovação do Google. O sistema funciona sem este pack se o escopo não for aprovado.

#### Tabela: `google_business_reviews`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `location_id` | TEXT | ID da localização (ex: `accounts/123/locations/456`) |
| `review_id` | TEXT | ID da avaliação |
| `reviewer_name` | TEXT | Nome do avaliador |
| `star_rating` | INTEGER | 1-5 estrelas |
| `comment` | TEXT | Texto da avaliação |
| `review_reply` | TEXT | Resposta do lojista |

#### Tabela: `google_business_posts`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `location_id` | TEXT | ID da localização |
| `post_id` | TEXT | ID do post |
| `topic_type` | TEXT | `STANDARD`, `EVENT`, `OFFER` |
| `summary` | TEXT | Texto do post |
| `media_url` | TEXT | URL da mídia |
| `call_to_action_type` | TEXT | Tipo de CTA |
| `state` | TEXT | `LIVE`, `DELETED`, etc. |

#### Edge Functions

| Função | Actions | API |
|--------|---------|-----|
| `google-business-reviews` | `sync`, `list`, `reply`, `locations` | My Business API v4 |
| `google-business-posts` | `sync`, `list`, `create`, `delete` | My Business API v4 |

#### Hook: `useGoogleBusiness(locationId?)`

| Query/Mutation | Descrição |
|----------------|-----------|
| `locationsQuery` | Lista localizações vinculadas |
| `reviewsQuery` | Avaliações do cache |
| `syncReviewsMutation` | Sincroniza avaliações da API |
| `replyMutation` | Responde a avaliação |
| `postsQuery` | Posts do cache |
| `syncPostsMutation` | Sincroniza posts da API |
| `createPostMutation` | Cria post no Business Profile |
| `deletePostMutation` | Deleta post |
| `syncAllMutation` | Sincroniza reviews + posts |

#### Mapeamento Tabela → Edge Functions

| Tabela | Edge Functions |
|--------|----------------|
| `google_business_reviews` | `google-business-reviews` |
| `google_business_posts` | `google-business-posts` |

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
- [x] ~~Google Meu Negócio~~ (Fase 7 concluída)
- [x] ~~Google Tag Manager~~ (Fase 8 concluída)
- [x] ~~TikTok Hub Base: Ads Connection + OAuth + UI + dual-write~~ (Fase 1 concluída)
- [x] ~~TikTok: Pixel/CAPI migração completa + remoção dual-write~~ (Fase 2 concluída)
- [x] ~~TikTok Shop: Tabela Base + OAuth~~ (Fase 3 concluída)
- [x] ~~TikTok Content: Tabela Base + OAuth (Login Kit)~~ (Fase 4 concluída)
- [x] ~~TikTok Shop: Catálogo~~ (Fase 5 concluída)
- [x] ~~TikTok Shop: Pedidos~~ (Fase 6 concluída)
- [x] ~~TikTok Ads: Campanhas e Insights~~ (Fase 10 concluída)
- [x] ~~TikTok Ads: UI Gestor de Tráfego~~ (Fase 11 concluída)
- [ ] TikTok Content: Publicação Orgânica (Fase 12)

---

### Fase 8: Google Tag Manager

#### Tabela `google_tag_manager_containers`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID FK | Tenant |
| `account_id` | TEXT | ID da conta GTM |
| `account_name` | TEXT | Nome da conta |
| `container_id` | TEXT | ID do container |
| `container_name` | TEXT | Nome do container |
| `container_public_id` | TEXT | ID público (GTM-XXXX) |
| `domain_name` | TEXT[] | Domínios associados |
| `usage_context` | TEXT[] | Contextos (web, amp, etc) |
| `tag_manager_url` | TEXT | URL do container no GTM |
| `fingerprint` | TEXT | Fingerprint do container |
| `is_active` | BOOLEAN | Ativo |
| `last_sync_at` | TIMESTAMPTZ | Último sync |
| `metadata` | JSONB | Dados extras |

**UNIQUE**: `(tenant_id, account_id, container_id)`

#### Edge Function: `google-tag-manager`

| Ação | Descrição |
|------|-----------|
| `sync` | Busca accounts + containers da API GTM e faz upsert |
| `list` | Retorna containers do cache (banco) |
| `scripts` | Gera snippets de instalação (head + body) para um container |

#### Hook: `useGoogleTagManager`

| Retorno | Descrição |
|---------|-----------|
| `containersQuery` | Lista de containers do cache |
| `syncMutation` | Sincroniza containers da API |
| `scriptsMutation` | Gera snippets para instalação |

#### Mapeamento Tabela → Edge Functions

| Tabela | Edge Functions |
|--------|----------------|
| `google_tag_manager_containers` | `google-tag-manager` |

---

## TikTok — Hub Multi-Conexão (Ads / Shop / Content)

> **STATUS:** ✅ Ready (Fase 4 — Ads + Shop + Content)  
> **Adicionado em:** 2026-02-15

### Visão Geral

Hub centralizado TikTok na aba "TikTok" de `/integrations`. Diferente de Meta e Google, o TikTok opera com **3 conexões independentes** por tenant porque cada produto (Ads, Shop, Content) requer apps/credenciais/tokens separados.

### Arquitetura: Hub Único na UI, Multi-Connection no Backend

```text
/integrations > TikTok
  +----------------------------+
  | TikTok Ads (Marketing API) |  <-- tiktok_ads_connections
  | [Conectado] Pixel/CAPI     |
  +----------------------------+
  | TikTok Shop (Seller API)   |  <-- tiktok_shop_connections
  | [Conectar/Desconectar]     |
  +----------------------------+
  | TikTok Content (Login Kit) |  <-- tiktok_content_connections
  | [Conectar/Desconectar]     |
  +----------------------------+
```

**Por que 3 tabelas e não 1:**
- Google: 1 tabela → 1 conta Google, 1 par de credenciais
- Meta: 1 tabela → 1 Meta App, 1 par de credenciais
- TikTok: 3 tabelas → 3 apps distintos, 3 pares de credenciais, 3 portais de aprovação

### Tabelas do Banco

| Tabela | Fase | Descrição | Status |
|--------|------|-----------|--------|
| `tiktok_ads_connections` | 1 | Conexão Ads (UNIQUE por `tenant_id`) | ✅ Ready |
| `tiktok_shop_connections` | 3 | Conexão Shop (UNIQUE por `tenant_id`) | ✅ Ready |
| `tiktok_content_connections` | 4 | Conexão Content (UNIQUE por `tenant_id`) | ✅ Ready |
| `tiktok_oauth_states` | 1 | Anti-CSRF com coluna `product` (ads/shop/content) | ✅ Ready |

### Tabela `tiktok_ads_connections`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID UNIQUE FK | Tenant (1 por tenant) |
| `connected_by` | UUID FK | Usuário que conectou |
| `advertiser_id` | TEXT | ID do advertiser TikTok |
| `advertiser_name` | TEXT | Nome do advertiser |
| `tiktok_user_id` | TEXT | ID do usuário TikTok |
| `access_token` | TEXT | Token de acesso |
| `refresh_token` | TEXT | Token de renovação |
| `token_expires_at` | TIMESTAMPTZ | Validade do token |
| `scope_packs` | TEXT[] | Packs concedidos (ex: `['pixel', 'ads_read']`) |
| `granted_scopes` | TEXT[] | Escopos reais retornados pela API |
| `is_active` | BOOLEAN | Conexão ativa |
| `connection_status` | TEXT | `connected`, `error`, `disconnected` |
| `last_error` | TEXT | Último erro |
| `last_sync_at` | TIMESTAMPTZ | Última sincronização |
| `assets` | JSONB | `{ advertiser_ids: [...], pixels: [...] }` |

### Scope Packs (Ads — Marketing API)

| Pack | Escopos TikTok | Sensível |
|------|----------------|----------|
| `pixel` | `event.track.create`, `event.track.view` | Não |
| `ads_read` | `advertiser.data.readonly` | Não |
| `ads_manage` | `advertiser.data.manage`, `campaign.manage`, `creative.manage` | Não |
| `reporting` | `report.read` | Não |
| `audience` | `audience.manage` | Não |

### Scope Packs (Shop — futuro)

| Pack | Escopos TikTok Shop | Sensível |
|------|---------------------|----------|
| `shop_catalog` | `product.read`, `product.edit` | Não |
| `shop_orders` | `order.read`, `order.edit` | Não |
| `shop_fulfill` | `fulfillment.read`, `fulfillment.edit` | Não |
| `shop_chat` | `customer_service.read`, `customer_service.write` | **Sim** |
| `shop_finance` | `finance.read` | **Sim** |
| `shop_returns` | `return.read`, `return.edit` | Não |

### Scope Packs (Content — futuro)

| Pack | Escopos TikTok Login Kit | Sensível |
|------|--------------------------|----------|
| `content_publish` | `video.publish`, `video.list` | Não |
| `content_analytics` | `video.insights` | Não |

### Scope Pack Registry (Backend)

```typescript
const TIKTOK_SCOPE_REGISTRY = {
  // Ads (Marketing API)
  ads_pixel:    { product: 'ads', scopes: ['event.track.create', 'event.track.view'], sensitive: false },
  ads_read:     { product: 'ads', scopes: ['advertiser.data.readonly'], sensitive: false },
  ads_manage:   { product: 'ads', scopes: ['advertiser.data.manage', 'campaign.manage'], sensitive: false },
  ads_report:   { product: 'ads', scopes: ['report.read'], sensitive: false },
  ads_audience: { product: 'ads', scopes: ['audience.manage'], sensitive: false },
  
  // Shop (Partner Center)
  shop_catalog:  { product: 'shop', scopes: ['product.read', 'product.edit'], sensitive: false },
  shop_orders:   { product: 'shop', scopes: ['order.read', 'order.edit'], sensitive: false },
  shop_fulfill:  { product: 'shop', scopes: ['fulfillment.read', 'fulfillment.edit'], sensitive: false },
  shop_chat:     { product: 'shop', scopes: ['customer_service.read', 'customer_service.write'], sensitive: true },
  shop_finance:  { product: 'shop', scopes: ['finance.read'], sensitive: true },
  shop_returns:  { product: 'shop', scopes: ['return.read', 'return.edit'], sensitive: false },
  
  // Content (Login Kit)
  content_publish:   { product: 'content', scopes: ['video.publish', 'video.list'], sensitive: false },
  content_analytics: { product: 'content', scopes: ['video.insights'], sensitive: false },
};
```

### Edge Functions

| Function | Descrição | Status |
|----------|-----------|--------|
| `tiktok-oauth-start` | Gera URL OAuth Ads (v2 com scope packs) | ✅ Ready |
| `tiktok-oauth-callback` | Troca code, salva em `tiktok_ads_connections` (v3 — sem dual-write) | ✅ Ready |
| `tiktok-token-refresh` | Renova `access_token` usando `refresh_token` (v2 — sem dual-write) | ✅ Ready |
| `marketing-send-tiktok` | Events API (CAPI), lê exclusivamente de `tiktok_ads_connections` (v3) | ✅ Ready |
| `tiktok-shop-oauth-start` | Gera URL OAuth Shop (Seller API) | ✅ Ready |
| `tiktok-shop-oauth-callback` | Troca code, salva em `tiktok_shop_connections` | ✅ Ready |
| `tiktok-content-oauth-start` | Gera URL OAuth Content (Login Kit v2) | ✅ Ready |
| `tiktok-content-oauth-callback` | Troca code, salva em `tiktok_content_connections` | ✅ Ready |
| `tiktok-shop-catalog-sync` | Sincroniza catálogo de produtos com TikTok Shop | ✅ Ready |
| `tiktok-shop-catalog-status` | Verifica status de aprovação de produtos | ✅ Ready |
| `tiktok-shop-orders-sync` | Sincroniza pedidos do TikTok Shop | ✅ Ready |
| `tiktok-shop-orders-detail` | Detalhes de pedido individual | ✅ Ready |
| `tiktok-shop-fulfillment` | Fulfillment: submit rastreio, listar, transportadoras | ✅ Ready |

### Retrocompatibilidade (ENCERRADA — Fase 2)

O dual-write para `marketing_integrations` foi **removido** na Fase 2 (2026-02-15).  
A fonte de verdade exclusiva é `tiktok_ads_connections`.

**Colunas legadas em `marketing_integrations` (não mais escritas pelo TikTok Hub):**
- `tiktok_access_token`, `tiktok_refresh_token`, `tiktok_token_expires_at`
- `tiktok_advertiser_id`, `tiktok_advertiser_name`, `tiktok_connected_at`
- `tiktok_connected_by`, `tiktok_pixel_id`, `tiktok_events_api_enabled`
- `tiktok_enabled`, `tiktok_status`

### Credenciais

| Trilha | Credencial | Tipo | Onde fica |
|--------|------------|------|-----------|
| Ads | `TIKTOK_APP_ID` | Plataforma | Secrets |
| Ads | `TIKTOK_APP_SECRET` | Plataforma | Secrets |
| Shop | `TIKTOK_SHOP_APP_KEY` | Plataforma | `platform_credentials` |
| Shop | `TIKTOK_SHOP_APP_SECRET` | Plataforma | `platform_credentials` |
| Content | `TIKTOK_CONTENT_CLIENT_KEY` | Plataforma | `platform_credentials` |
| Content | `TIKTOK_CONTENT_CLIENT_SECRET` | Plataforma | `platform_credentials` |
| Todas | OAuth tokens | Tenant | Tabela de conexão respectiva |

### Hooks e Componentes

| Arquivo | Descrição | Status |
|---------|-----------|--------|
| `src/hooks/useTikTokAdsConnection.ts` | Hook para conexão Ads (lê de `tiktok_ads_connections`) | ✅ Ready |
| `src/hooks/useTikTokShopConnection.ts` | Hook para conexão Shop (lê de `tiktok_shop_connections`) | ✅ Ready |
| `src/hooks/useTikTokContentConnection.ts` | Hook para conexão Content (lê de `tiktok_content_connections`) | ✅ Ready |
| `src/hooks/useTikTokConnection.ts` | ~~Hook legado~~ — **DELETADO na Fase 2** | ❌ Deletado |
| `src/components/integrations/TikTokUnifiedSettings.tsx` | UI Hub com 3 cards (Ads, Shop, Content — todos ativos) | ✅ Ready |
| `src/components/integrations/TikTokIntegrationCard.tsx` | ~~Card legado~~ — **DELETADO na Fase 2** | ❌ Deletado |
| `src/pages/TikTokOAuthCallback.tsx` | Página de callback OAuth | ✅ Ready |
| `src/hooks/useTikTokAds.ts` | Hook para campanhas e insights (lê de `tiktok_ad_campaigns` e `tiktok_ad_insights`) | ✅ Ready |
| `src/components/integrations/tiktok/TikTokAdsPanel.tsx` | Painel operacional Ads (Campanhas + Insights) | ✅ Ready |
| `src/components/integrations/tiktok/TikTokAdsCampaignsTab.tsx` | Tab de campanhas com tabela e sync | ✅ Ready |
| `src/components/integrations/tiktok/TikTokAdsInsightsTab.tsx` | Tab de métricas diárias com tabela e sync | ✅ Ready |

### Tipos TypeScript

```typescript
type TikTokProduct = 'ads' | 'shop' | 'content';

interface TikTokAdsConnectionStatus {
  isConnected: boolean;
  connectionStatus: 'connected' | 'error' | 'disconnected';
  advertiserId: string | null;
  advertiserName: string | null;
  connectedAt: string | null;
  tokenExpiresAt: string | null;
  isExpired: boolean;
  scopePacks: string[];
  grantedScopes: string[];
  assets: {
    advertiser_ids?: string[];
    pixels?: string[];
  };
  lastError: string | null;
}

interface TikTokShopConnectionStatus {
  isConnected: boolean;
  connectionStatus: string;
  shopId: string;
  shopName: string;
  shopRegion: string;
  sellerId: string;
  scopePacks: string[];
  connectedAt: string | null;
  isExpired: boolean;
  lastError: string | null;
  assets: Record<string, unknown>;
}

interface TikTokContentConnectionStatus {
  isConnected: boolean;
  connectionStatus: string;
  openId: string;
  displayName: string;
  avatarUrl: string;
  scopePacks: string[];
  connectedAt: string | null;
  isExpired: boolean;
  lastError: string | null;
  assets: Record<string, unknown>;
}
```

### Tabela `tiktok_shop_connections`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID UNIQUE FK | Tenant (1 por tenant) |
| `connected_by` | UUID FK | Usuário que conectou |
| `shop_id` | TEXT | ID da loja TikTok Shop |
| `shop_name` | TEXT | Nome da loja |
| `shop_region` | TEXT | Região da loja (ex: `BR`) |
| `seller_id` | TEXT | ID do seller |
| `access_token` | TEXT | Token de acesso |
| `refresh_token` | TEXT | Token de renovação |
| `token_expires_at` | TIMESTAMPTZ | Validade do token |
| `refresh_expires_at` | TIMESTAMPTZ | Validade do refresh token |
| `scope_packs` | TEXT[] | Packs concedidos |
| `granted_scopes` | TEXT[] | Escopos reais retornados |
| `is_active` | BOOLEAN | Conexão ativa |
| `connection_status` | TEXT | `connected`, `error`, `disconnected` |
| `last_error` | TEXT | Último erro |
| `connected_at` | TIMESTAMPTZ | Data da conexão |
| `assets` | JSONB | Ativos descobertos |

### Tabela `tiktok_content_connections`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID UNIQUE FK | Tenant (1 por tenant) |
| `connected_by` | UUID FK | Usuário que conectou |
| `open_id` | TEXT | ID do usuário TikTok |
| `union_id` | TEXT | Union ID (cross-app) |
| `display_name` | TEXT | Nome de exibição |
| `avatar_url` | TEXT | URL do avatar |
| `access_token` | TEXT | Token de acesso |
| `refresh_token` | TEXT | Token de renovação |
| `token_expires_at` | TIMESTAMPTZ | Validade do token |
| `refresh_expires_at` | TIMESTAMPTZ | Validade do refresh token |
| `scope_packs` | TEXT[] | Packs concedidos |
| `granted_scopes` | TEXT[] | Escopos reais retornados |
| `is_active` | BOOLEAN | Conexão ativa |
| `connection_status` | TEXT | `connected`, `error`, `disconnected` |
| `last_error` | TEXT | Último erro |
| `connected_at` | TIMESTAMPTZ | Data da conexão |
| `assets` | JSONB | Ativos descobertos |

### OAuth Callback Routing (Multi-Product)

O `TikTokOAuthCallback.tsx` utiliza roteamento sequencial para identificar qual produto está sendo autenticado:

```text
1. Recebe ?code=XXX&state=YYY
2. Tenta tiktok-oauth-callback (Ads) → valida state com product='ads'
3. Se INVALID_STATE → tenta tiktok-shop-oauth-callback → product='shop'
4. Se INVALID_STATE → tenta tiktok-content-oauth-callback → product='content'
5. Primeiro sucesso → conexão salva, postMessage para tab pai
```

**Nota:** Todos os 3 produtos compartilham a mesma redirect URI (`/integrations/tiktok/callback`) e a mesma tabela `tiktok_oauth_states` (diferenciados pela coluna `product`).

### URLs de Integração

| Tipo | URL Pública | Edge Function |
|------|-------------|---------------|
| OAuth Callback (todos) | `https://app.comandocentral.com.br/integrations/tiktok/callback` | Roteado no frontend |
| Ads OAuth (backend) | — | `tiktok-oauth-start` / `tiktok-oauth-callback` |
| Shop OAuth (backend) | — | `tiktok-shop-oauth-start` / `tiktok-shop-oauth-callback` |
| Content OAuth (backend) | — | `tiktok-content-oauth-start` / `tiktok-content-oauth-callback` |
| Webhook (Shop, futuro) | `https://app.comandocentral.com.br/integrations/tiktok/webhook` | `tiktok-webhook` |

### Configuração nos TikTok Developer Portals

**Redirect URI obrigatória (para os 3 apps):**
```
https://app.comandocentral.com.br/integrations/tiktok/callback
```

### Fases de Implementação

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Hub Base: `tiktok_ads_connections` + OAuth + UI + dual-write | ✅ Concluída |
| 2 | Pixel/CAPI migração completa (removido fallback legado + dual-write) | ✅ Concluída |
| 3 | TikTok Shop: `tiktok_shop_connections` + OAuth | ✅ Concluída |
| 4 | TikTok Content: `tiktok_content_connections` + OAuth (Login Kit) | ✅ Concluída |
| 5 | TikTok Shop: Catálogo de Produtos | ✅ Concluída |
| 6 | TikTok Shop: Pedidos | ✅ Concluída |
| 7 | TikTok Shop: Fulfillment e Logística | ✅ Concluída |
| 8 | TikTok Shop: Devoluções e Pós-venda | ✅ Concluída |
| 9 | TikTok Shop: UI Operacional (Catálogo, Pedidos, Envios, Devoluções) | ✅ Concluída |
| 10 | TikTok Ads: Campanhas e Insights | 🟧 Pendente |
| 11 | TikTok Content: Publicação Orgânica | 🟧 Pendente |
| 12 | Webhooks e Analytics Agregados | 🟧 Pendente |

### Fase 5: TikTok Shop Catálogo

#### Tabela: `tiktok_shop_products`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `product_id` | UUID FK | Produto local |
| `tiktok_product_id` | TEXT | ID do produto no TikTok Shop |
| `tiktok_sku_id` | TEXT | ID do SKU no TikTok |
| `status` | TEXT | `pending`, `synced`, `error`, `paused` |
| `sync_action` | TEXT | `create`, `update` |
| `tiktok_status` | TEXT | Status retornado pela API TikTok |
| `tiktok_category_id` | TEXT | Categoria no TikTok |

**UNIQUE**: `(tenant_id, product_id)`

#### Edge Functions

| Function | Actions | Descrição |
|----------|---------|-----------|
| `tiktok-shop-catalog-sync` | `sync`, `list` | Sincroniza produtos e lista cache local |
| `tiktok-shop-catalog-status` | — | Verifica status de aprovação na API TikTok |

#### Hook: `useTikTokCatalog`

| Retorno | Descrição |
|---------|-----------|
| `syncedProducts` | Lista de produtos sincronizados |
| `syncProducts(productIds?)` | Sincronizar produtos (todos ou selecionados) |
| `checkStatus(productIds?)` | Verificar status de aprovação |

#### Mapeamento Tabela → Edge Functions

| Tabela | Edge Functions |
|--------|----------------|
| `tiktok_shop_products` | `tiktok-shop-catalog-sync`, `tiktok-shop-catalog-status` |

### Fase 6: TikTok Shop Pedidos

#### Tabela: `tiktok_shop_orders`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID FK | Tenant |
| `tiktok_order_id` | TEXT | ID do pedido no TikTok Shop |
| `order_id` | UUID FK (nullable) | Pedido local mapeado |
| `status` | TEXT | `pending`, `confirmed`, `shipped`, `delivered`, `cancelled` |
| `tiktok_status` | TEXT | Status original retornado pela API TikTok |
| `buyer_name` | TEXT | Nome do comprador |
| `buyer_email` | TEXT | Email do comprador |
| `buyer_phone` | TEXT | Telefone do comprador |
| `shipping_address` | JSONB | Endereço de entrega |
| `order_total_cents` | INTEGER | Total em centavos |
| `currency` | TEXT | Moeda (default: BRL) |
| `items` | JSONB | Snapshot dos itens |
| `order_data` | JSONB | Dados completos da API TikTok |
| `synced_at` | TIMESTAMPTZ | Último sync |
| `last_error` | TEXT | Último erro |

**UNIQUE**: `(tenant_id, tiktok_order_id)`

#### Edge Functions

| Function | Actions | Descrição |
|----------|---------|-----------|
| `tiktok-shop-orders-sync` | `sync`, `list` | Sincroniza pedidos da API TikTok e lista cache local |
| `tiktok-shop-orders-detail` | — | Busca detalhes completos de um pedido e atualiza cache |

#### Mapeamento de Status TikTok → Local

| Status TikTok | Status Local |
|---------------|-------------|
| `AWAITING_SHIPMENT` | `confirmed` |
| `AWAITING_COLLECTION` | `confirmed` |
| `PARTIALLY_SHIPPING` | `shipped` |
| `IN_TRANSIT` | `shipped` |
| `DELIVERED` | `delivered` |
| `COMPLETED` | `delivered` |
| `CANCELLED` | `cancelled` |
| Outros | `pending` |

#### Hook: `useTikTokOrders`

| Retorno | Descrição |
|---------|-----------|
| `orders` | Lista de pedidos sincronizados |
| `syncOrders(filters?)` | Sincronizar pedidos (com filtro de data) |
| `getOrderDetail(tiktokOrderId)` | Buscar detalhes completos de um pedido |

#### Mapeamento Tabela → Edge Functions

| Tabela | Edge Functions |
|--------|----------------|
| `tiktok_shop_orders` | `tiktok-shop-orders-sync`, `tiktok-shop-orders-detail` |

### Fase 7: TikTok Shop Fulfillment e Logística

#### Tabela: `tiktok_shop_fulfillments`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID FK | Tenant |
| `tiktok_order_id` | TEXT | ID do pedido no TikTok Shop |
| `tiktok_shop_order_id` | UUID FK (nullable) | Referência ao registro local em `tiktok_shop_orders` |
| `shipment_id` | UUID FK (nullable) | Referência ao envio local em `shipments` |
| `tracking_code` | TEXT | Código de rastreio |
| `carrier_code` | TEXT | Código da transportadora |
| `carrier_name` | TEXT | Nome da transportadora |
| `status` | TEXT | `pending`, `submitted`, `error` |
| `tiktok_package_id` | TEXT | ID do pacote retornado pela API TikTok |
| `tiktok_fulfillment_status` | TEXT | Status retornado pela API |
| `shipping_provider_id` | TEXT | ID do provider no TikTok |
| `pickup_slot` | JSONB | Dados de coleta (se aplicável) |
| `fulfillment_data` | JSONB | Dados completos retornados pela API |
| `submitted_at` | TIMESTAMPTZ | Data de submissão |
| `last_error` | TEXT | Último erro |

**UNIQUE**: `(tenant_id, tiktok_order_id, tracking_code)`

#### Edge Function: `tiktok-shop-fulfillment`

| Action | Descrição |
|--------|-----------|
| `submit` | Envia informações de rastreio para o TikTok Shop (ship order) |
| `list` | Lista fulfillments do cache local |
| `shipping_providers` | Lista transportadoras disponíveis no TikTok Shop |

#### Hook: `useTikTokFulfillment`

| Retorno | Descrição |
|---------|-----------|
| `fulfillments` | Lista de fulfillments |
| `shippingProviders` | Transportadoras disponíveis no TikTok Shop |
| `submitFulfillment(data)` | Enviar rastreio para o TikTok Shop |

#### Mapeamento Tabela → Edge Functions

| Tabela | Edge Functions |
|--------|----------------|
| `tiktok_shop_fulfillments` | `tiktok-shop-fulfillment` |

### Fase 8: TikTok Shop Devoluções e Pós-venda ✅

#### Tabela: `tiktok_shop_returns`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID FK | Tenant |
| `tiktok_order_id` | TEXT | ID do pedido no TikTok |
| `tiktok_return_id` | TEXT | ID da devolução no TikTok |
| `tiktok_shop_order_id` | UUID FK (nullable) | Referência ao registro local em `tiktok_shop_orders` |
| `order_id` | UUID FK (nullable) | Pedido local mapeado |
| `return_type` | TEXT | `return`, `refund`, `replacement` |
| `status` | TEXT | `pending`, `approved`, `rejected`, `completed`, `cancelled` |
| `tiktok_status` | TEXT | Status original retornado pela API TikTok |
| `reason` | TEXT | Motivo da devolução |
| `buyer_comments` | TEXT | Comentários do comprador |
| `seller_comments` | TEXT | Comentários do vendedor |
| `refund_amount_cents` | INTEGER | Valor do reembolso em centavos |
| `currency` | TEXT | Moeda (default: BRL) |
| `return_tracking_code` | TEXT | Código de rastreio da devolução |
| `return_carrier` | TEXT | Transportadora da devolução |
| `return_shipping_status` | TEXT | `awaiting_shipment`, `shipped`, `delivered` |
| `items` | JSONB | Itens da devolução |
| `return_data` | JSONB | Dados completos da API TikTok |
| `requested_at` | TIMESTAMPTZ | Data da solicitação |
| `resolved_at` | TIMESTAMPTZ | Data da resolução |

**UNIQUE**: `(tenant_id, tiktok_return_id)`

#### Mapeamento de Status TikTok → Local

| Status TikTok | Status Local |
|---------------|-------------|
| `RETURN_OR_REFUND_REQUEST_PENDING` | `pending` |
| `RETURN_OR_REFUND_REQUEST_REJECT` | `rejected` |
| `RETURN_OR_REFUND_REQUEST_APPROVE` | `approved` |
| `BUYER_RETURN_OR_REFUND_REQUEST_CANCEL` | `cancelled` |
| `AWAITING_BUYER_SHIP` | `approved` |
| `BUYER_SHIPPED_ITEM` | `approved` |
| `SELLER_REJECT_RETURN` | `rejected` |
| `REFUND_OR_RETURN_COMPLETE` | `completed` |
| `REPLACE_COMPLETE` | `completed` |
| `REFUND_COMPLETE` | `completed` |
| Outros | `pending` |

#### Edge Function: `tiktok-shop-returns`

| Action | Descrição |
|--------|-----------|
| `list` | Lista devoluções do cache local |
| `sync` | Sincroniza devoluções da API TikTok (Reverse Orders) |
| `approve` | Aprova uma devolução via API TikTok |
| `reject` | Rejeita uma devolução via API TikTok |

#### Hook: `useTikTokReturns`

| Retorno | Descrição |
|---------|-----------|
| `returns` | Lista de devoluções |
| `syncReturns(filters?)` | Sincronizar devoluções da API TikTok |
| `approveReturn({ returnId, sellerComments? })` | Aprovar devolução |
| `rejectReturn({ returnId, reason? })` | Rejeitar devolução |

#### Mapeamento Tabela → Edge Functions

| Tabela | Edge Functions |
|--------|----------------|
| `tiktok_shop_returns` | `tiktok-shop-returns` |

### Fase 9: UI Operacional do TikTok Shop ✅

#### Componentes

| Arquivo | Descrição |
|---------|-----------|
| `src/components/integrations/tiktok/TikTokShopPanel.tsx` | Painel com abas (Catálogo, Pedidos, Envios, Devoluções) |
| `src/components/integrations/tiktok/TikTokShopCatalogTab.tsx` | Tab Catálogo — sync e status de produtos |
| `src/components/integrations/tiktok/TikTokShopOrdersTab.tsx` | Tab Pedidos — listagem e sync de pedidos |
| `src/components/integrations/tiktok/TikTokShopFulfillmentTab.tsx` | Tab Envios — fulfillments e transportadoras |
| `src/components/integrations/tiktok/TikTokShopReturnsTab.tsx` | Tab Devoluções — devoluções com ações aprovar/rejeitar |

#### Integração

O `TikTokShopPanel` é renderizado dentro do card "TikTok Shop" em `TikTokUnifiedSettings.tsx`, visível apenas quando a conexão Shop está ativa (`shopStatus.isConnected`).

#### Abas

| Tab | Hook | Ações |
|-----|------|-------|
| Catálogo | `useTikTokCatalog` | Sincronizar produtos, verificar status |
| Pedidos | `useTikTokOrders` | Sincronizar pedidos, atualizar lista |
| Envios | `useTikTokFulfillment` | Listar fulfillments, ver transportadoras |
| Devoluções | `useTikTokReturns` | Sincronizar, aprovar, rejeitar devoluções |

### Fase 10: TikTok Ads — Campanhas e Insights ✅

#### Tabela: `tiktok_ad_campaigns`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID FK | Tenant |
| `tiktok_campaign_id` | TEXT | ID da campanha no TikTok |
| `advertiser_id` | TEXT | ID do anunciante |
| `name` | TEXT | Nome da campanha |
| `status` | TEXT | Status de operação TikTok |
| `objective_type` | TEXT | Objetivo (TRAFFIC, CONVERSIONS, etc.) |
| `budget_mode` | TEXT | Modo de orçamento |
| `budget_cents` | INTEGER | Orçamento em centavos |
| `bid_type` | TEXT | Tipo de lance |
| `optimize_goal` | TEXT | Meta de otimização |
| `campaign_type` | TEXT | Tipo de campanha |
| `special_industries` | TEXT[] | Indústrias especiais |
| `metadata` | JSONB | Dados extras |
| `synced_at` | TIMESTAMPTZ | Último sync |

**UNIQUE**: `(tenant_id, tiktok_campaign_id)`

#### Tabela: `tiktok_ad_insights`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID FK | Tenant |
| `campaign_id` | UUID FK (nullable) | Referência local em `tiktok_ad_campaigns` |
| `tiktok_campaign_id` | TEXT | ID da campanha no TikTok |
| `advertiser_id` | TEXT | ID do anunciante |
| `date_start` | DATE | Início do período |
| `date_stop` | DATE | Fim do período |
| `impressions` | BIGINT | Impressões |
| `clicks` | BIGINT | Cliques |
| `spend_cents` | INTEGER | Gasto em centavos |
| `reach` | BIGINT | Alcance |
| `cpc_cents` | INTEGER | CPC em centavos |
| `cpm_cents` | INTEGER | CPM em centavos |
| `ctr` | NUMERIC | CTR |
| `conversions` | INTEGER | Conversões |
| `roas` | NUMERIC | ROAS |
| `video_views` | INTEGER | Visualizações de vídeo |
| `video_watched_2s` | INTEGER | Vídeo assistido 2s |
| `video_watched_6s` | INTEGER | Vídeo assistido 6s |
| `likes` | INTEGER | Curtidas |
| `comments` | INTEGER | Comentários |
| `shares` | INTEGER | Compartilhamentos |
| `follows` | INTEGER | Seguidores |

**UNIQUE**: `(tenant_id, tiktok_campaign_id, date_start)`

#### Edge Functions

| Function | Actions | Descrição |
|----------|---------|-----------|
| `tiktok-ads-campaigns` | `sync`, `list`, `create`, `update`, `delete` | CRUD de campanhas + sync da API TikTok |
| `tiktok-ads-insights` | `sync`, `list` | Sync de métricas da Reporting API TikTok |

#### Hook: `useTikTokAds`

| Retorno | Descrição |
|---------|-----------|
| `campaigns` | Lista de campanhas |
| `insights` | Lista de insights/métricas |
| `syncCampaigns` | Sincronizar campanhas da API TikTok |
| `syncInsights` | Sincronizar métricas da API TikTok |
| `syncAll` | Sincronizar tudo (campanhas + insights) |
| `createCampaign` | Criar campanha no TikTok |
| `updateCampaign` | Atualizar campanha |
| `deleteCampaign` | Remover/arquivar campanha |

#### Mapeamento Tabela → Edge Functions

| Tabela | Edge Functions |
|--------|----------------|
| `tiktok_ad_campaigns` | `tiktok-ads-campaigns` |
| `tiktok_ad_insights` | `tiktok-ads-insights` |

### Fase 11: UI Operacional do TikTok Ads ✅

#### Componentes

| Arquivo | Descrição |
|---------|-----------|
| `src/components/integrations/tiktok/TikTokAdsPanel.tsx` | Painel com abas (Campanhas, Insights) |
| `src/components/integrations/tiktok/TikTokAdsCampaignsTab.tsx` | Tab Campanhas — listagem e sync |
| `src/components/integrations/tiktok/TikTokAdsInsightsTab.tsx` | Tab Insights — métricas diárias |

### Fase 12: TikTok Content — Publicação Orgânica ✅

#### Tabela: `tiktok_content_videos`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID FK | Tenant |
| `tiktok_video_id` | TEXT | ID do vídeo no TikTok |
| `open_id` | TEXT | Open ID do criador |
| `title` | TEXT | Título do vídeo |
| `description` | TEXT | Descrição |
| `cover_url` | TEXT | URL da capa |
| `video_url` | TEXT | URL do vídeo |
| `share_url` | TEXT | URL de compartilhamento |
| `status` | TEXT | Status (draft, uploading, published, failed) |
| `privacy_level` | TEXT | Nível de privacidade |
| `duration_seconds` | INTEGER | Duração em segundos |
| `publish_id` | TEXT | ID de publicação do TikTok |
| `upload_status` | TEXT | Status do upload |
| `error_message` | TEXT | Mensagem de erro |
| `scheduled_at` | TIMESTAMPTZ | Agendamento |
| `published_at` | TIMESTAMPTZ | Data de publicação |
| `metadata` | JSONB | Dados extras (views, likes, etc.) |

**UNIQUE**: `(tenant_id, tiktok_video_id)` WHERE `tiktok_video_id IS NOT NULL`

#### Tabela: `tiktok_content_analytics`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | ID interno |
| `tenant_id` | UUID FK | Tenant |
| `video_id` | UUID FK (nullable) | Referência local |
| `tiktok_video_id` | TEXT | ID do vídeo no TikTok |
| `open_id` | TEXT | Open ID do criador |
| `date` | DATE | Data do registro |
| `views` | INTEGER | Visualizações |
| `likes` | INTEGER | Curtidas |
| `comments` | INTEGER | Comentários |
| `shares` | INTEGER | Compartilhamentos |
| `reach` | INTEGER | Alcance |
| `full_video_watched_rate` | NUMERIC(5,2) | Taxa de vídeo completo |
| `total_time_watched` | INTEGER | Tempo total assistido |
| `average_time_watched` | INTEGER | Tempo médio assistido |
| `impression_sources` | JSONB | Fontes de impressão |
| `audience_territories` | JSONB | Territórios do público |

**UNIQUE**: `(tenant_id, tiktok_video_id, date)`

#### Edge Functions

| Function | Actions | Descrição |
|----------|---------|-----------|
| `tiktok-content-publish` | `list`, `sync`, `init_upload`, `check_status`, `delete` | Gestão de vídeos + upload via Content Posting API |
| `tiktok-content-analytics` | `list`, `sync` | Sync de analytics via Video Query API |

#### Hook: `useTikTokContent`

| Retorno | Descrição |
|---------|-----------|
| `videos` | Lista de vídeos do TikTok |
| `analytics` | Lista de analytics |
| `syncVideos` | Sincronizar vídeos da API |
| `syncAnalytics` | Sincronizar analytics |
| `syncAll` | Sincronizar tudo |
| `initUpload` | Iniciar upload de vídeo |
| `checkStatus` | Verificar status de publicação |
| `deleteVideo` | Remover registro de vídeo |

#### Componentes UI

| Arquivo | Descrição |
|---------|-----------|
| `src/components/integrations/tiktok/TikTokContentPanel.tsx` | Painel com abas (Vídeos, Analytics) |
| `src/components/integrations/tiktok/TikTokContentVideosTab.tsx` | Tab Vídeos — listagem, sync, delete |
| `src/components/integrations/tiktok/TikTokContentAnalyticsTab.tsx` | Tab Analytics — métricas agregadas e tabela |

#### Mapeamento Tabela → Edge Functions

| Tabela | Edge Functions |
|--------|----------------|
| `tiktok_content_videos` | `tiktok-content-publish` |
| `tiktok_content_analytics` | `tiktok-content-analytics` |
