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
| Late | Late integration |
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
| Meta | `social` | `MetaUnifiedSettings`, `LateConnectionSettings` | Meta, Late |
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

### 2. Redes Sociais
| Plataforma | Status | Descrição |
|------------|--------|-----------|
| Meta (FB/IG) | ✅ Ready | Catálogo, pixel |
| Instagram | ✅ Ready | Via Meta |
| Late | ✅ Ready | Agendamento de posts |
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
| Tiny | 🟧 Coming Soon | Sincronização |

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
| Late | Late integration |
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

## Pendências

- [ ] Implementar integrações ERP (Bling, Tiny)
- [ ] Melhorar UX de reconexão OAuth
- [ ] Logs de erro por integração
