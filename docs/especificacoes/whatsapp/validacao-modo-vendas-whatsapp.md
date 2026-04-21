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
- [ ] Tabelas `tenant_learning_events` e `tenant_learning_memory` existem (Fase 1 da Memória de Aprendizado deployada).

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

## CHECKLIST TRANSVERSAL — MEMÓRIA DE APRENDIZADO POR TENANT (Fase 1)

> **Aplicar este bloco em TODOS os cenários acima (1 a 6).**
> A Memória de Aprendizado é uma camada nativa que captura padrões automaticamente. A validação não é um cenário separado: é uma checagem extra que roda em paralelo a cada teste real.

### O que validar em cada cenário

Após executar o cenário (Cenário 1, 2, 3, 4...), rodar a validação abaixo **antes** de declarar o cenário ✅:

#### A. Captura do evento bruto (`tenant_learning_events`)

```sql
SELECT id, event_type, weight, conversation_id,
       LEFT(customer_message, 80) AS msg,
       LEFT(ai_response, 80) AS resp,
       created_at
FROM tenant_learning_events
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND created_at >= now() - interval '15 minutes'
ORDER BY created_at DESC;
```

**Critério:** o `event_type` esperado para o cenário deve aparecer.

| Cenário | Evento esperado | Peso |
|---------|----------------|------|
| 1 — Venda sem variante | `cart_created` (+5), `checkout_generated` (+10), `continuity` (+1) por turno | — |
| 2 — Venda com variante | igual ao 1, mas com `metadata.has_variant = true` | — |
| 3 — Recomendação cruzada | `continuity` (+1) por turno; `cart_created` se aceita | — |
| 4 — Handoff atacado | `handoff_success` (+8) | — |
| 5 — Janela 24h | nenhum evento de aprendizado (mensagem falhou antes) | — |
| 6 — UI Funil | nenhum evento (só leitura) | — |

#### B. Agregação para `tenant_learning_memory`

A agregação roda via cron `ai-learning-aggregator-6h`. Para validar imediatamente, disparar manualmente:

```bash
curl -sS -X POST \
  "https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/ai-learning-aggregator" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "d1a4d0ed-8842-495e-b741-540a9a345b25"}'
```

Depois conferir:
```sql
SELECT id, learning_type, status,
       LEFT(pattern_text, 80) AS pattern,
       LEFT(response_text, 80) AS response,
       success_score, evidence_count,
       category_sensitivity, created_at, updated_at
FROM tenant_learning_memory
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
ORDER BY updated_at DESC
LIMIT 10;
```

#### C. Critérios de aceite por linha encontrada

Para cada registro novo em `tenant_learning_memory`:

- [ ] **`learning_type`** está em `('faq','objection','winning_response')` (Fase 1 só aceita esses 3).
- [ ] **`success_score`** > 0 e coerente (não inflado por evento único).
- [ ] **`evidence_count`** ≥ 3 se `status='active'`. Se < 3, deve estar em `pending_review` ou ainda não promovido.
- [ ] **`status`**:
  - `safe` + score ≥ 70 → `active`
  - `commercial` + score ≥ 85 → `active`
  - `sensitive` ou abaixo do limite → `pending_review`
- [ ] **Guardrails**: `pattern_text` e `response_text` NÃO podem conter:
  - preço numérico (R$, %, "reais")
  - claims ("garantido", "cura", "100%", "milagroso")
  - promessa de prazo específico
  - dados pessoais (CPF, CNPJ, telefone)

  Validar com:
  ```sql
  SELECT id, learning_type, pattern_text, response_text
  FROM tenant_learning_memory
  WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
    AND status = 'active'
    AND (
      pattern_text ~* '(r\$|garantid|100%|cura|milagr|cpf|cnpj)'
      OR response_text ~* '(r\$|garantid|100%|cura|milagr|cpf|cnpj)'
    );
  ```
  **Esperado: 0 linhas.** Qualquer linha aqui é falha de guardrail crítica.

#### D. Influência no `ai-support-chat` (a partir do 2º cenário relevante)

Após pelo menos 1 aprendizado `status='active'` existir, executar novamente um cenário equivalente (ex: repetir Cenário 1 com mensagem similar à que gerou o aprendizado). Validar:

- [ ] Resposta da IA referencia/aproxima do `response_text` aprendido (sem copiar literal).
- [ ] `tenant_learning_memory.usage_count` incrementou para o registro relevante:
  ```sql
  SELECT id, learning_type, usage_count, last_used_at
  FROM tenant_learning_memory
  WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
    AND status = 'active'
  ORDER BY last_used_at DESC NULLS LAST
  LIMIT 5;
  ```

#### E. Isolamento por tenant (anti-vazamento)

Após qualquer cenário, confirmar que NENHUM evento ou aprendizado vazou para outro tenant:
```sql
SELECT tenant_id, COUNT(*)
FROM tenant_learning_events
WHERE created_at >= now() - interval '1 hour'
GROUP BY tenant_id;
```
**Esperado:** apenas o tenant `d1a4d0ed-8842-495e-b741-540a9a345b25`.

---

## CHECKLIST DE FECHAMENTO

| Cenário | Status esperado após execução | Memória de Aprendizado (transversal) |
|---------|-------------------------------|--------------------------------------|
| 1 — Venda sem variante | ✅ Carrinho + checkout + funil | ✅ Eventos `cart_created` + `checkout_generated` capturados |
| 2 — Venda com variante | ✅ IA pergunta opção, grava `variant_id`/`label`/`sku` | ✅ Eventos capturados com metadata variante |
| 3 — Recomendação cruzada | ✅ Tool real chamada | ✅ Eventos `continuity` + (se aceita) `cart_created` |
| 4 — Handoff atacado | ✅ Ticket + `waiting_agent` mantido + funil | ✅ Evento `handoff_success` capturado |
| 5 — Janela 24h | ✅ `OUTSIDE_24H_WINDOW` | ✅ Nenhum evento de aprendizado gerado |
| 6 — UI Funil | ✅ Cards e tabela coerentes | ✅ Nenhum evento (só leitura) |

**Validações finais transversais (após executar todos os cenários):**

- [ ] Agregação manual rodada com sucesso.
- [ ] Pelo menos 1 registro em `tenant_learning_memory` com `learning_type` válido.
- [ ] Nenhum aprendizado `active` viola guardrails (query D retorna 0 linhas).
- [ ] Nenhum vazamento entre tenants (query E mostra só o tenant testado).
- [ ] Se houve repetição de cenário, `usage_count` incrementou.

Quando todos os 6 cenários estiverem ✅ **e** as 5 validações transversais da Memória de Aprendizado passarem, a Fase 5 + Fase 1 da Memória estão **comercialmente validadas ponta a ponta**.
