# Olist (Partners API) — Regras e Especificações

> **Status:** 🟢 Implementado  
> **Última atualização:** 2025-01-26

---

## Visão Geral

Integração OAuth2 com Olist Partners API para sincronização de pedidos de marketplaces.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/marketplaces/Olist.tsx` | Dashboard principal |
| `src/components/marketplaces/OlistConnectionCard.tsx` | Card de conexão OAuth |
| `src/hooks/useOlistConnection.ts` | Hook de status/OAuth |
| `supabase/functions/olist-oauth-start/` | Gera URL de autorização |
| `supabase/functions/olist-oauth-callback/` | Troca code por tokens |
| `supabase/functions/olist-token-refresh/` | Renovação automática |
| `supabase/functions/olist-connection-status/` | Status da conexão |
| `supabase/functions/olist-disconnect/` | Desconectar conta |

---

## Autenticação OAuth2

### Fluxo Completo

```
1. olist-oauth-start → Gera URL com state (tenant_id + user_id)
2. Popup abre → Usuário autoriza na Olist
3. Redirect para /integrations/olist/callback
4. olist-oauth-callback → Troca code por tokens
5. Salva em marketplace_connections
6. olist-token-refresh → Renovação automática
```

### Ambientes

| Ambiente | Auth URL | API URL |
|----------|----------|---------|
| **Sandbox** | `https://auth-engine.olist.com/realms/3rd-party-sandbox` | `https://partners-sandbox-api.olist.com/v1` |
| **Produção** | `https://id.olist.com` | `https://partners-api.olist.com/v1` |

### Tokens

| Token | Uso | Duração |
|-------|-----|---------|
| `access_token` | Renovação (OAuth2) | ~5 min |
| `refresh_token` | Obter novo access_token | ~30 dias |
| `id_token` | **Chamadas da API** (`Authorization: JWT {id_token}`) | ~5 min |

**IMPORTANTE:** As chamadas da Partners API usam `Authorization: JWT {id_token}`, NÃO Bearer token.

---

## Credenciais da Plataforma

| Secret | Descrição |
|--------|-----------|
| `OLIST_CLIENT_ID` | Client ID do app OAuth |
| `OLIST_CLIENT_SECRET` | Client Secret do app OAuth |

Gerenciado via `platform_credentials` ou env vars.

---

## Tabela: marketplace_connections

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenant_id` | UUID | FK para tenants |
| `marketplace` | TEXT | `olist` |
| `access_token` | TEXT | Token de renovação |
| `refresh_token` | TEXT | Token para refresh |
| `id_token` | TEXT | JWT para chamadas API |
| `external_user_id` | TEXT | Seller ID na Olist |
| `external_username` | TEXT | Nome/email do seller |
| `is_active` | BOOLEAN | Status da conexão |
| `expires_at` | TIMESTAMPTZ | Expiração do id_token |
| `metadata` | JSONB | `{ environment: "production" \| "sandbox" }` |

---

## Endpoints da Partners API

### Pedidos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/v1/seller-orders/` | Listar pedidos (com filtros) |
| GET | `/v1/seller-orders/{code}/` | Obter pedido por code |
| PATCH | `/v1/seller-orders/{code}/invoice/` | Enviar NF-e (URL do XML) |

### Parâmetros de Listagem

```
?status=approved,invoiced
?created_after=2025-01-01T00:00:00Z
?created_before=2025-01-31T23:59:59Z
```

---

## Envio de NF-e para Olist

### Endpoint

```
PATCH /v1/seller-orders/{code}/invoice/
Body: { "url": "https://storage.../invoice.xml" }
```

### Validações Obrigatórias

| Validação | Descrição |
|-----------|-----------|
| Modelo 55 | NF-e modelo 55 obrigatório |
| CNPJ Emissor | Deve bater com cadastro na Olist |
| CPF/CNPJ Destinatário | Deve bater com `payer` do pedido |
| Chave 44 dígitos | Chave de acesso válida |
| Não reutilizar chave | Cada pedido = chave única |
| Data/hora emissão | Após criação do pedido |

### Status do Pedido

| Status | Descrição |
|--------|-----------|
| `approved` | Pedido aprovado, aguardando NF |
| `invoice_processing` | NF enviada, em validação |
| `invoice_error` | Erro na validação da NF |
| `invoiced` | NF validada com sucesso |
| `shipped` | Pedido despachado |

---

## Webhooks (Notificações)

### Configuração

Registrar URL de webhook no painel Olist Partners.

### Payload

```json
{
  "topic": "seller_order_status_updated",
  "resource": "https://partners-api.olist.com/v1/seller-orders/ABC123/",
  "seller_id": "seller-uuid"
}
```

### Regras

| Regra | Descrição |
|-------|-----------|
| Response | HTTP 201 ("Notification received") |
| Retry | Timeout → retry em intervalos de 4h até 72h |
| Idempotência | Usar `resource` para buscar objeto completo |

---

## Regras de Implementação

### Proibições

| Proibido | Motivo |
|----------|--------|
| Campo de token manual | OAuth2 usa fluxo de autorização |
| `Authorization: Bearer` | Usar `Authorization: JWT {id_token}` |
| Ignorar refresh | Token expira em ~5 min |

### Obrigatório

| Regra | Descrição |
|-------|-----------|
| Popup OAuth | Usar `window.open()` para autorização |
| Armazenar id_token | É o token usado nas chamadas |
| Verificar expiração | Renovar antes de expirar |
| Validar state | Prevenir CSRF no callback |

---

## Integração com Nuvem Fiscal

Para emissão de NF-e, usar o módulo fiscal existente:

1. Emitir NF-e via Nuvem Fiscal (`POST /nfe`)
2. Baixar XML autorizado (`GET /nfe/{id}/xml`)
3. Armazenar no storage (gerar URL pre-signed)
4. Enviar URL para Olist (`PATCH /invoice/`)

Ver: `docs/regras/erp.md` para detalhes do módulo fiscal.

---

## Checklist de Implementação

- [x] OAuth2 com popup
- [x] Armazenar tokens (access, refresh, id_token)
- [x] Renovação automática de tokens
- [x] Status de conexão
- [ ] Sincronização de pedidos
- [ ] Webhook de notificações
- [ ] Envio de NF-e para Olist
- [ ] UI de pedidos Olist
