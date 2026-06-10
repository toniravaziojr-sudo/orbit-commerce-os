---
name: marketplaces-canonical-flow-standard
description: Mercado Livre é o golden path. Todo marketplace novo (Shopee, TikTok Shop, etc.) reusa o mesmo contrato — conexão, sync, PVs, fiscal, logística, atendimento, dashboard — sem divergir sem aprovação.
type: constraint
---

# Padrão Canônico de Marketplaces

## Regra
Mercado Livre é o **modelo de referência** para qualquer marketplace. Antes de implementar ou ajustar Shopee, TikTok Shop, ou marketplace novo, responder: *"como o ML faz hoje?"* e reusar o mesmo contrato.

## Itens invioláveis (todos os marketplaces)
1. Conexão OAuth em `marketplace_connections` (1 linha por `tenant_id + marketplace`); critério único de "ativo" = `is_active = true`.
2. Credenciais de app em `platform_credentials`, nunca no tenant.
3. Sync de pedidos grava cabeçalho + itens em `orders`/`order_items` com `marketplace_source`, `marketplace_order_id`, `marketplace_data`. Vínculo automático por SKU + fallback manual disparando `enqueue_fiscal_on_item_link`.
4. PVs convivem em `/orders` com **ícone de origem** (`OrderSourceBadge`) e **filtro "Origem"**. Proibido tela de pedidos separada por marketplace.
5. Esteira fiscal é única; completude de item bloqueia naturalmente.
6. Mensagens **sempre** no módulo Atendimento (`channel_type = '{marketplace}'`). Proibido aba de chat no hub do marketplace.
7. Hub `/marketplaces/{nome}` cuida só de conexão, listings, sync manual e diagnóstico — nunca duplica pedidos/mensagens/fiscal.
8. Dashboard ganha sub-aba quando `is_active = true`. Investimento em Ads do marketplace = "Em breve" até existir coleta oficial.
9. Roteamento logístico via `resolve_order_shipping_provider`. Logística do marketplace retorna `reason='marketplace'` e fica fora de `shipping_draft_queue`.
10. **Nunca fabricar dados do cliente**: campos vazios + `marketplace_data.data_pending = [campos]`.

## Onde diverge é permitido
Apenas: endpoint/assinatura/paginação da API, mapeamento de status nativo→canônico, estrutura de listings. Tudo o mais segue ML.

## Doc oficial
`docs/especificacoes/marketplaces/_padrao-canonico-marketplaces.md`
