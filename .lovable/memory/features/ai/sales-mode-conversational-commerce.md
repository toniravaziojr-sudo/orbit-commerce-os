---
name: Modo Vendas IA (Comércio Conversacional WhatsApp)
description: Toggle sales_mode_enabled no ai_support_config ativa agente vendedor com 15 tools (incl. send_product_image), get_product_details enriquecido (kit, variantes, peso/dim, imagem principal), validação de variantes/estoque, handoff comercial via tool, funil de vendas WhatsApp, conformidade janela 24h e rastreabilidade carrinho↔pedido.
type: feature
---

## Modo Vendas WhatsApp — estado final (Fase B concluída em 2026-04-22)

**Doc formal:** `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md` (Layer 3)

### Ativação
- Toggle: `ai_support_config.sales_mode_enabled` (boolean, default false)
- UI: aba "Vendas" no AIConfigPanel (`src/components/support/AIConfigPanel.tsx`)
- Quando ativo: `SALES_AGENT_PROMPT` + 15 tools, loop até 5 iterações

### Tools (15)
1. search_products — agora retorna primary_image (URL real de product_images), is_kit, has_variants
2. get_product_details — ENRIQUECIDO: descrição completa + short_description, brand, sku, gtin, preço/promo, físico (peso_g, w/h/d cm), primary_image, categories, variantes completas, kit_components (nome+qty), avg_rating
3. get_product_variants
4. recommend_related_products — agora busca primary_image em batch
5. check_coupon
6. check_customer_coupon_eligibility
7. add_to_cart
8. view_cart
9. remove_from_cart
10. apply_coupon
11. check_upsell_offers
12. generate_checkout_link
13. lookup_customer
14. request_human_handoff
15. **send_product_image (NOVA)** — envia imagem principal via WhatsApp (meta-whatsapp-send com image_url+caption). Anti-spam: 1 imagem por produto por conversa. Respeita janela 24h.

### Anti-regressão crítica (Fase B)
- Coluna `images` NÃO existe em `products`. Mídia vive em `product_images` (is_primary + sort_order). Qualquer SELECT que tente ler `products.images` retorna erro 42703 e levava a IA a handoff técnico indevido. Os 6 SELECTs afetados foram corrigidos para subquery em product_images.
- Composição de kit lê `product_components` (parent_product_id → component_product_id, quantity).
- Variantes lê `product_variants` (option1/2/3, price, stock_quantity, is_active, weight, image_url).

### Envio de imagem
- meta-whatsapp-send v1.3.0 aceita `image_url` + `image_caption` (type=image, link público).
- IA chama send_product_image quando: cliente pede foto, primeira apresentação do produto, antes de fechar compra.
- Servidor checa whatsapp_messages.message_type='image' com nome no content para bloquear duplicata.
- Janela 24h vale também para imagem livre (sem template).

### Handoff comercial (via tool)
- Casos válidos: wholesale_b2b, custom_negotiation, complaint, angry_customer, sensitive_data, technical_blocker.
- NUNCA para dúvida comum (preço, frete, prazo, cupom, produto do catálogo).
- Erro técnico de SQL inexistente NÃO é mais motivo (Fase B eliminou a causa raiz).

### Funil de Vendas WhatsApp
- View: `whatsapp_sales_funnel_view` (security_invoker=true).
- UI: aba "Funil WhatsApp" em `/support-center` → `src/components/support/WhatsappSalesFunnel.tsx`.

### Janela 24h (meta-whatsapp-send)
- Mensagem livre OU imagem livre (sem `template_name`) bloqueada se `last_customer_message_at > 24h`.
- Templates aprovados continuam permitidos fora da janela.

### Rastreabilidade
- conversations.id → whatsapp_carts.conversation_id → checkout_links.cart_id → orders (via trigger `link_whatsapp_cart_to_order`).

### Credenciais
- OPENAI_API_KEY via `getCredential()` em `_shared/platform-credentials.ts`.
