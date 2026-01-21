# Shopee — Regras e Especificações

> **Status:** 🟧 Pending (em implementação)  
> **Última atualização:** 2025-01-21

---

## Visão Geral

Integração OAuth com Shopee Open Platform (OpenAPI v2) para sincronização de pedidos, catálogo e mensagens.

---

## Arquivos Principais

### Edge Functions

| Arquivo | Propósito |
|---------|-----------|
| `supabase/functions/shopee-oauth-start/` | Gera URL de autorização OAuth |
| `supabase/functions/shopee-oauth-callback/` | Processa callback e salva tokens |
| `supabase/functions/shopee-connection-status/` | Verifica status da conexão |
| `supabase/functions/shopee-disconnect/` | Remove conexão do tenant |
| `supabase/functions/shopee-token-refresh/` | Renovação automática de tokens |
| `supabase/functions/shopee-webhook/` | Recebe notificações push da Shopee |
| `supabase/functions/shopee-sync-orders/` | Sincroniza pedidos da Shopee |

### Frontend

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/marketplaces/Shopee.tsx` | Dashboard principal |
| `src/components/marketplaces/ShopeeConnectionCard.tsx` | Card de conexão |
| `src/components/marketplaces/ShopeeOrdersTab.tsx` | Listagem de pedidos |
| `src/components/integrations/ShopeePlatformSettings.tsx` | Config admin (Partner ID/Key) |
| `src/hooks/useShopeeConnection.ts` | Hook de conexão OAuth |
| `src/hooks/useShopeeOrders.ts` | Hook de pedidos |

---

## Fluxo OAuth

```
1. shopee-oauth-start → Gera URL de autorização com sign HMAC-SHA256
2. Usuário autoriza no Shopee Open Platform
3. shopee-oauth-callback → Recebe code + shop_id, troca por tokens
4. Tokens salvos em marketplace_connections (marketplace='shopee')
5. shopee-token-refresh → Renovação automática (access_token ~4h, refresh ~30d)
```

### Geração de Assinatura (Sign)

```typescript
// Fluxo shop-level
const baseString = partner_id + path + timestamp + access_token + shop_id;
const sign = HMAC_SHA256(partner_key, baseString).toString('hex');
```

---

## Regra: Atendimento

> Mensagens da Shopee vão para módulo **Atendimento** (`channel_type='shopee'`).
> **Proibido:** Manter aba de mensagens no marketplace.

---

## Tabela: marketplace_connections

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenant_id` | UUID | FK para tenants |
| `marketplace` | TEXT | `shopee` |
| `access_token` | TEXT | Token atual (validade ~4h) |
| `refresh_token` | TEXT | Token de renovação (~30d) |
| `token_expires_at` | TIMESTAMPTZ | Expiração do access_token |
| `external_user_id` | TEXT | shop_id da Shopee |
| `external_username` | TEXT | Nome da loja (opcional) |
| `is_active` | BOOLEAN | Status da conexão |
| `region` | TEXT | Região (default: BR) |
| `environment` | TEXT | `sandbox` ou `production` |

---

## Credenciais da Plataforma

As credenciais são gerenciadas via `platform_credentials`:

| Credential Key | Descrição |
|----------------|-----------|
| `SHOPEE_PARTNER_ID` | Partner ID da aplicação |
| `SHOPEE_PARTNER_KEY` | Partner Key (secret) |

### URLs para configurar no Shopee Open Platform

| Tipo | URL |
|------|-----|
| Redirect URI | `https://[PROJECT_ID].supabase.co/functions/v1/shopee-oauth-callback` |
| Webhook URL | `https://[PROJECT_ID].supabase.co/functions/v1/shopee-webhook` |

---

## Webhooks / Push Notifications

### Eventos Suportados

| Categoria | Eventos |
|-----------|---------|
| Pedidos | `order_status_update`, `new_order` |
| Produtos | `item_promotion_update`, `item_update` |
| Chat | `new_message`, `conversation_update` |

### Validação de Assinatura

```typescript
// Header: Authorization
// Body: JSON payload
const expectedSign = HMAC_SHA256(partner_key, url + payload);
if (receivedSign !== expectedSign) throw new Error('Invalid signature');
```

---

## Hosts/Ambientes

| Ambiente | Host |
|----------|------|
| Sandbox | `https://partner.test-stable.shopeemobile.com` |
| Produção | `https://partner.shopeemobile.com` |

---

## Funcionalidades

### MVP (Fase 1)
- [x] Conexão OAuth shop-level
- [x] Sincronização de pedidos
- [x] Webhook para notificações
- [ ] Renovação automática de tokens (cron job)

### Fase 2
- [ ] Gestão de catálogo (add_item, update_item)
- [ ] Upload de imagens/vídeos
- [ ] Sincronização de estoque

### Fase 3
- [ ] Sistema de mensagens (IM)
- [ ] Gestão de promoções/vouchers

---

## Considerações de Segurança

1. **Tokens nunca vão para o frontend** - Todas as chamadas passam por Edge Functions
2. **HMAC-SHA256 obrigatório** - Todas as requisições são assinadas
3. **RLS em marketplace_connections** - Isolamento por tenant_id
4. **Webhook validation** - Verificar assinatura antes de processar

---

## Pendências

- [ ] Implementar cron job para renovação de tokens
- [ ] Adicionar Shopee ao `platform-secrets-check` integration list
- [ ] Testes de fumaça: sandbox → produção
- [ ] Documentar limites de rate-limit por endpoint
