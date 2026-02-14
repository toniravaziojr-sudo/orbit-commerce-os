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
| **YouTube** | ✅ Ready | Upload, agendamento, analytics (via Gestor de Mídias IA) |
| TikTok Ads | 🟧 Pending | Pixel/Conversions |
| Google | 🟧 Pending | Merchant Center |

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

### Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useMetaConnection.ts` | Hook com tipos `MetaScopePack` e `MetaAssets` |
| `src/components/integrations/MetaUnifiedSettings.tsx` | UI principal com scope packs + consentimento incremental |
| `src/components/integrations/MetaConnectionSettings.tsx` | Card alternativo de conexão |
| `supabase/functions/meta-oauth-start/index.ts` | Gera URL OAuth com escopos por pack |
| `supabase/functions/meta-oauth-callback/index.ts` | Callback com descoberta de ativos + merge de packs |

### Tipos TypeScript

```typescript
type MetaScopePack = "atendimento" | "publicacao" | "ads" | "leads" | "catalogo" | "whatsapp" | "threads" | "live_video";

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
- [ ] Meta Atendimento: Messenger + Instagram DM + Comentários (Fase 2)
- [ ] Meta Catálogo: Sincronização de produtos (Fase 5)
- [ ] Meta Threads: Publicação no Calendário (Fase 6)
- [ ] Meta Ads Manager: Gestor de Tráfego (Fase 3)
- [ ] Meta Lead Ads: Captura automática (Fase 4)
- [ ] Meta oEmbed: Bloco no Builder (Fase 7)
- [ ] Meta Lives: Módulo de transmissões (Fase 8)
- [ ] Meta Page Insights: Métricas agregadas (Fase 9)
