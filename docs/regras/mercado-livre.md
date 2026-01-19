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
| `src/hooks/useMeliConnection.ts` | Status/OAuth |
| `src/hooks/useMeliOrders.ts` | Pedidos |
| `supabase/functions/meli-oauth-*` | Fluxo OAuth |
| `supabase/functions/meli-webhook/` | Notificações |

## Fluxo OAuth

```
1. meli-oauth-start → URL de autorização
2. Popup para ML
3. meli-oauth-callback → Salva tokens
4. meli-token-refresh → Renovação automática
```

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
