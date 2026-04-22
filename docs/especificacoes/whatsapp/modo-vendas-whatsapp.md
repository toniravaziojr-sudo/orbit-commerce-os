# Modo Vendas WhatsApp — Comércio Conversacional

> **Camada:** Layer 3 — Especificação Funcional do Módulo
> **Status:** Ativo (Fase 5 concluída e validada — 2026-04-21)
> **Módulo pai:** AI Support / WhatsApp
> **Fonte de verdade para:** comportamento da IA em modo vendas, regras de variantes/estoque, handoff comercial, funil de vendas WhatsApp, conformidade da janela de 24h, rastreabilidade carrinho ↔ pedido.

---

## 1. PROPÓSITO

O **Modo Vendas WhatsApp** transforma o agente de IA do módulo de Suporte em um vendedor conversacional capaz de conduzir uma venda completa pelo WhatsApp do tenant, usando o catálogo, cupons, frete e checkout reais — sem improvisar dados.

Quando ativo:
- A IA recomenda produtos reais do catálogo do tenant.
- Adiciona itens ao carrinho com validação de variante e estoque.
- Coleta dados do cliente progressivamente.
- Gera link de checkout pré-preenchido vinculado à conversa.
- Escala para vendedor humano em casos comerciais que exigem decisão fora da política.
- Respeita a janela de 24h da Meta (WhatsApp Business API).

---

## 2. ATIVAÇÃO

| Item | Valor |
|------|-------|
| Toggle | `ai_support_config.sales_mode_enabled` (boolean, default `false`) |
| UI de configuração | Aba "Vendas" em `/support-center` → AI Config Panel |
| Escopo | Por tenant |
| Substituição de prompt | Quando ativo, `SALES_AGENT_PROMPT` substitui `INFORMATIVE_GUARDRAILS` |
| Tools injetadas | 12 tools de OpenAI Function Calling (ver §3) |
| Iterações máximas | 5 loops de tool-call por turno |

---

## 3. FERRAMENTAS DA IA (TOOLS)

| # | Tool | Função |
|---|------|--------|
| 1 | `search_products` | Busca produtos por nome/categoria (com normalização de query e fallback tokenizado) |
| 2 | `get_product_details` | Detalhes do produto + resumo de variantes |
| 3 | `get_product_variants` | Lista todas as variantes de um produto |
| 4 | `recommend_related_products` | Recomendação cruzada |
| 5 | `check_coupon` | Valida cupom |
| 6 | `check_customer_coupon_eligibility` | Verifica se o cliente já usou |
| 7 | `add_to_cart` | Adiciona item validando variante, estoque e `allow_backorder` |
| 8 | `view_cart` | Mostra carrinho atual |
| 9 | `remove_from_cart` | Remove item |
| 10 | `apply_coupon` | Aplica cupom ao carrinho |
| 11 | `check_upsell_offers` | Consulta `offer_rules` ativas |
| 12 | `generate_checkout_link` | Cria `checkout_links` com dados pré-preenchidos e grava `source_conversation_id` |
| 13 | `lookup_customer` | Consulta cadastro existente |
| 14 | `request_human_handoff` | Cria ticket de venda e move conversa para `waiting_agent` |

`add_to_cart` aceita tanto `product_id` (UUID) quanto `slug` para evitar erro de "produto não encontrado" quando a IA referencia o item pelo slug do contexto.

---

## 4. REGRAS DE VARIANTES E ESTOQUE

**Regra central:** se o produto tem `has_variants = true`, a IA **NÃO PODE** chamar `add_to_cart` sem `variant_id`. Ela deve primeiro perguntar a opção ao cliente.

| Situação | Comportamento esperado |
|----------|------------------------|
| Produto sem variantes | Adiciona direto ao carrinho |
| Produto com variantes (sem `variant_id` informado) | IA chama `get_product_variants` e pergunta opções ao cliente antes de adicionar |
| Variante sem estoque + `manage_stock=true` + `allow_backorder=false` | Bloqueia adição com mensagem clara |
| Variante sem estoque + `allow_backorder=true` | Permite adição com aviso |
| Item adicionado | Grava `variant_id`, `variant_label` e `sku` no carrinho |

---

## 5. HANDOFF COMERCIAL

A IA deve chamar `request_human_handoff` **apenas** quando o caso fugir do que ela consegue resolver com as outras tools.

### 5.1 Casos válidos para handoff
- Pedido de atacado / B2B / quantidade muito acima do varejo (`reason="wholesale_b2b"`)
- Negociação de preço/condição fora dos cupons disponíveis (`reason="custom_negotiation"`)
- Reclamação grave ou cliente irritado (`reason="complaint"` / `angry_customer"`)
- Dado sensível ou pedido fora do escopo (`reason="sensitive_data"`)
- Erro técnico repetido / ferramenta indisponível (`reason="technical_blocker"`)

### 5.2 Casos que NUNCA são handoff
- Dúvida comum sobre produto, preço, frete, prazo ou cupom (use as tools)
- Cliente pedindo um produto que existe no catálogo (use `search_products`)
- Pergunta sobre variantes (use `get_product_variants`)

### 5.3 Efeito no sistema (atômico)
Quando `request_human_handoff` é executada com sucesso:

1. Cria registro em `support_tickets` com:
   - `category = 'sales'`
   - `priority = 'high'` se for `angry_customer`/`complaint`, senão `'normal'`
   - `source_conversation_id` = conversa atual
   - `metadata.source = 'whatsapp_sales'`
   - `metadata.cart` = snapshot do carrinho (se existir)
