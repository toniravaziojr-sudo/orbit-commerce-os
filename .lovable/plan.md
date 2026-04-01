

# Relatório Factual — Estado Atual dos Triggers, Funções e Nomes Canônicos

---

## 1. DEFINIÇÕES SQL ATUAIS

### 1.1 `trg_auto_tag_cliente_on_payment` → `auto_tag_cliente_on_payment_approved()`

**Status: ATIVO (enabled = O)**

**Trigger:**
```text
AFTER INSERT OR UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION auto_tag_cliente_on_payment_approved()
```

**Função (código real do banco):**
```sql
IF NEW.payment_status = 'approved' AND (OLD.payment_status IS NULL OR OLD.payment_status <> 'approved') THEN
  v_customer_id := NEW.customer_id;
  IF v_customer_id IS NULL THEN RETURN NEW; END IF;

  -- Busca ou cria tag "Cliente"
  SELECT id INTO v_cliente_tag_id FROM customer_tags
    WHERE tenant_id = NEW.tenant_id AND name = 'Cliente' LIMIT 1;

  IF v_cliente_tag_id IS NULL THEN
    INSERT INTO customer_tags (tenant_id, name, color, description)
    VALUES (NEW.tenant_id, 'Cliente', '#10B981', 'Clientes com pedido aprovado')
    RETURNING id INTO v_cliente_tag_id;
  END IF;

  -- Adiciona tag sem deletar as existentes
  INSERT INTO customer_tag_assignments (customer_id, tag_id)
  VALUES (v_customer_id, v_cliente_tag_id)
  ON CONFLICT (customer_id, tag_id) DO NOTHING;
END IF;
```

**Conclusão factual:**
- Checa `'approved'` (NÃO `'paid'`)
- NÃO contém lógica destrutiva (usa `ON CONFLICT DO NOTHING`, sem DELETE)
- Está ativo e funcional
- **O diagnóstico do plano anterior estava errado.** A afirmação de que checava `'paid'` e continha DELETE era incorreta.

---

### 1.2 `trg_recalc_customer_metrics_on_order` → `trg_recalc_customer_on_order()`

**Status: ATIVO (enabled = O)**

**Trigger:**
```text
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION trg_recalc_customer_on_order()
```

**Função (do banco — já listada no schema):**
```sql
IF NEW.payment_status = 'approved' AND (OLD IS NULL OR OLD.payment_status IS DISTINCT FROM 'approved') THEN
  PERFORM public.recalc_customer_metrics(NEW.tenant_id, NEW.customer_email);

  PERFORM public.sync_subscriber_to_customer_with_tag(
    NEW.tenant_id, NEW.customer_email, NEW.customer_name, NEW.customer_phone,
    NULL, 'order',
    (SELECT l.id FROM email_marketing_lists l
     JOIN customer_tags t ON l.tag_id = t.id
     WHERE l.tenant_id = NEW.tenant_id AND t.name = 'Cliente' LIMIT 1)
  );
END IF;
```

**Problemas identificados:**
- Chama `sync_subscriber_to_customer_with_tag` que **cria customer** se não existir — isso é redundante com o que o checkout já faz, e também é o caminho que faz lead virar customer (violação do contrato).
- A atribuição da tag depende de encontrar uma lista com tag "Cliente". Se a lista não existir, `p_list_id` é NULL e a tag NÃO é atribuída. Isso viola o contrato de desacoplamento.
- Porém, `trg_auto_tag_cliente_on_payment` (1.1) já cuida da tag de forma independente. Portanto há **redundância**: a tag é atribuída por dois caminhos.

---

### 1.3 `trigger_update_customer_first_order` → `update_customer_first_order()`

**Status: ATIVO (enabled = O)**

**Trigger:**
```text
AFTER INSERT ON public.orders
FOR EACH ROW WHEN (new.customer_id IS NOT NULL)
EXECUTE FUNCTION update_customer_first_order()
```

