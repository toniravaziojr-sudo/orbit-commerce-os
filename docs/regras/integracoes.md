# Integrações — Regras e Especificações

> **STATUS:** 🟧 Pending (em construção)

## Visão Geral

Hub central de integrações com serviços externos: pagamentos, redes sociais, marketplaces, WhatsApp, email, ERP.

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Integrations.tsx` | Página principal |
| `src/components/payments/PaymentGatewaySettings.tsx` | Config de gateways |
| `src/components/integrations/WhatsAppProviderTabs.tsx` | Config WhatsApp |
| `src/components/integrations/MarketplacesIntegrationTab.tsx` | Marketplaces |
| `src/components/integrations/MetaConnectionSettings.tsx` | Meta/Facebook |
| `src/components/emails/EmailDnsSettings.tsx` | DNS de email |

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
| TikTok | 🟧 Pending | Planejado |
| Google | 🟧 Pending | Merchant Center |

### 3. Marketplaces
| Marketplace | Status | Descrição |
|-------------|--------|-----------|
| Mercado Livre | ✅ Ready | Sincronização de produtos |
| Amazon | 🟧 Pending | Planejado |
| Shopee | 🟧 Pending | Planejado |

### 4. WhatsApp
| Provider | Status | Descrição |
|----------|--------|-----------|
| WhatsApp Cloud API | 🟧 Pending | Oficial Meta |
| Z-API | 🟧 Pending | Não-oficial |
| Evolution API | 🟧 Pending | Self-hosted |

### 5. Email
| Serviço | Status | Descrição |
|---------|--------|-----------|
| Resend | ✅ Ready | Transacional |
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
| Email | Configuração global de email |
| WhatsApp | Providers de WhatsApp |
| Fiscal | Integrações fiscais |
| Logística | Transportadoras |
| IA | Configuração de AI |

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

## Webhooks

| Provider | Endpoint | Descrição |
|----------|----------|-----------|
| Mercado Pago | `/webhooks/mercadopago` | Pagamentos |
| Meta | `/webhooks/meta` | Catálogo |
| Mercado Livre | `/webhooks/meli` | Pedidos |

---

## Pendências

- [ ] Validar todos os fluxos OAuth
- [ ] Implementar WhatsApp Cloud API
- [ ] Implementar integrações ERP
- [ ] Melhorar UX de reconexão
- [ ] Logs de erro por integração
