---
name: Mercado Livre — Sincronização bidirecional de anúncios
description: Cron de listagens ML reduzido para 1×/dia 05:00 BRT (exceção à grade fixa). Exclusão tenta close→delete incomplete. Sync inclui status, sub_status, preço, estoque, motivo. Refresh leve ao abrir aba.
type: feature
---

# Sincronização bidirecional de anúncios do Mercado Livre

## Regras

1. **Cron automático:** `meli-sync-listings-auto` roda **1×/dia às 05:00 BRT (08:00 UTC)** — exceção explícita à grade fixa 00/06/09/12/15/18/21 documentada em `external-panel-sync-fixed-grid`. Pedidos não dependem desse cron (chegam por webhook em tempo real).

2. **Refresh ao abrir a aba:** ao montar `MeliListingsTab`, dispara sync silencioso se `last_sync_at` está há mais de 10 min. Indicador "Sincronizado há X" visível no cabeçalho da aba.

3. **Botão Sincronizar:** puxa status, sub_status, preço, estoque, motivo de pausa de TODOS os anúncios já enviados ao ML (inclui status local `published`, `paused`, `publishing`, `error`).

4. **Exclusão 100% nos dois lados:**
   - Anúncio nunca enviado ao ML → remove localmente.
   - Anúncio `published`/`paused` → PUT `status=closed` no ML + remove localmente.
   - Anúncio `under_review`/`inactive`/nunca aprovado → tenta DELETE no item (some do painel ML como incompleto). Se ML recusar, avisa "removido aqui, mas pode continuar como incompleto no painel ML — exclua manualmente lá se necessário".

5. **Mapeamento de status ML → sistema:**
   - `active` → `published`
   - `paused` → `paused`
   - `under_review` → `publishing` + mensagem "Em revisão pelo Mercado Livre"
   - `inactive` → `paused` + sub_status detalhado
   - `closed` → `error` + motivo (deleted/expired/encerrado)

## Por quê

Lojista precisa ver o painel local refletindo o ML. Cron diário cobre mudanças feitas direto no painel ML (raras). Ações manuais (editar, pausar, excluir, sincronizar) continuam instantâneas em ambos os lados. Custo de processamento ~85% menor que a grade fixa anterior.

## Como aplicar

- Não mover esse cron para frequências menores sem aprovação — é exceção documentada à grade unificada.
- Pedidos do ML continuam por webhook (`meli-webhook`), nunca por cron.
- Não fechar exclusão silenciosamente: se DELETE incomplete falhar, comunicar ao lojista.
