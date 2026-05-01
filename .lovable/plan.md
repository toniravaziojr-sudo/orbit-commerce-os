## Contexto e diagnóstico

Auditei o fluxo completo. A causa raiz dos erros não é uma só, são três bugs convergindo:

**1. Vocabulário desalinhado entre UI ↔ Edge ↔ Banco**
- A UI e o `core-orders` usam o vocabulário canônico novo (`paid`, `awaiting_shipment`, `arriving`, `problem`, `awaiting_pickup`, `returning`, `label_generated`).
- O **enum do banco** ainda é o legado: pagamento aceita `pending, processing, approved, declined, refunded, cancelled, chargeback_requested, under_review`; envio aceita `pending, processing, shipped, in_transit, out_for_delivery, delivered, returned, failed`.
- A camada de tradução existe **só nos handlers `set_payment_status` e `set_shipping_status`**. Funciona para esses dois, mas não cobre todos os caminhos.

**2. A criação de pedido manual quebra antes mesmo de chegar à tradução**
- O handler `create_order` insere direto no banco com `shipping_status: 'awaiting_shipment'` — valor que **não existe no enum**. Por isso o "erro ao criar" que você viu nos prints.
- Mesma classe de risco existe em qualquer outro INSERT/UPDATE direto que não passe pelo `toDbShippingStatus`/`toDbPaymentStatus`.

**3. Tela de criação manual está incompleta**
- Não tem campo para método de envio com Correios/Manual (filtro `supports_quote` esconde).
- Não tem campo para forma de pagamento + status de pagamento + status de envio iniciais (necessários quando o pedido vem "por fora", já pago, já despachado etc.).
- Não tem aviso fiscal: hoje todo pedido manual gera rascunho de NF-e automaticamente, e o usuário não sabe que precisa ir no Fiscal apagar se não quiser emitir.

**4. Status "Devolvido" e ação de Estorno**
- `returned` existe no enum mas não tem fluxo manual nem integração com gateway para estornar.
- Sem ação clara, o admin não consegue marcar pedido devolvido nem disparar reembolso.

## O que vou fazer

### Etapa 1 — Alinhar vocabulário no banco (fonte de verdade única)
Expandir os enums `payment_status` e `shipping_status` para aceitar os valores canônicos novos, mantendo os legados como apelidos válidos durante transição. Backfill dos pedidos existentes para o vocabulário novo (com mapeamento determinístico). Após o backfill, a camada de tradução continua existindo só para webhooks externos antigos (gateways), que continuam mandando vocabulário legado.

```text
payment_status (novo enum):
  awaiting_payment, paid, declined, cancelled, refunded,
  under_review, chargeback_requested, chargeback_lost

shipping_status (novo enum):
  awaiting_shipment, label_generated, shipped, in_transit,
  arriving, awaiting_pickup, delivered, problem, returning, returned
```

### Etapa 2 — Corrigir criação de pedido manual no edge
- Garantir que `create_order` use os valores canônicos novos (já que o enum agora os aceita).
- Aceitar (opcionais) no payload: `payment_status_initial`, `shipping_status_initial`, `shipping_method`, `shipping_carrier`, `tracking_code`, `paid_at`, `shipped_at`. Quando vierem, são "manual override" no momento da criação, registrados no histórico como `[CRIAÇÃO MANUAL]`.
- Validar que apenas `owner`/`admin` podem usar os campos de override iniciais.

### Etapa 3 — Refatorar a tela "Novo Pedido"
- Adicionar bloco **"Status iniciais (opcional)"** com 3 selects: forma de pagamento, status de pagamento, status de envio. Default = vazio (entra no fluxo normal). Visíveis apenas para owner/admin.
- Liberar carriers manuais (ex.: Correios sem cotação) no select de método de envio: dropar o filtro `supports_quote`.
- Adicionar **aviso fiscal** no topo do formulário: "Todo pedido manual gera automaticamente um rascunho de NF-e. Se você não quiser emitir nota para esse pedido, vá em Fiscal → Notas Fiscais e exclua o rascunho manualmente."

### Etapa 4 — Refinar overrides na tela de detalhe do pedido
- Garantir que a tela de detalhe e o preview da lista usem **o mesmo helper de normalização** para decidir se a transição é natural ou override.
- Adicionar ação **"Estornar pagamento"** (owner/admin) que, para pedidos com gateway integrado, dispara o reembolso real no gateway antes de marcar `payment_status = refunded`. Para pedidos manuais, só marca o status.
- Garantir que **Cancelar pedido pago**, **Aprovar pedido sem cobrança** e **Estornar/Devolver** sejam tratados como override absoluto: pausa polling de webhook, propaga para Fiscal (marca `requires_action`) e Logística conforme política de regressão já existente.

