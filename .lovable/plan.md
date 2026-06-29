
# Auditoria — Pedidos do Mercado Livre na esteira padrão de Pedidos

## Como funciona hoje

1. `meli-sync-orders` consome só `/orders/{id}`. Esse endpoint do ML **não retorna** nome real, e-mail, telefone, CPF nem endereço — só `buyer.id` + `buyer.nickname`. Por isso o pedido entra com nome do nickname, **e-mail fake `meli-<id>@marketplace.local`**, sem telefone, sem CPF, sem endereço.
2. Método de pagamento (`payments[].payment_method_id` / `payment_type`) **não é gravado**. `payment_gateway_id` fica vazio.
3. Dashboard da Central de Comando filtra faturamento por `payment_gateway_id IS NOT NULL` → os 2 pedidos do ML ficam **fora** de Faturamento Real, Pedidos Pagos, Ticket Médio, mesmo na aba "Mercado Livre".
4. `OrderSourceBadge` usa SVG genérico amarelo no lugar do logo oficial do ML.
5. O e-mail fake faz o sistema criar 1 cliente-fantasma por pedido no CRM.

## O problema

- Pedidos do ML entram sem dados completos do cliente e do pagamento.
- Violam a regra `sistema-nunca-preenche-dado-faltante-do-cliente`: hoje o e-mail é fabricado (`@marketplace.local`).
- Não aparecem no Dashboard / Relatórios mesmo na aba Mercado Livre.
- Logo destoa do padrão do marketplace.
- Cliente-fantasma polui o CRM.

## O que eu faria

### Onda 1 — Enriquecimento de dados na sincronização (`meli-sync-orders`)

1. Após `/orders/{id}`, fazer chamadas adicionais com o mesmo token:
   - `GET /shipments/{shipping.id}` com header `x-format-new: true` → `receiver_address` completo (logradouro, número, complemento, bairro, cidade, UF, CEP, país), `receiver_phone`, `receiver_name`.
   - `GET /orders/{id}/billing_info` → `doc_number` (CPF/CNPJ) e nome fiscal quando o comprador pediu NF.
   - Tolerar 403/404 sem derrubar o pedido — gravar o que vier, registrar o que faltou em `marketplace_data.data_pending = [campos]`.
2. Persistir em `orders` **sem fabricar nada** (alinhado à constraint "Sistema nunca preenche dado faltante"):
   - `customer_name` = nome real (`receiver_name` ou `billing.name`) ou fallback **`nickname`** (que é o nome real exibido pelo ML, não dado fabricado).
   - `customer_email` = e-mail real **ou NULL**. Remover o `meli-<id>@marketplace.local`.
   - `customer_phone`, `customer_document` (CPF/CNPJ), `shipping_*` → preencher só quando o ML devolver; resto NULL.
   - `payment_method` = mapeamento de `payments[0].payment_method_id` / `payment_type` (cartão, pix, boleto, account_money…).
   - `payment_gateway_id` = id do provider `mercadolivre` em `payment_providers` (criar registro se não existir — é um gateway real, não placeholder), para o pedido entrar no Dashboard.
   - `marketplace_data.data_pending` = lista dos campos faltantes (alimenta pré-flight fiscal/logístico, que já bloqueia naturalmente).
3. Vínculo de cliente sem poluir CRM:
   - Procurar cliente por (a) `external_id = buyer.id` + `source = mercadolivre`, (b) CPF, (c) telefone, (d) e-mail real.
   - Se nada bater, criar cliente com `external_id = buyer.id`, `source = mercadolivre`, **sem e-mail fake**.
   - Limpar os 2 clientes-fantasma `@marketplace.local` criados pelos syncs anteriores antes do backfill.
4. Manter idempotência por `(tenant_id, marketplace_order_id)` (upsert manual já existente).

### Onda 2 — Backfill controlado dos 2 pedidos atuais