2. Se houver carrinho ativo, marca `whatsapp_carts.status = 'handoff'` + grava `handoff_ticket_id`.
3. Atualiza `conversations.status = 'waiting_agent'`.
4. **Garantia anti-regressão:** o flag `shouldHandoff` é forçado para `true` no loop final, impedindo que o status seja revertido para `'bot'` por outras heurísticas. *(Correção aplicada em 2026-04-21.)*

---

## 6. FUNIL DE VENDAS WHATSAPP

### 6.1 View `whatsapp_sales_funnel_view`
Agregação diária por tenant com:

| Coluna | Significado |
|--------|-------------|
| `total_carts` | Total de carrinhos criados no dia |
| `carts_with_items` | Carrinhos com pelo menos 1 item |
| `carts_converted` | Carrinhos com `status = 'converted'` (link de checkout gerado) |
| `carts_handoff` | Soma de carrinhos com `status='handoff'` + tickets de venda **sem carrinho associado** |
| `orders_generated` | Pedidos efetivamente criados |
| `revenue` | Receita dos pedidos confirmados |

**Anti-regressão (2026-04-21):** a view é construída com `FULL OUTER JOIN` entre `whatsapp_carts` e `support_tickets` para garantir que handoffs comerciais sem carrinho ativo (ex.: cliente entra direto pedindo atacado) também apareçam no funil. A dedupe é feita por `support_tickets.id` que não esteja referenciado em `whatsapp_carts.handoff_ticket_id`.

### 6.2 UI
- Componente: `src/components/support/WhatsappSalesFunnel.tsx`
- Localização: aba **"Funil WhatsApp"** dentro de `/support-center`
- Cards: Carrinhos, Convertidos, Handoffs, Pedidos, Receita, Taxa de conversão
- Tabela diária dos últimos 30 dias

---

## 7. JANELA DE 24H DO WHATSAPP

A Meta exige que mensagens livres (sem template aprovado) só sejam enviadas se o cliente tiver mandado mensagem nas últimas 24h. O envio é bloqueado em `meta-whatsapp-send`.

### Fluxo de auditoria
1. Antes de enviar, busca `conversations.last_customer_message_at` mais recente para o telefone.
2. Calcula `ageMs = now() - last_customer_message_at`.
3. Se `ageMs > 24h` **e** o envio é livre (sem `template_name`):
   - Bloqueia o envio.
   - Grava registro `whatsapp_messages` com `status='failed'`.
   - Retorna HTTP 200 com payload:
     ```json
     {
       "success": false,
       "error": "Fora da janela de 24h do WhatsApp. Use um template aprovado para reabrir a conversa.",
       "code": "OUTSIDE_24H_WINDOW",
       "last_customer_message_at": "<timestamp>"
     }
     ```
4. **Templates aprovados continuam permitidos fora da janela** (caminho `template_name` ignora a checagem).

---

## 8. RASTREABILIDADE CARRINHO ↔ CHECKOUT ↔ PEDIDO ↔ CONVERSA

| Origem | Campo de ligação | Destino |
|--------|------------------|---------|
| `conversations.id` | `whatsapp_carts.conversation_id` | carrinho |
| `whatsapp_carts.id` | `checkout_links.cart_id` (quando gerado) | link de checkout |
| `checkout_links.source_conversation_id` | `conversations.id` | volta à conversa |
| `orders.checkout_link_id` ou `orders.metadata.source_conversation_id` | `conversations.id` | pedido vinculado |
| Trigger `link_whatsapp_cart_to_order` | atualiza `whatsapp_carts.order_id` + `status='converted'` | fecha o ciclo |

---

## 9. CONTROLE DE ACESSO E SEGURANÇA

- `whatsapp_carts`: RLS tenant-scoped + `service_role` full access.
- `support_tickets`: RLS tenant-scoped.
- `whatsapp_sales_funnel_view`: `security_invoker = true` (respeita RLS do usuário).
- Credenciais (OPENAI_API_KEY) lidas via `getCredential()` em `_shared/platform-credentials.ts`.

---

## 10. HISTÓRICO DE VERSÕES

| Data | Versão | Mudança |
|------|--------|---------|
| 2026-04-21 | v1.0 | Fase 5 concluída: variantes/estoque, handoff via tool, funil, janela 24h, rastreabilidade. |
| 2026-04-21 | v1.0.1 | Anti-regressão: handoff via tool força `waiting_agent`; funil inclui handoffs sem carrinho. |

---

## 11. REFERÊNCIAS CRUZADAS

- `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md` — recepção Meta v2.
- `docs/REGRAS-DO-SISTEMA.md` — regras macro do sistema.
- `mem://features/ai/sales-mode-conversational-commerce` — memória operacional resumida.
- `mem://infrastructure/whatsapp-meta-integration-standard-v3-2` — padrão UI/arquitetura WhatsApp.
| 2026-04-22 | v1.1 | Fase B (Pipeline básica de produto): get_product_details enriquecido (descrição completa, peso/dim, kit_components, primary_image, categorias, variantes); search_products com primary_image+is_kit; recommend_related_products usa product_images em batch; nova tool send_product_image (1/produto/conversa); meta-whatsapp-send v1.3.0 aceita image_url+caption respeitando janela 24h; correção de causa raiz: 6 SELECTs liam coluna `images` inexistente em products (erro 42703 → handoff técnico indevido). |