### Etapa 5 — Validação técnica
- Rodar `UPDATE orders SET status='awaiting_confirmation' WHERE id=<test>` para garantir que os triggers de regressão (cast enum→text) continuam OK.
- Criar pedido manual via edge `core-orders` direto pelo curl, validando os 4 cenários: sem overrides, com `paid` inicial, com `dispatched` inicial, com vocabulário legado vindo de webhook simulado.
- Mudar status de pagamento e envio em pedido existente, verificando que a UI e o banco refletem o mesmo valor.
- Verificar logs de Postgres e do `core-orders` por `invalid input value for enum`.

### Etapa 6 — Documentação (entrega obrigatória)
- `docs/especificacoes/ecommerce/pedidos.md` — atualizar §4 (máquina de estados) com vocabulário canônico oficial, listar overrides permitidos na criação manual, listar ação de Estorno.
- `docs/especificacoes/erp/erp-fiscal.md` — registrar regra "todo pedido manual gera rascunho; admin precisa ir ao Fiscal para excluir se não quiser emitir".
- `docs/especificacoes/erp/logistica.md` — registrar que carriers sem cotação ficam disponíveis para seleção manual.
- `docs/especificacoes/transversais/mapa-ui.md` — atualizar tela "Novo Pedido" (novos campos) e tela de detalhe (ação Estornar).
- Memória anti-regressão: criar `mem://constraints/order-status-vocabulary-canonical` registrando que enum DB e edge devem permanecer alinhados, com exigência de teste E2E pós-mudança.

## Por que essa é a forma mais sólida

- **Resolve a causa raiz**, não o sintoma: alinhar o enum elimina permanentemente a classe de erro "invalid input value for enum", em qualquer caminho (criação, update, webhook, cron).
- **Não quebra integrações legadas**: a camada de tradução continua viva como ponte para webhooks de gateways que ainda mandam vocabulário antigo.
- **Mantém a política de override existente** (mem `order-status-manual-override-policy` e `order-cross-module-sync-on-regression`) intacta — só estende para dois novos pontos: criação manual e ação de estorno.
- **Respeita o core**: tenant-scoped, sem regra específica de tenant, fonte de verdade única no `core-orders`.
- **Anti-regressão**: a obrigação técnica de rodar UPDATE em `orders` após qualquer mudança em trigger/enum (regra já registrada em `order-cross-module-sync-on-regression`) será reforçada.

## Riscos e mitigação

- **Expandir enum em produção**: operação não-destrutiva (`ADD VALUE IF NOT EXISTS`), sem downtime, sem perda de dados.
- **Backfill de status legados**: feito em UPDATE com mapeamento determinístico e idempotente. Reversível.
- **Override na criação**: limitado a owner/admin no servidor, registrado em `order_history` e `audit_log`.

## Detalhes técnicos (referência opcional)

- Migrations: `ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'paid'/'awaiting_payment'/'chargeback_lost'` e equivalentes para `shipping_status` (`awaiting_shipment, label_generated, arriving, awaiting_pickup, problem, returning`).
- UPDATE de backfill mapeando `approved→paid`, `pending→awaiting_payment`, `pending→awaiting_shipment` (shipping), `processing→label_generated`, `out_for_delivery→arriving`, `failed→problem`.
- Após backfill, simplificar `toDb*Status` para identidade (mantendo `from*` como compat reversa para webhooks).
- `core-orders` `create_order`: aceitar `payment_status_initial`, `shipping_status_initial`, `shipping_method`, `shipping_carrier`, `tracking_code`, `paid_at`, `shipped_at` (com role check).
- `OrderNew.tsx`: novo bloco condicional, drop filtro `supports_quote` em `OrderShippingMethod.tsx`, banner fiscal.
- `OrderDetail.tsx`: nova ação `setPaymentStatus('refunded', { force: true, gateway_refund: true })` que, para pedidos com `gateway_id`, chama edge `payments-refund` antes do update.

## Próximo passo

Confirma que pode aplicar exatamente esse plano? Se sim, sigo na ordem das etapas, com validação técnica entre cada uma.