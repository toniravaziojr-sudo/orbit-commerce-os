# Integrações — Regras e Especificações

> **STATUS:** ✅ Ready

## Visão Geral

Hub central de integrações com serviços externos: pagamentos, redes sociais, marketplaces, WhatsApp, email, domínios, ERP.

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

## Estrutura de Abas (Tenant)

| Tab | Valor | Componente | Descrição |
|-----|-------|------------|-----------|
| Pagamentos | `payments` | `PaymentGatewaySettings` | Gateways de pagamento |
| Redes Sociais | `social` | `MetaConnectionSettings`, `LateConnectionSettings` | Meta, Late |
| Marketplaces | `marketplaces` | `MarketplacesIntegrationTab` | Mercado Livre, etc |
| WhatsApp | `whatsapp` | `WhatsAppProviderTabs` | Providers de WhatsApp |
| **Domínio/Email** | `domain-email` | `DomainAndEmailSettings` | Domínio da loja + Email |
| Outros | `outros` | Cards ERP | Integrações ERP (em breve) |
| Plataforma | `platform` | Sub-tabs operador | Apenas para `isPlatformOperator` |

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

## Pendências

- [ ] Implementar WhatsApp Cloud API
- [ ] Implementar integrações ERP (Bling, Tiny)
- [ ] Melhorar UX de reconexão OAuth
- [ ] Logs de erro por integração
