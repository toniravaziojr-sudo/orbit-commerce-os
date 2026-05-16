---
name: external-panel-sync-fixed-grid
description: Sincronizações periódicas de painéis externos (anúncios e marketplaces) usam grade horária fixa 00/06/09/12/15/18/21 UTC; mudar exige aprovação explícita
type: constraint
---

# Grade horária unificada para sincronizações de painéis externos

Crons que puxam dados de painéis de terceiros (anúncios Meta+Google, anúncios/estoque de marketplaces como Mercado Livre, Shopee, TikTok Shop) DEVEM rodar na grade fixa:

`0 0,6,9,12,15,18,21 * * *` (UTC)

7 execuções por dia: **00h, 06h, 09h, 12h, 15h, 18h, 21h**. De madrugada (00h01 → 05h59) NÃO há execução — apenas a janela das 6h cobre o turno noturno.

## Crons atualmente nesta grade

- `sync-ads-dashboard-daily-15min` (Meta Ads + Google Ads) — antes: 1×/hora.
- `meli-sync-listings-auto` (Mercado Livre listings/stock) — antes: 2×/2h.

Novos sincronismos de marketplace (Shopee, TikTok Shop, etc.) que sigam o mesmo padrão de "puxar painel de terceiros" devem adotar esta grade por padrão.

## O que NÃO entra nesta grade

- **Webhooks** (pedidos do Mercado Livre, gateways de pagamento, WhatsApp): são tempo real, não passam por cron.
- **Refresh de token Meta** (`meta-token-refresh-daily` / health check): mantém 1×/dia às 3h — não é "sincronização de painel".
- **Crons críticos** (notificações, orquestrador WhatsApp, expiração de pedidos): mantêm suas frequências curtas.

## Why

Painéis externos não precisam de atualização horária — lojistas consultam algumas vezes por dia. Rodar 24×/dia era desperdício de Cloud + chamadas externas. Madrugada (00h–06h) tem zero consulta de lojista no Brasil; uma única passada às 6h é suficiente para que o painel chegue atualizado no início do expediente.

Mudar essa grade (encurtar, alongar, adicionar horário) afeta percepção de frescor do lojista e custo de Cloud — exige aprovação explícita do usuário antes de aplicar.

## How to apply

- Code review bloqueia PR que crie cron novo de sincronização de painel externo com frequência diferente desta grade sem justificativa documentada.
- Ao adicionar nova integração de marketplace ou painel de anúncios, copiar o `schedule` exato `0 0,6,9,12,15,18,21 * * *` do cron existente.
- Referência canônica do padrão: `docs/especificacoes/plataforma/recursos-em-uso-e-crons-adormecidos.md` (seção "Grade horária unificada").
