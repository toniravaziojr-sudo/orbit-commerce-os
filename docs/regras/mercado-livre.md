# Mercado Livre — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2025-01-19

---

## Visão Geral

Integração OAuth com Mercado Livre para sincronização de pedidos e atendimento.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/marketplaces/MercadoLivre.tsx` | Dashboard |
| `src/pages/MeliOAuthCallback.tsx` | Proxy page para callback OAuth (captura code/state e redireciona para edge function) |
| `src/hooks/useMeliConnection.ts` | Status/OAuth |
| `src/hooks/useMeliOrders.ts` | Pedidos |
| `supabase/functions/meli-oauth-*` | Fluxo OAuth |
| `supabase/functions/meli-webhook/` | Notificações |

## Fluxo OAuth

```
1. meli-oauth-start → URL de autorização
2. Popup para ML
3. ML redireciona para /integrations/meli/callback (MeliOAuthCallback.tsx)
4. MeliOAuthCallback captura code/state e redireciona para edge function meli-oauth-callback
5. meli-oauth-callback (edge function) → Troca code por tokens e salva no banco
6. Redireciona de volta para /marketplaces com status
7. meli-token-refresh → Renovação automática
```

## Rota Frontend

- **Path:** `/integrations/meli/callback`
- **Componente:** `MeliOAuthCallback`
- **Registrada em:** `src/App.tsx`
- **Função:** Proxy entre o redirect do ML e a edge function. Necessária porque o ML redireciona para o domínio do app, não diretamente para a edge function.

## Regra: Atendimento

> Mensagens do ML vão para módulo **Atendimento** (`channel_type='mercadolivre'`).
> **Proibido:** Manter aba de mensagens no marketplace.

## Tabela: marketplace_connections

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tenant_id` | UUID | FK |
| `marketplace` | TEXT | `mercadolivre` |
| `access_token` | TEXT | Token atual |
| `refresh_token` | TEXT | Renovação |
| `external_user_id` | TEXT | ID ML |
| `is_active` | BOOLEAN | Status |
