---
name: Modo Vendas IA (Comércio Conversacional WhatsApp)
description: Toggle sales_mode_enabled no ai_support_config ativa agente vendedor com 14 tools, validação de variantes/estoque, handoff comercial via tool (cria ticket + mantém waiting_agent), funil de vendas WhatsApp, conformidade janela 24h e rastreabilidade carrinho↔pedido.
type: feature
---

## Modo Vendas WhatsApp — estado final (Fase 5 concluída em 2026-04-21)

**Doc formal:** `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md` (Layer 3)

### Ativação
- Toggle: `ai_support_config.sales_mode_enabled` (boolean, default false)
- UI: aba "Vendas" no AIConfigPanel (`src/components/support/AIConfigPanel.tsx`)
- Quando ativo: `SALES_AGENT_PROMPT` + 14 tools, loop até 5 iterações

### Tools (14)
1. search_products (com normalização de query + fallback tokenizado, kits incluídos)
2. get_product_details (com resumo de variantes)
3. get_product_variants
4. recommend_related_products
5. check_coupon
6. check_customer_coupon_eligibility
7. add_to_cart (aceita UUID ou slug, valida variante/estoque/allow_backorder, grava variant_id, variant_label, sku)
8. view_cart
9. remove_from_cart
10. apply_coupon
11. check_upsell_offers
12. generate_checkout_link (grava source_conversation_id)
13. lookup_customer
14. request_human_handoff (cria ticket + força waiting_agent)

### Regra de variantes
- Se `has_variants=true`, IA OBRIGATORIAMENTE pergunta opções antes de adicionar.
- Estoque: respeita `manage_stock` + `allow_backorder` no nível da variante.

### Handoff comercial (via tool)
- Casos válidos: wholesale_b2b, custom_negotiation, complaint, angry_customer, sensitive_data, technical_blocker.
- NUNCA para dúvida comum (preço, frete, prazo, cupom, produto do catálogo).
- Efeito atômico: cria `support_tickets` (category=sales, metadata.source=whatsapp_sales) + marca `whatsapp_carts.status='handoff'` (se houver) + `conversations.status='waiting_agent'`.
- **Anti-regressão:** loop final força `shouldHandoff=true` quando a tool foi chamada com sucesso, impedindo reverter status para `bot`.

### Funil de Vendas WhatsApp
- View: `whatsapp_sales_funnel_view` (security_invoker=true, agregação diária por tenant).
- **Anti-regressão:** FULL OUTER JOIN com `support_tickets` para incluir handoffs comerciais SEM carrinho associado (dedupe por `handoff_ticket_id`).
- UI: aba "Funil WhatsApp" em `/support-center` → `src/components/support/WhatsappSalesFunnel.tsx`.

### Janela 24h (meta-whatsapp-send)
- Mensagem livre (sem `template_name`) bloqueada se `last_customer_message_at > 24h`.
- Retorno: HTTP 200 com `{success:false, code:'OUTSIDE_24H_WINDOW', last_customer_message_at}`.
- Templates aprovados continuam permitidos fora da janela.

### Rastreabilidade
- conversations.id → whatsapp_carts.conversation_id → checkout_links.cart_id → orders (via trigger `link_whatsapp_cart_to_order`).
- `checkout_links.source_conversation_id` fecha o ciclo de volta à conversa.
- Trigger atualiza `whatsapp_carts.order_id` + `status='converted'` quando o pedido é criado.

### Tabela whatsapp_carts
- conversation_id, items (JSONB com variant_id/variant_label/sku), customer_data (JSONB progressivo), subtotal_cents, coupon_code.
- Status: active → converted | handoff | abandoned. Expira em 24h.
- Campos de handoff: `status='handoff'`, `handoff_reason`, `handoff_ticket_id`.

### Credenciais
- OPENAI_API_KEY via `getCredential()` em `_shared/platform-credentials.ts` (prioriza tabela `platform_credentials`, fallback env var).
