---
name: profile-enrichment-policy-standard
description: Pedido aprovado enriquece cadastro do cliente com dados pessoais (sobrescreve campo-a-campo se não-vazio) e endereço principal (bloco atômico se CEP presente). E-mail nunca é tocado.
type: feature
---

## Regra (v8.31 — 2026-05-05)

Toda vez que um pedido transita para `payment_status = 'approved'` e tem `customer_id` vinculado, o trigger `after_order_approved_sync` chama `public.enrich_customer_from_order(tenant_id, customer_id, order_id)` que atualiza o cadastro do cliente com os dados desse pedido.

**Princípio:** o pedido mais recente é a fonte de verdade mais atual sobre o cliente. E-mail nunca é tocado — é a chave imutável de identidade dentro do tenant.

### Campos pessoais (campo-a-campo, COALESCE NULLIF TRIM)
- `full_name`, `cpf`, `phone`, `birth_date`, e (quando vierem) `cnpj`, `company_name`, `ie`, `gender`.
- Pedido com valor não-vazio → sobrescreve cadastro.
- Pedido com valor vazio/null → preserva cadastro (nunca apaga).

### Endereço principal (BLOCO ATÔMICO — v8.31)
- Colunas: `address_postal_code`, `address_street`, `address_number`, `address_complement`, `address_neighborhood`, `address_city`, `address_state`.
- Se `orders.shipping_postal_code` é não-vazio → substitui os 7 campos inteiros pelos `shipping_*` do pedido (UF em uppercase).
- Se vazio → preserva todos os 7 (nunca mistura CEP novo com bairro velho).
- Não substitui `customer_addresses` (múltiplos endereços rotulados) — é o endereço-mestre do cadastro.

### Quando dispara
- Apenas na transição `OLD.payment_status IS DISTINCT FROM 'approved' AND NEW.payment_status = 'approved'`.
- Pedidos já aprovados não disparam de novo.
- Pedidos sem `customer_id` não disparam.
- Pedidos de marketplace (Mercado Livre/Shopee) seguem fluxo próprio — esta regra não os cobre.

### Padrão arquitetural
Padrão 1 — Pure SQL Trigger. UPDATE em uma tabela, sem chamada externa, sem fila, sem cron, sem `pg_net`. Latência zero. Wrap em `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING` dentro do trigger — falha de enriquecimento nunca derruba aprovação de pedido.

### Função
`public.enrich_customer_from_order(p_tenant_id, p_customer_id, p_order_id)` — `SECURITY DEFINER`, `search_path=public`, EXECUTE restrito a `service_role`.

### Por que existe
Antes desta regra a "Profile Enrichment Policy" era apenas conceitual nos docs — nenhum trigger ou edge function copiava dados do pedido para o cadastro. Resultado: pedido #409 do Respeite o Homem (2026-05-05) enviou CPF, data de nascimento e endereço completo, mas o cadastro do cliente continuou em branco. Validado tecnicamente após implementação: o cadastro foi populado integralmente (CPF, nascimento, telefone, nome e endereço completo).

### Anti-regressão
- Nunca tocar em `email` no UPDATE.
- Nunca quebrar a regra do bloco atômico do endereço (todos os 7 campos juntos).
- Nunca remover o wrap `EXCEPTION WHEN OTHERS` do trigger — pagamento aprovado não pode falhar por erro de enriquecimento.
- Nunca disparar enriquecimento fora da transição para `approved` (overhead desnecessário em todo UPDATE de pedido).
- **Fonte única de enriquecimento:** apenas `enrich_customer_from_order` (chamada por `after_order_approved_sync`) pode preencher/atualizar campos pessoais e endereço do cliente a partir de pedido. É proibido reintroduzir lógica de "ENRICH" dentro de `trg_recalc_customer_on_order` ou de qualquer outro trigger/função paralela. O trigger BEFORE de métricas é responsável só por: localizar/criar cliente por e-mail, vincular `customer_id` e marcar `is_first_sale`.

### Docs formais
`docs/especificacoes/ecommerce/clientes.md` §3.1 (schema) e §4.6.1 (regra).
`docs/especificacoes/storefront/checkout.md` (referência cruzada na seção de data de nascimento).
`docs/especificacoes/sistema/automacao-patterns.md` (histórico 2026-05-05).