**Função (do banco):**
```sql
UPDATE public.customers SET
  first_order_at = COALESCE(first_order_at, NEW.created_at),
  last_order_at = NEW.created_at,
  total_orders = COALESCE(total_orders, 0) + 1
WHERE id = NEW.customer_id;
```

**Problema confirmado:** Incrementa `total_orders` em TODO INSERT (independente de status de pagamento). Conflita com `recalc_customer_metrics` que recalcula apenas pedidos aprovados com total > 0.

---

### 1.4 `sync_subscriber_to_customer_with_tag()`

**Código completo já no schema acima. Resumo do comportamento:**
- Busca subscriber por email → se não existe, **cria**
- Busca customer por email → se não existe, **cria** ← **violação do contrato** (lead não deve virar customer)
- Se `p_list_id` informado → adiciona em list_members e atribui tag da lista ao customer

---

## 2. NOMES CANÔNICOS CONFIRMADOS

| Conceito | Nome no banco | ID (tenant respeiteohomem) |
|---|---|---|
| Tag sistêmica | `Cliente` (singular) | `72201c3d-74cb-442e-a761-fab192fa3b36` |
| Lista de email correspondente | `Clientes` (plural) | `46154bee-53d5-4472-bd8f-5da2a8c1d02c` |
| Vínculo lista→tag | `tag_id = 72201c3d...` | Confirmado |

**Chave estável interna:** o sistema busca por `name = 'Cliente'` na tabela `customer_tags`. A lista busca pelo `tag_id` vinculado.

---

## 3. CUSTOMER SEM EMAIL

**Estado atual:** A função `sync_subscriber_to_customer_with_tag` exige email. O trigger `trg_auto_tag_cliente_on_payment` usa `customer_id` (não email) — funciona para customer sem email, atribui tag normalmente. O trigger `trg_recalc_customer_on_order` usa `customer_email` — se vazio, `recalc_customer_metrics` não encontra o customer.

**Comportamento correto conforme contrato:**
- Customer sem email: continua customer válido ✅ (já funciona via trigger 1.1)
- Não cria subscriber/list_member ✅ (email obrigatório para subscriber)
- Auditoria de "skipped": **não existe hoje** — precisa ser adicionada

---

## 4. CONFIRMAÇÃO DE CORREÇÕES NECESSÁRIAS

Com base nos fatos acima, confirmo:

| Requisito do contrato | Estado atual | Correção necessária |
|---|---|---|
| Lead não cria customer automaticamente | ❌ `sync_subscriber_to_customer_with_tag` cria customer | Criar função separada `upsert_subscriber_only` para formulários/leads |
| Pedido aprovado cria/qualifica customer sem depender de lista | ✅ PARCIAL — `trg_auto_tag_cliente_on_payment` atribui tag sem depender de lista, MAS `trg_recalc_customer_on_order` tenta atribuir via lista também (redundância) | Remover atribuição de tag de dentro de `trg_recalc_customer_on_order` (manter só métricas + subscriber) |
| Importação garante tag sistêmica | ❌ Depende de `sync_subscriber_to_customer_with_tag` que depende de lista | Importador deve atribuir tag diretamente |
| Criação manual garante tag sistêmica | ❌ Não atribui tag | Adicionar atribuição na criação manual |
| `trigger_update_customer_first_order` | ❌ Inflaciona métricas | Remover (redundante com `recalc_customer_metrics`) |

---

## 5. RETIFICAÇÃO DO DIAGNÓSTICO ANTERIOR

O plano anterior afirmou que `auto_tag_cliente_on_payment_approved()`:
- Checava `'paid'` → **FALSO.** Checa `'approved'`.
- Continha `DELETE FROM customer_tag_assignments` → **FALSO.** Usa `ON CONFLICT DO NOTHING`.
- Nunca disparava → **FALSO.** Está ativo e funcional.

Essa função é, na verdade, a **única que já atende ao contrato de desacoplamento** — atribui a tag "Cliente" ao customer diretamente, sem depender de lista de email marketing.