Re-rodar `meli-sync-orders` para `2000017149957656` e `2000017149792188`. Após, apagar os 2 customers-fantasma e checar no banco que os pedidos referenciam o cliente real (ou cliente novo sem e-mail fake) e têm endereço/telefone/CPF/método preenchidos quando o ML devolve.

### Onda 3 — Logo oficial do Mercado Livre no `OrderSourceBadge`

Trocar o SVG genérico pelo **logo oficial** (handshake amarelo do ML) salvo como asset PNG/SVG em `src/assets/marketplaces/`, importado no `OrderSourceBadge`. Mantém os tamanhos `sm/md/lg`, fundo amarelo, tooltip "Mercado Livre". Aplica automaticamente em lista de pedidos, detalhe do pedido e dashboard (sem mudança de UX — só asset).

### Onda 4 — Paridade Dashboard / Relatórios

- Após Onda 1, os pedidos do ML carregam `payment_gateway_id` → entram automaticamente nas métricas do Dashboard e do `/reports` na aba **Mercado Livre** (e na **Geral**), usando o critério canônico já existente (`paid/processing/ready_to_invoice/shipped/delivered`). Nenhum ajuste no Dashboard.
- Validar no banco que aba Mercado Livre passa a exibir R$ 428,42 + R$ 356,56 = R$ 785,98, 2 pedidos pagos, ticket médio R$ 392,99, no período correto.

### Onda 5 — Validação técnica obrigatória

- Consulta direta em `orders` confirmando preenchimento dos campos de cliente, endereço, documento, telefone, método e gateway.
- Conferir tela de detalhe do pedido exibindo endereço completo, método e cliente real.
- Conferir badge com logo oficial em `/orders` e no detalhe.
- Conferir Dashboard `Mercado Livre` com faturamento dos 2 pedidos.
- Confirmar que pedidos da Loja Virtual continuam idênticos (sem regressão na contagem, ticket, top 5 e relatórios).

### Onda 6 — Documentação (obrigatória)

- `docs/especificacoes/marketplaces/mercado-livre.md` — nova seção **"Ingestão de Pedidos"** descrevendo endpoints (`/orders`, `/shipments`, `/billing_info`), regra de `data_pending`, vínculo de cliente por external_id/CPF/telefone, criação do provider `mercadolivre` em `payment_providers`.
- `docs/especificacoes/logistica/logistica-externa.md` — bloco "Ingestão" referenciando a completude exigida antes da NF-e.
- `docs/especificacoes/sistema/relatorios.md` (e/ou doc do Dashboard) — registrar que pedidos ML contam por `payment_gateway_id` do provider mercadolivre, sem critério especial.
- `.lovable/memory/features/marketplaces/canonical-flow-standard.md` — anexar bullet "Pagamento de marketplace usa payment_provider próprio (`mercadolivre`, `shopee`, …) para entrar no Dashboard sem fork de filtro".
- Sem alteração no `mapa-ui.md` (não há mudança de rota/sidebar).

## Resultado final

Pedido do ML entra em `/orders` exatamente como pedido da loja: cliente real, endereço/telefone/CPF quando o ML devolve (ou `data_pending` visível quando não), método e gateway de pagamento, badge com logo oficial. Aparece em Faturamento Real, Ticket Médio, Top 5 e relatórios sem nenhum ajuste especial. CRM deixa de criar clientes-fantasma. Fluxo do módulo Pedidos **inalterado** — quem se adapta é o ML.

## Pontos de atenção / limitações

- `/orders/{id}/billing_info` exige escopo de leitura adicional do app ML; se a app credential atual não tiver, o CPF entra como `data_pending` e o operador completa pelo detalhe do pedido. Não vou pedir reconexão automática agora — só logar o aviso.
- `receiver_phone` no `/shipments` às vezes vem mascarado pelo ML; quando vier mascarado, tratar como `data_pending`.
- Auto-emissão de NF para `sales_channel='marketplace'`, inscrição de webhooks no DevCenter e Pratika continuam fora desta entrega (já em pendência operacional).

**É isso? Confirma que eu sigo com as 6 ondas?**
