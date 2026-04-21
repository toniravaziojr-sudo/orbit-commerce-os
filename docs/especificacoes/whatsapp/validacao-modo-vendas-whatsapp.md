# Roteiro de Validação Comercial — Modo Vendas WhatsApp

> **Tenant alvo:** `respeite-o-homem` (id `d1a4d0ed-8842-495e-b741-540a9a345b25`)
> **Fase:** 5 — encerramento de validação ponta a ponta
> **Doc funcional:** `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md`
> **Última revisão:** 2026-04-21

---

## 0. PRÉ-REQUISITOS

Antes de rodar qualquer cenário, confirmar:

- [ ] `ai_support_config.sales_mode_enabled = true` para o tenant.
- [ ] `whatsapp_configs.connection_status = 'connected'` e token válido.
- [ ] Pelo menos 1 produto **sem variantes** ativo no catálogo.
- [ ] Pelo menos 1 produto **com variantes** ativo no catálogo, com pelo menos 1 variante com estoque > 0.
- [ ] Telefone de teste com janela de 24h aberta (mensagem inbound recente).

Comando rápido de pré-checagem:
```sql
SELECT sales_mode_enabled FROM ai_support_config
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';

SELECT COUNT(*) FILTER (WHERE has_variants) AS com_variante,
       COUNT(*) FILTER (WHERE NOT has_variants) AS sem_variante
FROM products
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND status = 'active' AND deleted_at IS NULL;
```

---

## CENÁRIO 1 — Venda completa (produto SEM variante)

**Objetivo:** validar fluxo conversacional padrão até checkout.

**Passos do tester (humano simula cliente):**
1. Mandar pelo WhatsApp: *"Oi, quero ver o que vocês têm de bom"*.
2. Pedir detalhe de um produto sugerido.
3. Confirmar adicionar ao carrinho.
4. Aplicar um cupom válido (se existir).
5. Pedir o link de checkout.

**Critérios de aceite:**
- IA chama `search_products` e retorna produtos reais do catálogo (não inventa).
- IA chama `add_to_cart` sem perguntar variante (produto não tem).
- `whatsapp_carts` registra o item com `quantity`, `unit_price_cents` corretos.
- IA chama `generate_checkout_link` e devolve URL clicável.
- `checkout_links.source_conversation_id` aponta para a conversa.
- `whatsapp_sales_funnel_view` reflete +1 carrinho com itens no dia.

**Validação SQL:**
```sql
SELECT id, status, items, subtotal_cents
FROM whatsapp_carts
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
ORDER BY created_at DESC LIMIT 1;
```

---

## CENÁRIO 2 — Venda completa (produto COM variante)

**Objetivo:** validar a regra "perguntar opções antes de adicionar".

**Passos:**
1. Mandar: *"quero comprar [nome do produto com variantes]"*.
2. **Não** informar a variante de cara.
3. Após a IA listar opções, escolher uma.
4. Pedir adicionar ao carrinho.

**Critérios de aceite:**
- IA chama `get_product_variants` e apresenta as opções **antes** de adicionar.
- IA NÃO chama `add_to_cart` na primeira tentativa sem `variant_id`.
- Após confirmação, `whatsapp_carts.items` contém `variant_id`, `variant_label` e `sku`.
- Estoque da variante é validado (bloqueia se sem estoque + sem `allow_backorder`).

**Validação SQL:**
```sql
SELECT items
FROM whatsapp_carts
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
ORDER BY created_at DESC LIMIT 1;
-- Conferir que items[0] tem variant_id, variant_label, sku preenchidos.
```

---

## CENÁRIO 3 — Recomendação cruzada

**Objetivo:** validar `recommend_related_products`.

**Passos:**
1. Após adicionar um produto, perguntar: *"o que combina com isso?"*.

**Critérios de aceite:**
- IA chama `recommend_related_products`.
- Recomendação vem do catálogo real (não inventa).
- Cliente pode adicionar o sugerido sem reiniciar o fluxo.

---

## CENÁRIO 4 — Handoff comercial (atacado)

**Objetivo:** validar handoff via tool, criação de ticket e travamento em `waiting_agent`.

**Passos:**
1. Mandar: *"Tenho uma loja, queria comprar 200 unidades, fazem desconto de atacado?"*.

**Critérios de aceite:**
- IA chama `request_human_handoff` com `reason='wholesale_b2b'`.
- Cria 1 registro em `support_tickets` com `category='sales'`, `metadata.source='whatsapp_sales'`, `metadata.handoff_reason='wholesale_b2b'`.
- `conversations.status = 'waiting_agent'` **e permanece** assim no próximo turno (não volta para `bot`).
- Funil registra +1 em `carts_handoff` no dia (mesmo se não havia carrinho ativo).

**Validação SQL:**
```sql
-- Ticket
SELECT id, category, status, priority,
       metadata->>'handoff_reason' AS reason,
       metadata->>'source' AS source
FROM support_tickets
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND category = 'sales'
ORDER BY created_at DESC LIMIT 1;

-- Status da conversa
SELECT id, status, updated_at
FROM conversations
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND channel_type = 'whatsapp'
ORDER BY updated_at DESC LIMIT 1;
-- Esperado: status = 'waiting_agent'

-- Funil
SELECT day, carts_handoff
FROM whatsapp_sales_funnel_view
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND day = current_date;
```

---

## CENÁRIO 5 — Janela de 24h

**Objetivo:** validar que mensagem livre fora da janela é bloqueada com `OUTSIDE_24H_WINDOW`.

**Passo (curl direto na edge function):**
```bash
curl -sS -X POST \
  "https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/meta-whatsapp-send" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "d1a4d0ed-8842-495e-b741-540a9a345b25",
    "phone": "<telefone com last_customer_message_at > 24h>",
    "message": "Teste fora da janela"
  }'
```

**Critérios de aceite:**
- HTTP 200 com payload:
  ```json
  {
    "success": false,
    "error": "Fora da janela de 24h do WhatsApp. Use um template aprovado para reabrir a conversa.",
    "code": "OUTSIDE_24H_WINDOW",
    "last_customer_message_at": "<timestamp>"
  }
  ```
- `whatsapp_messages` registra a tentativa com `status='failed'`.
- Mesmo telefone, mas com `template_name` informado, deve permitir o envio.

**Status atual:** ✅ já validado em produção em 2026-04-21 (telefone `5518996579731`).

---

## CENÁRIO 6 — UI do Funil

**Objetivo:** validar a tela.

**Passos:**
1. Logar como tenant `respeite-o-homem`.
2. Acessar `/support-center` → aba **Funil WhatsApp**.

**Critérios de aceite:**
- 6 cards visíveis: Carrinhos, Convertidos, Handoffs, Pedidos, Receita, Taxa de conversão.
- Tabela diária dos últimos 30 dias coerente com a query SQL da view.
- Sem erros no console.

---

## CHECKLIST DE FECHAMENTO

| Cenário | Status esperado após execução |
|---------|-------------------------------|
| 1 — Venda sem variante | ✅ Carrinho + checkout + funil |
| 2 — Venda com variante | ✅ IA pergunta opção, grava `variant_id`/`label`/`sku` |
| 3 — Recomendação cruzada | ✅ Tool real chamada |
| 4 — Handoff atacado | ✅ Ticket + `waiting_agent` mantido + funil |
| 5 — Janela 24h | ✅ `OUTSIDE_24H_WINDOW` |
| 6 — UI Funil | ✅ Cards e tabela coerentes |

Quando todos os 6 cenários estiverem ✅, a Fase 5 está **comercialmente validada ponta a ponta**.
